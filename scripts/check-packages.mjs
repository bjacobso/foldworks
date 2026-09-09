import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const packagesRoot = join(repositoryRoot, "packages");

const run = (command, args, options = {}) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repositoryRoot,
      env: { ...process.env, ...options.env },
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";

    if (options.capture) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
    }

    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
        return;
      }
      const detail = options.capture && stderr.trim() !== "" ? `\n${stderr.trim()}` : "";
      rejectRun(new Error(`${command} ${args.join(" ")} exited with code ${code}${detail}`));
    });
  });

const packageDirectories = [];
for (const entry of await readdir(packagesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = join(packagesRoot, entry.name);
  try {
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    if (manifest.name?.startsWith("@foldworks/") && manifest.private !== true) {
      packageDirectories.push({ directory, manifest });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
packageDirectories.sort((left, right) => left.manifest.name.localeCompare(right.manifest.name));

if (packageDirectories.length === 0) {
  throw new Error("No publishable @foldworks packages were found.");
}

const collectExportTargets = (value) => {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectExportTargets);
};

const temporaryRoot = await mkdtemp(join(tmpdir(), "foldworks-pack-check-"));
const tarballDirectory = join(temporaryRoot, "tarballs");
const consumerDirectory = join(temporaryRoot, "consumer");

try {
  const tarballs = new Map();

  await mkdir(tarballDirectory, { recursive: true });

  for (const { directory, manifest } of packageDirectories) {
    const archiveName = `${manifest.name.slice("@foldworks/".length)}-${manifest.version}.tgz`;
    const archivePath = join(tarballDirectory, archiveName);
    await run("pnpm", ["pack", "--out", archivePath], { cwd: directory });

    const { stdout: listing } = await run("tar", ["-tzf", archivePath], { capture: true });
    const entries = listing.trim().split("\n");
    const required = [
      "package/package.json",
      "package/README.md",
      "package/LICENSE",
      "package/dist/index.js",
      "package/dist/index.d.ts",
      ...collectExportTargets(manifest.exports)
        .filter((target) => target.startsWith("./"))
        .map((target) => `package/${target.slice(2)}`),
    ];
    for (const expected of required) {
      if (!entries.includes(expected)) {
        throw new Error(`${manifest.name} tarball is missing ${expected}.`);
      }
    }

    const forbidden = entries.filter((entry) =>
      entry.startsWith("package/src/") ||
      /(?:^|\/)(?:[^/]+\.)?(?:test|spec)\.[^/]+$/.test(entry) ||
      entry === "package/tsconfig.json" ||
      entry.includes("vitest.config"),
    );
    if (forbidden.length > 0) {
      throw new Error(`${manifest.name} tarball contains development files:\n${forbidden.join("\n")}`);
    }

    const { stdout: packedManifestJson } = await run(
      "tar",
      ["-xOzf", archivePath, "package/package.json"],
      { capture: true },
    );
    const packedManifest = JSON.parse(packedManifestJson);
    const packedDependencySpecs = Object.values({
      ...packedManifest.dependencies,
      ...packedManifest.optionalDependencies,
      ...packedManifest.peerDependencies,
    });
    const unresolvedSpec = packedDependencySpecs.find((spec) =>
      typeof spec === "string" && (spec.startsWith("workspace:") || spec.startsWith("catalog:")),
    );
    if (unresolvedSpec !== undefined) {
      throw new Error(`${manifest.name} contains an unresolved dependency specifier: ${unresolvedSpec}`);
    }

    tarballs.set(manifest.name, archivePath);
  }

  await mkdir(join(consumerDirectory, "src"), { recursive: true });
  await writeFile(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify({
      name: "foldworks-package-smoke-test",
      private: true,
      type: "module",
      scripts: { build: "vite build", typecheck: "tsc --noEmit" },
      dependencies: Object.fromEntries(
        [...tarballs].map(([name, archivePath]) => [name, `file:${archivePath}`]),
      ),
      devDependencies: {
        "@stylexjs/unplugin": "0.19.0",
        typescript: "6.0.3",
        vite: "8.2.2",
      },
    }, null, 2)}\n`,
  );
  await writeFile(
    join(consumerDirectory, "index.html"),
    '<!doctype html><html><body><main id="app"></main><script type="module" src="/src/main.ts"></script></body></html>\n',
  );
  await writeFile(
    join(consumerDirectory, "vite.config.ts"),
    `import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [stylex.vite({ runtimeInjection: false, useCSSLayers: true })],
});
`,
  );
  await writeFile(
    join(consumerDirectory, "tsconfig.json"),
    `${JSON.stringify({
      compilerOptions: {
        lib: ["ESNext", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "Bundler",
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: "ES2022",
      },
      include: ["src"],
    }, null, 2)}\n`,
  );
  await writeFile(
    join(consumerDirectory, "src", "env.d.ts"),
    'declare module "*.css";\n',
  );
  await writeFile(
    join(consumerDirectory, "src", "main.ts"),
    `import "@foldworks/ui/base.css";
import "@foldworks/ui/themes/neutral.css";
import "@foldworks/editor/styles.css";
import "@foldworks/data-grid/styles.css";
import "@foldworks/pdf-annotator/styles.css";

import * as Editor from "@foldworks/editor";
import * as DataGrid from "@foldworks/data-grid";
import * as FormBuilder from "@foldworks/form-builder";
import * as History from "@foldworks/history";
import * as PdfAnnotator from "@foldworks/pdf-annotator";
import * as QueryBuilder from "@foldworks/query-builder";
import * as Sidebar from "@foldworks/sidebar";
import * as Ui from "@foldworks/ui";
import * as UiIcon from "@foldworks/ui/icon";
import * as UiTokens from "@foldworks/ui/tokens.stylex";
import * as Workflow from "@foldworks/workflow";

const modules = [Editor, DataGrid, FormBuilder, History, PdfAnnotator, QueryBuilder, Sidebar, Ui, UiIcon, UiTokens, Workflow];
const app = document.querySelector<HTMLElement>("#app");
if (app === null) throw new Error("Missing smoke-test mount point.");
app.textContent = "Loaded " + modules.reduce((count, module) => count + Object.keys(module).length, 0) + " Foldworks exports";
`,
  );

  await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: consumerDirectory,
  });
  await run("npm", ["run", "typecheck"], { cwd: consumerDirectory });
  await run("npm", ["run", "build"], { cwd: consumerDirectory });

  await stat(join(consumerDirectory, "dist", "index.html"));
  const builtAssets = await readdir(join(consumerDirectory, "dist", "assets"));
  if (!builtAssets.some((file) => file.endsWith(".js"))) {
    throw new Error("The clean consumer build did not emit JavaScript.");
  }
  if (!builtAssets.some((file) => file.endsWith(".css"))) {
    throw new Error("The clean consumer build did not emit CSS.");
  }

  console.log(`\nValidated ${tarballs.size} package tarballs and a clean Vite consumer build.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
