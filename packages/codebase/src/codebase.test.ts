import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseCliOptions } from "./cli";
import { parseStatus } from "./git";
import { startCodebaseServer, type CodebaseServer } from "./server";

const servers: CodebaseServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("parseStatus", () => {
  it("separates staged, unstaged, and untracked changes", () => {
    expect(parseStatus("M  staged.ts\0 M unstaged.ts\0MM both.ts\0?? new.ts\0")).toEqual([
      { path: "staged.ts", kind: "modified", state: "staged" },
      { path: "unstaged.ts", kind: "modified", state: "unstaged" },
      { path: "both.ts", kind: "modified", state: "staged" },
      { path: "both.ts", kind: "modified", state: "unstaged" },
      { path: "new.ts", kind: "added", state: "untracked" },
    ]);
  });

  it("retains the previous path for renames", () => {
    expect(parseStatus("R  next.ts\0old.ts\0")).toEqual([
      { path: "next.ts", previousPath: "old.ts", kind: "renamed", state: "staged" },
    ]);
  });
});

describe("parseCliOptions", () => {
  it("parses server flags", () => {
    expect(parseCliOptions(["--root", "/repo", "--host", "0.0.0.0", "--port", "4400", "--base-ref", "main"])).toEqual({
      root: "/repo",
      host: "0.0.0.0",
      port: 4400,
      baseRef: "main",
    });
  });
});

describe("codebase server", () => {
  it("serves a snapshot and bounded repository files", async () => {
    const root = await mkdtemp(join(tmpdir(), "foldworks-codebase-"));
    await mkdir(join(root, ".git"));
    await writeFile(join(root, "README.md"), "# Sample\n");
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "sample", description: "Example" }));
    await writeFile(join(root, ".env"), "TOKEN=initial\n");
    const git = async (...args: string[]): Promise<void> => {
      const { execFile } = await import("node:child_process");
      await new Promise<void>((resolve, reject) => execFile("git", ["-C", root, ...args], (error) => error ? reject(error) : resolve()));
    };
    await git("init");
    await git("config", "user.email", "test@example.com");
    await git("config", "user.name", "Test User");
    await git("add", ".");
    await git("commit", "-m", "Initial commit");
    await writeFile(join(root, ".env"), "TOKEN=changed-secret\n");

    const server = await startCodebaseServer({ root, host: "127.0.0.1", port: 0, baseRef: "HEAD" });
    servers.push(server);
    const snapshot = await fetch(`${server.origin}/api/snapshot`).then((response) => response.json()) as { title: string; files: string[] };
    expect(snapshot.title).toBe("sample");
    expect(snapshot.files).toContain("README.md");
    expect(snapshot.files).not.toContain(".env");
    const file = await fetch(`${server.origin}/api/file?path=README.md`).then((response) => response.json()) as { text: string };
    expect(file.text).toBe("# Sample\n");
    expect((await fetch(`${server.origin}/api/file?path=.git/config`)).status).toBe(403);
    expect((await fetch(`${server.origin}/api/file?path=../outside`)).status).toBe(403);
    const diff = await fetch(`${server.origin}/api/diff?scope=unstaged`).then((response) => response.json()) as { text: string };
    expect(diff.text).not.toContain("changed-secret");
  });
});
