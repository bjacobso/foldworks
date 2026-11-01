import { execFile } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { Plugin } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = join(root, "apps/forma-workbench/dist");

// Emit into Vite's output so the normal build, browser tests, and Alchemy's
// injected Cloudflare build all ship the same /forma/ assets.
export const formaWorkbench = (): Plugin => ({
  name: "foldworks-forma-workbench",
  apply: "build",
  async generateBundle() {
    await promisify(execFile)("pnpm", ["--filter", "@foldworks/forma-workbench", "build"], {
      cwd: root,
      maxBuffer: 10 * 1024 * 1024,
    });
    for (const entry of readdirSync(output, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const path = join(entry.parentPath, entry.name);
      this.emitFile({
        type: "asset",
        fileName: `forma/${relative(output, path).split("\\").join("/")}`,
        source: readFileSync(path),
      });
    }
  },
});
