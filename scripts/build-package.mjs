// Builds the package in the current directory into `dist`:
// - JavaScript: tsup bundles every JavaScript target in `exports` and `bin`
//   from the matching `src/*.ts` file, sharing code between entries through
//   chunks;
// - CSS: every `src/**/*.css` file is copied as is;
// - declarations: the package's own `tsc`, excluding tests. This also fails
//   the build on type errors.
//
// Output is staged and swapped into `dist` in one rename, so a running
// `vite dev` never sees a half-written package. `--runtime-only` (used by
// `turbo dev` via `build:runtime`) skips declarations and keeps the previous
// ones, because nothing at runtime needs them and `tsc` is the slow step.
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";

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

// StyleX resolves `defineVars` and `defineConsts` by module path, so
// `*.stylex` entries stay standalone files that every other output imports
// directly rather than through a shared chunk. During bundling, imports of
// those sources become placeholders; `linkStylexEntries` then rewrites each
// placeholder to the path from the importing output file.
const stylexEntries = Object.keys(entries).filter((name) => name.endsWith(".stylex"));
const stylexSources = new Map(
  stylexEntries.map((name) => [join(packageRoot, entries[name]), name]),
);
const stylexPlaceholder = "foldworks-stylex-entry:";
const externalStylexEntries = {
  name: "foldworks-external-stylex-entries",
  setup(build) {
    build.onResolve({ filter: /\.stylex(?:\.[jt]s)?$/ }, (args) => {
      if (args.kind === "entry-point" || !args.path.startsWith(".")) return undefined;
      const source = join(args.resolveDir, args.path).replace(/\.[jt]s$/, "") + ".ts";
      const name = stylexSources.get(source);
      return name === undefined ? undefined : { path: stylexPlaceholder + name, external: true };
    });
  },
};

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

const linkStylexEntries = async (directory) => {
  if (stylexEntries.length === 0) return;
  for (const entry of await readdir(directory, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const path = join(entry.parentPath, entry.name);
    const text = await readFile(path, "utf8");
    const linked = text.replaceAll(
      new RegExp(`(["'])${stylexPlaceholder}([^"']+)\\1`, "g"),
      (_match, quote, name) => {
        const target = relative(entry.parentPath, join(stagedOutputDirectory, `${name}.js`));
        return quote + (target.startsWith(".") ? target : `./${target}`) + quote;
      },
    );
    if (linked !== text) await writeFile(path, linked);
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

  const bundle = (entry, options) =>
    build({
      bundle: true,
      clean: false,
      config: false,
      dts: false,
      entry,
      external: ["node:*"],
      format: ["esm"],
      minify: false,
      outDir: stagedOutputDirectory,
      // A package that ships a CLI is a Node program; the rest run in browsers.
      platform: packageJson.bin === undefined ? "browser" : "node",
      silent: false,
      sourcemap: true,
      target: "es2022",
      treeshake: true,
      ...options,
    });
  const pick = (names) => Object.fromEntries(names.map((name) => [name, entries[name]]));
  const otherEntries = Object.keys(entries).filter((name) => !stylexEntries.includes(name));
  // Splitting shares code between entries through chunks. StyleX entries are
  // built on their own so they never import one.
  if (stylexEntries.length > 0) await bundle(pick(stylexEntries), { splitting: false });
  if (otherEntries.length > 0) {
    await bundle(pick(otherEntries), {
      esbuildPlugins: [externalStylexEntries],
      splitting: otherEntries.length > 1,
    });
  }

  await linkStylexEntries(stagedOutputDirectory);
  if (!runtimeOnly) await emitDeclarations();

  await publishStagedOutput();
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}
