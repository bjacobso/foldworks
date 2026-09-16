import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { promisify } from "node:util";

import type {
  ChangeKind,
  CodebaseDocument,
  CodebasePackage,
  CommitSummary,
  DiffResult,
  DiffScope,
  RepositoryChange,
  RepositorySnapshot,
  ResolvedCodebaseConfig,
} from "./model";
import { isRestrictedRepositoryPath } from "./repository";

const execute = promisify(execFile);
const gitOutputLimit = 16 * 1024 * 1024;

const runGit = async (root: string, args: readonly string[]): Promise<string> => {
  const result = await execute("git", ["-C", root, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    maxBuffer: gitOutputLimit,
    windowsHide: true,
  });
  return result.stdout;
};

const changeKind = (code: string): ChangeKind => {
  if (code === "A" || code === "?") return "added";
  if (code === "C") return "copied";
  if (code === "D") return "deleted";
  if (code === "M") return "modified";
  if (code === "R") return "renamed";
  if (code === "T") return "type-changed";
  if (code === "U") return "unmerged";
  return "unknown";
};

export const parseStatus = (output: string): readonly RepositoryChange[] => {
  const records = output.split("\0");
  const changes: RepositoryChange[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record === undefined || record.length < 4) continue;
    const x = record[0] ?? " ";
    const y = record[1] ?? " ";
    const path = record.slice(3);
    const renamed = x === "R" || x === "C" || y === "R" || y === "C";
    const previousPath = renamed ? records[index + 1] : undefined;
    if (renamed) index += 1;

    if (x === "?" && y === "?") {
      changes.push({ path, kind: "added", state: "untracked" });
      continue;
    }
    if (x !== " " && x !== "!") {
      changes.push({
        path,
        ...(previousPath === undefined ? {} : { previousPath }),
        kind: changeKind(x),
        state: "staged",
      });
    }
    if (y !== " " && y !== "!") {
      changes.push({
        path,
        ...(previousPath === undefined ? {} : { previousPath }),
        kind: changeKind(y),
        state: "unstaged",
      });
    }
  }
  return changes;
};

const readPackage = async (root: string, path: string, files: ReadonlySet<string>): Promise<CodebasePackage | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(resolve(root, path), "utf8"));
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const manifest = parsed as Record<string, unknown>;
    if (typeof manifest.name !== "string") return undefined;
    const packagePath = dirname(path) === "." ? "" : dirname(path).replaceAll("\\", "/");
    const dependencyNames = ["dependencies", "devDependencies", "peerDependencies"]
      .flatMap((field) => {
        const value = manifest[field];
        return typeof value === "object" && value !== null ? Object.keys(value) : [];
      });
    const readme = packagePath.length === 0 ? "README.md" : `${packagePath}/README.md`;
    return {
      name: manifest.name,
      path: packagePath,
      ...(typeof manifest.description === "string" ? { description: manifest.description } : {}),
      ...(typeof manifest.version === "string" ? { version: manifest.version } : {}),
      ...(files.has(readme) ? { readme } : {}),
      dependencies: [...new Set(dependencyNames)].sort(),
    };
  } catch {
    return undefined;
  }
};

const documentTitle = (path: string): string => {
  if (basename(path).toLowerCase() === "readme.md") {
    const parent = basename(dirname(path));
    return parent === "." ? "Repository overview" : `${parent} overview`;
  }
  return basename(path, ".md").replaceAll(/[-_]/g, " ");
};

export const createSnapshot = async (config: ResolvedCodebaseConfig): Promise<RepositorySnapshot> => {
  const [filesOutput, statusOutput, branchOutput, headOutput] = await Promise.all([
    runGit(config.root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]),
    runGit(config.root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
    runGit(config.root, ["branch", "--show-current"]),
    runGit(config.root, ["rev-parse", "--short=10", "HEAD"]),
  ]);
  const files = filesOutput.split("\0").filter((path) => path.length > 0 && !isRestrictedRepositoryPath(path)).sort();
  const fileSet = new Set(files);
  const packages = (
    await Promise.all(files.filter((path) => basename(path) === "package.json").map((path) => readPackage(config.root, path, fileSet)))
  ).filter((value): value is CodebasePackage => value !== undefined).sort((left, right) => left.path.localeCompare(right.path));
  const packagePaths = packages.map((entry) => entry.path).filter((path) => path.length > 0).sort((a, b) => b.length - a.length);
  const documents: CodebaseDocument[] = files.filter((path) => path.toLowerCase().endsWith(".md")).map((path) => {
    const packagePath = packagePaths.find((candidate) => path === candidate || path.startsWith(`${candidate}/`));
    return {
      path,
      title: documentTitle(path),
      ...(packagePath === undefined ? {} : { packagePath }),
    };
  });

  return {
    title: config.title,
    rootName: basename(config.root),
    branch: branchOutput.trim() || "detached HEAD",
    head: headOutput.trim(),
    baseRef: config.baseRef,
    generatedAt: new Date().toISOString(),
    files,
    packages,
    documents,
    changes: parseStatus(statusOutput).filter((change) => !isRestrictedRepositoryPath(change.path)),
  };
};

export const readDiff = async (
  config: ResolvedCodebaseConfig,
  scope: DiffScope,
  path?: string,
): Promise<DiffResult> => {
  const common = ["--no-ext-diff", "--no-color", "--unified=4", "--src-prefix=a/", "--dst-prefix=b/"];
  let args: string[];
  if (scope === "staged") args = ["diff", "--cached", ...common];
  else if (scope === "unstaged") args = ["diff", ...common];
  else {
    let mergeBase: string;
    try {
      mergeBase = (await runGit(config.root, ["merge-base", config.baseRef, "HEAD"])).trim();
    } catch {
      mergeBase = "HEAD";
    }
    args = ["diff", mergeBase, ...common];
  }
  if (path !== undefined) args.push("--", path);
  else args.push(
    "--",
    ".",
    ":(exclude).env",
    ":(exclude).env.*",
    ":(exclude)**/.env",
    ":(exclude)**/.env.*",
    ":(exclude)**/node_modules/**",
  );
  const text = await runGit(config.root, args);
  return {
    scope,
    ...(path === undefined ? {} : { path }),
    baseRef: config.baseRef,
    text,
  };
};

export const readHistory = async (
  config: ResolvedCodebaseConfig,
  path?: string,
): Promise<readonly CommitSummary[]> => {
  const args = ["log", "-40", "--date=iso-strict", "--format=%H%x1f%h%x1f%an%x1f%aI%x1f%s%x1e"];
  if (path !== undefined) args.push("--", path);
  const output = await runGit(config.root, args);
  return output.split("\x1e").map((record) => record.trim()).filter(Boolean).flatMap((record) => {
    const [hash, shortHash, author, authoredAt, subject] = record.split("\x1f");
    if (hash === undefined || shortHash === undefined || author === undefined || authoredAt === undefined || subject === undefined) return [];
    return [{ hash, shortHash, author, authoredAt, subject }];
  });
};
