// Builds the package in the current directory into `dist`:
// - JavaScript: tsup bundles every JavaScript target in `exports` and `bin`
//   from the matching `src/*.ts` file;
// - CSS: every `src/**/*.css` file is copied as is;
// - declarations: the package's own `tsc`, excluding tests. This also fails
//   the build on type errors.
//
// Output is staged and swapped into `dist` in one rename, so a running
// `vite dev` never sees a half-written package. `--runtime-only` (used by
// `turbo dev` via `build:runtime`) skips declarations and keeps the previous
// ones, because nothing at runtime needs them and `tsc` is the slow step.
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { build } from "tsup";

const packageRoot = process.cwd();
const require = createRequire(join(packageRoot, "package.json"));
const packageJson = require("./package.json");
const runtimeOnly = process.argv.includes("--runtime-only");
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--runtime-only");

if (unknownArguments.length > 0) {
  throw new Error(`Unknown build arguments: ${unknownArguments.join(", ")}`);
}

// `"./dist/testing/stylex.js"` is built from `src/testing/stylex.ts`.
const targets = [
  ...Object.values(packageJson.exports ?? {}).map((target) =>
    typeof target === "string" ? target : target.import,
  ),
  ...(typeof packageJson.bin === "string"
    ? [packageJson.bin]
    : Object.values(packageJson.bin ?? {})),
];
const entries = Object.fromEntries(
  targets
    .map((target) => /^\.\/dist\/(.+)\.js$/.exec(target ?? "")?.[1])
    .filter((name) => name !== undefined)
    .map((name) => [name, `src/${name}.ts`]),
);
for (const source of Object.values(entries)) {
  await stat(join(packageRoot, source)).catch(() => {
    throw new Error(`${packageJson.name} exports a build of ${source}, which does not exist.`);
  });
}

// StyleX resolves `defineVars` by module path, so `*.stylex` entries stay
// standalone files: other entries import them as externals, and packages that
// have them are not split, because splitting would make the token module import a shared chunk.
const stylexEntries = Object.keys(entries).filter((name) => name.endsWith(".stylex"));

const liveOutputDirectory = join(packageRoot, "dist");
const stagingParent = join(packageRoot, "node_modules");
await mkdir(stagingParent, { recursive: true });
const stagingRoot = await mkdtemp(join(stagingParent, ".foldworks-build-"));
const stagedOutputDirectory = join(stagingRoot, "dist");
const previousOutputDirectory = join(stagingRoot, "previous-dist");

const copyMatchingFiles = async (sourceDirectory, destinationDirectory, matches) => {
  let directoryEntries;
  try {
    directoryEntries = await readdir(sourceDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of directoryEntries) {
    const source = join(sourceDirectory, entry.name);
    const destination = join(destinationDirectory, entry.name);
    if (entry.isDirectory()) {
      await copyMatchingFiles(source, destination, matches);
      continue;
    }
    if (!entry.isFile() || !matches(entry.name)) continue;
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
  }
};

const emitDeclarations = async () => {
  const tsconfigPath = join(stagingRoot, "tsconfig.json");
  await writeFile(
    tsconfigPath,
    JSON.stringify({
      extends: join(packageRoot, "tsconfig.json"),
      compilerOptions: {
        declaration: true,
        declarationMap: false,
        emitDeclarationOnly: true,
        noEmit: false,
        outDir: stagedOutputDirectory,
        preserveSymlinks: true,
        rootDir: join(packageRoot, "src"),
      },
      exclude: [join(packageRoot, "src/**/*.test.*"), join(packageRoot, "src/**/*.spec.*")],
    }),
  );
  const typescriptManifestPath = require.resolve("typescript/package.json");
  const tsc = join(dirname(typescriptManifestPath), require(typescriptManifestPath).bin.tsc);
  const result = spawnSync(process.execPath, [tsc, "-p", tsconfigPath], {
    cwd: packageRoot,
    stdio: "inherit",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`tsc reported errors for ${packageJson.name}; see above.`);
  }
};

const publishStagedOutput = async () => {
  let movedPreviousOutput = false;
  try {
    try {
      await rename(liveOutputDirectory, previousOutputDirectory);
      movedPreviousOutput = true;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await rename(stagedOutputDirectory, liveOutputDirectory);
  } catch (error) {
    if (movedPreviousOutput) {
      await rename(previousOutputDirectory, liveOutputDirectory);
    }
    throw error;
  }
};

try {
  await mkdir(stagedOutputDirectory, { recursive: true });

  if (runtimeOnly) {
    await copyMatchingFiles(liveOutputDirectory, stagedOutputDirectory, (fileName) =>
      /\.d\.[cm]?ts(?:\.map)?$/.test(fileName),
    );
  }

  await copyMatchingFiles(join(packageRoot, "src"), stagedOutputDirectory, (fileName) =>
    fileName.endsWith(".css"),
  );

  await build({
    bundle: true,
    clean: false,
    config: false,
    dts: false,
    entry: entries,
    external: ["node:*", ...stylexEntries.map((name) => `./${name}.js`)],
    format: ["esm"],
    minify: false,
    outDir: stagedOutputDirectory,
    // A package that ships a CLI is a Node program; the rest run in browsers.
    platform: packageJson.bin === undefined ? "browser" : "node",
    silent: false,
    sourcemap: true,
    splitting: Object.keys(entries).length > 1 && stylexEntries.length === 0,
    target: "es2022",
    treeshake: true,
  });

  if (!runtimeOnly) await emitDeclarations();

  await publishStagedOutput();
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}
