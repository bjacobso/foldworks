import { cp, mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { build } from "tsup";
import ts from "typescript";

const packageRoot = process.cwd();
const packageJson = (
  await import(resolve(packageRoot, "package.json"), {
    with: { type: "json" },
  })
).default;
const runtimeOnly = process.argv.includes("--runtime-only");
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--runtime-only");

if (unknownArguments.length > 0) {
  throw new Error(`Unknown build arguments: ${unknownArguments.join(", ")}`);
}

const isCodebase = packageJson.name === "@foldworks/codebase";
const entries =
  packageJson.name === "@foldworks/ui"
    ? {
        icon: "src/icon.ts",
        index: "src/index.ts",
        "tokens.stylex": "src/tokens.stylex.ts",
      }
    : packageJson.name === "@foldworks/generative-ui"
      ? {
          ai: "src/ai.ts",
          core: "src/core.ts",
          foldworks: "src/foldworks.ts",
          index: "src/index.ts",
          mcp: "src/mcp.ts",
          "mcp-app": "src/mcp-app.ts",
        }
      : packageJson.name === "@foldworks/code-editor"
        ? { index: "src/index.ts", contracts: "src/contracts.ts", structured: "src/structured.ts" }
        : packageJson.name === "@foldworks/agent"
          ? { index: "src/index.ts", testing: "src/testing.ts" }
          : isCodebase
            ? { index: "src/index.ts", server: "src/server.ts", cli: "src/cli.ts" }
            : { index: "src/index.ts" };

const liveOutputDirectory = join(packageRoot, "dist");
const stagingParent = join(packageRoot, "node_modules");
await mkdir(stagingParent, { recursive: true });
const stagingRoot = await mkdtemp(join(stagingParent, ".foldworks-build-"));
const stagedOutputDirectory = join(stagingRoot, "dist");
const previousOutputDirectory = join(stagingRoot, "previous-dist");

const copyMatchingFiles = async (sourceDirectory, destinationDirectory, matches) => {
  let entries;
  try {
    entries = await readdir(sourceDirectory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const entry of entries) {
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

const copyCss = (destinationDirectory) =>
  copyMatchingFiles(resolve(packageRoot, "src"), destinationDirectory, (fileName) =>
    fileName.endsWith(".css"),
  );

const copyDeclarations = (destinationDirectory) =>
  copyMatchingFiles(liveOutputDirectory, destinationDirectory, (fileName) =>
    /\.d\.[cm]?ts(?:\.map)?$/.test(fileName),
  );

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

  // Runtime-only builds retain the last declarations for editor tooling while
  // replacing JavaScript and CSS together. Turbo only caches the runtime files.
  if (runtimeOnly) {
    await copyDeclarations(stagedOutputDirectory);
  }

  // CSS is ready before any potentially slow declaration work begins.
  await copyCss(stagedOutputDirectory);

  await build({
    bundle: true,
    clean: false,
    dts: false,
    entry: entries,
    external: packageJson.name === "@foldworks/ui" ? ["./tokens.stylex.js"] : [],
    format: ["esm"],
    minify: false,
    outDir: stagedOutputDirectory,
    platform: isCodebase ? "node" : "browser",
    silent: false,
    sourcemap: true,
    splitting:
      packageJson.name === "@foldworks/code-editor" ||
      packageJson.name === "@foldworks/agent" ||
      packageJson.name === "@foldworks/generative-ui" ||
      isCodebase,
    target: "es2022",
    treeshake: true,
  });

  if (!runtimeOnly) {
    const configPath = join(packageRoot, "tsconfig.json");
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    if (configFile.error !== undefined) {
      throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
    }
    const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, packageRoot);
    const declarationRoots = parsedConfig.fileNames.filter(
      (file) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file),
    );
    const declarationProgram = ts.createProgram(declarationRoots, {
      ...parsedConfig.options,
      declaration: true,
      declarationMap: false,
      emitDeclarationOnly: true,
      noEmit: false,
      outDir: stagedOutputDirectory,
      preserveSymlinks: true,
      rootDir: join(packageRoot, "src"),
    });
    const declarationResult = declarationProgram.emit();
    const diagnostics = [
      ...ts.getPreEmitDiagnostics(declarationProgram),
      ...declarationResult.diagnostics,
    ];
    if (diagnostics.length > 0) {
      const host = {
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => packageRoot,
        getNewLine: () => "\n",
      };
      throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
    }
    if (declarationResult.emitSkipped) {
      throw new Error("TypeScript skipped declaration output.");
    }
  }

  await publishStagedOutput();
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}
