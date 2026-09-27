import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const packageRoot = process.cwd();
const sourceRoot = join(packageRoot, "src");
const tscPath = createRequire(import.meta.url).resolve("typescript/bin/tsc");

const sourceFiles = async (directory) => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (entry.isFile() && path.endsWith(".ts")) files.push(path);
  }
  return files;
};

// The package entry point pulls every component into one TypeScript program.
// Its export surface is checked by the demo's consumer typecheck, and the
// catalog test verifies the exports at runtime. Check implementation and test
// files in smaller programs to keep TypeScript's relation map bounded.
const files = (await sourceFiles(sourceRoot))
  .filter(
    (path) => path !== join(sourceRoot, "index.ts") && path !== join(sourceRoot, "catalog.test.ts"),
  )
  .sort();
const batchSize = 8;
const temporaryDirectory = await mkdtemp(join(packageRoot, "node_modules", ".typecheck-ui-"));

try {
  for (let index = 0; index < files.length; index += batchSize) {
    const batch = files.slice(index, index + batchSize);
    const configPath = join(temporaryDirectory, "tsconfig.json");
    await writeFile(
      configPath,
      JSON.stringify({
        extends: resolve(packageRoot, "tsconfig.json"),
        include: [],
        files: batch,
      }),
    );
    const result = spawnSync(process.execPath, [tscPath, "--project", configPath], {
      cwd: packageRoot,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    process.stdout.write(
      `UI typecheck ${Math.floor(index / batchSize) + 1}/${Math.ceil(files.length / batchSize)}\n`,
    );
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error || result.status !== 0) {
      if (result.error) process.stderr.write(`${result.error}\n`);
      process.exitCode = result.status || 1;
      break;
    }
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
