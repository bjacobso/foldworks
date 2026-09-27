import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const packageRoot = process.cwd();
const sourceRoot = resolve(packageRoot, "src");
const compiler = resolve(packageRoot, "node_modules/typescript/bin/tsc");
const ignored = new Set([
  "index.ts",
  "stateful.ts",
  // These import the entire index; Vitest still runs them. The index is an
  // export-only barrel and is also resolved by the package build.
  "catalog.test.ts",
  "composition.test.ts",
]);

const collect = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collect(path) : path.endsWith(".ts") ? [path] : [];
    }),
  );
  return nested.flat();
};

const files = (await collect(sourceRoot))
  .filter((file) => !ignored.has(relative(sourceRoot, file)))
  .sort();
const temp = await mkdtemp(resolve(packageRoot, "node_modules/.ui-typecheck-"));

const run = (config) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [compiler, "--noEmit", "-p", config], {
      cwd: packageRoot,
      stdio: "inherit",
    });
    child.on("error", rejectRun);
    child.on("exit", (code) =>
      code === 0 ? resolveRun() : rejectRun(new Error(`TypeScript exited ${code}`)),
    );
  });

try {
  // A bounded root set avoids the compiler's global type-relation cache limit.
  let failed = false;
  for (let start = 0; start < files.length; start += 6) {
    const group = files.slice(start, start + 6);
    const config = join(temp, `group-${start / 6}.json`);
    await writeFile(
      config,
      JSON.stringify({
        extends: resolve(packageRoot, "tsconfig.json"),
        include: [],
        files: group,
      }),
    );
    process.stdout.write(
      `Checking UI sources ${start + 1}–${start + group.length} of ${files.length}\n`,
    );
    try {
      await run(config);
    } catch {
      failed = true;
    }
  }
  if (failed) process.exitCode = 1;
} finally {
  await rm(temp, { recursive: true, force: true });
}
