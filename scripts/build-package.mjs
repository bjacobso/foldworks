import { cp, mkdir, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import { build } from "tsup";
import ts from "typescript";

const packageRoot = process.cwd();
const packageJson = (await import(resolve(packageRoot, "package.json"), {
  with: { type: "json" },
})).default;

const entries = packageJson.name === "@foldworks/ui"
  ? {
      icon: "src/icon.ts",
      index: "src/index.ts",
      "tokens.stylex": "src/tokens.stylex.ts",
    }
  : packageJson.name === "@foldworks/code-editor"
    ? { index: "src/index.ts", contracts: "src/contracts.ts", structured: "src/structured.ts" }
    : packageJson.name === "@foldworks/agent"
      ? { index: "src/index.ts", testing: "src/testing.ts" }
    : { index: "src/index.ts" };
await build({
  bundle: true,
  clean: true,
  dts: false,
  entry: entries,
  external: packageJson.name === "@foldworks/ui" ? ["./tokens.stylex.js"] : [],
  format: ["esm"],
  minify: false,
  outDir: "dist",
  platform: "browser",
  silent: false,
  sourcemap: true,
  splitting: packageJson.name === "@foldworks/code-editor" || packageJson.name === "@foldworks/agent",
  target: "es2022",
  treeshake: true,
});

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
  outDir: join(packageRoot, "dist"),
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

const copyCss = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name);
    if (entry.isDirectory()) {
      await copyCss(source);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".css")) continue;
    const destination = resolve(packageRoot, "dist", relative(resolve(packageRoot, "src"), source));
    await mkdir(dirname(destination), { recursive: true });
    await cp(source, destination);
  }
};

await copyCss(resolve(packageRoot, "src"));
