import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const packageDirectory = join(repositoryRoot, "packages", "foldworks");
const sharedRuntimeVersions = {
  "@foldkit/ui": "0.170.0",
  "@stylexjs/stylex": "0.19.0",
  effect: "4.1.1",
  foldkit: "0.170.0",
};
// Integrations only some modules use. They are optional peers, so the modules
// that need one are checked after the rest build without it.
const optionalPeerVersions = {
  "@modelcontextprotocol/ext-apps": "2.0.0",
  "pdf-lib": "1.17.1",
  "pdfjs-dist": "6.3.289",
};
const optionalPeerEntries = new Set([
  "./generative-ui/mcp-app",
  "./pdf",
  "./pdf-annotator",
  "./pdf-viewer",
]);
// Configuration helpers that run in Node, not in application bundles.
const configurationEntries = new Set(["./ui/testing/stylex", "./ui/vite"]);

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
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
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

const manifest = JSON.parse(await readFile(join(packageDirectory, "package.json"), "utf8"));
if (manifest.name !== "foldworks" || manifest.private === true) {
  throw new Error("packages/foldworks must be the publishable foldworks package.");
}

const collectExportTargets = (value) => {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectExportTargets);
};
const exportEntries = Object.entries(manifest.exports ?? {});
const scriptEntries = exportEntries
  .filter(([key, target]) => typeof target !== "string" && !configurationEntries.has(key))
  .map(([key]) => key);
const styleEntries = exportEntries
  .filter(([, target]) => typeof target === "string" && target.endsWith(".css"))
  .map(([key]) => key)
  // Cascade layer order must be declared before any layered rules.
  .sort((left, right) => Number(right === "./ui/layers.css") - Number(left === "./ui/layers.css"));
for (const entry of [...optionalPeerEntries, ...configurationEntries]) {
  if (!(entry in (manifest.exports ?? {})))
    throw new Error(`foldworks no longer exports ${entry}.`);
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "foldworks-pack-check-"));
const consumerDirectory = join(temporaryRoot, "consumer");

const writeEntrypointSmokeTest = (entries) => {
  const imports = entries.map(
    (entry, index) => `import * as Module${index} from "foldworks${entry.slice(1)}";`,
  );
  return writeFile(
    join(consumerDirectory, "src", "main.ts"),
    `${styleEntries.map((entry) => `import "foldworks${entry.slice(1)}";`).join("\n")}

${imports.join("\n")}
import { ReviewThreads } from "foldworks/review";

console.log(ReviewThreads.init({ id: "consumer-review" }).id);
const modules = [${entries.map((_entry, index) => `Module${index}`).join(", ")}];
const app = document.querySelector<HTMLElement>("#app");
if (app === null) throw new Error("Missing smoke-test mount point.");
app.textContent = "Loaded " + modules.reduce((count, module) => count + Object.keys(module).length, 0) + " Foldworks exports";
`,
  );
};

const assertBuiltAssets = async (outDir) => {
  await stat(join(consumerDirectory, outDir, "index.html"));
  const builtAssets = await readdir(join(consumerDirectory, outDir, "assets"));
  if (!builtAssets.some((file) => file.endsWith(".js"))) {
    throw new Error("The clean consumer build did not emit JavaScript.");
  }
  if (!builtAssets.some((file) => file.endsWith(".css"))) {
    throw new Error("The clean consumer build did not emit CSS.");
  }
};

try {
  const archivePath = join(temporaryRoot, `foldworks-${manifest.version}.tgz`);
  // The caller builds the package once through Turbo. Skip lifecycle scripts
  // here so the tarball consumes that verified output instead of rebuilding
  // through prepack.
  await run("pnpm", ["pack", "--out", archivePath], {
    cwd: packageDirectory,
    env: { npm_config_ignore_scripts: "true" },
  });

  const { stdout: listing } = await run("tar", ["-tzf", archivePath], { capture: true });
  const entries = listing.trim().split("\n");
  const required = [
    "package/package.json",
    "package/README.md",
    "package/LICENSE",
    ...collectExportTargets(manifest.exports)
      .filter((target) => target.startsWith("./"))
      .map((target) => `package/${target.slice(2)}`),
  ];
  for (const expected of required) {
    if (!entries.includes(expected)) throw new Error(`The tarball is missing ${expected}.`);
  }

  const forbidden = entries.filter(
    (entry) =>
      entry.startsWith("package/src/") ||
      /(?:^|\/)(?:[^/]+\.)?(?:test|spec)\.[^/]+$/.test(entry) ||
      entry === "package/tsconfig.json" ||
      entry.includes("vitest.config"),
  );
  if (forbidden.length > 0) {
    throw new Error(`The tarball contains development files:\n${forbidden.join("\n")}`);
  }

  const { stdout: packedManifestJson } = await run(
    "tar",
    ["-xOzf", archivePath, "package/package.json"],
    { capture: true },
  );
  const packedManifest = JSON.parse(packedManifestJson);
  for (const name of [
    ...Object.keys(sharedRuntimeVersions),
    ...Object.keys(optionalPeerVersions),
  ]) {
    if (name in (packedManifest.dependencies ?? {})) {
      throw new Error(`foldworks must declare ${name} as a peer, not a dependency.`);
    }
    if (!(name in (packedManifest.peerDependencies ?? {}))) {
      throw new Error(`foldworks must declare ${name} as a peer.`);
    }
    if (!(name in (packedManifest.devDependencies ?? {}))) {
      throw new Error(`foldworks needs ${name} as a dev dependency to build against.`);
    }
  }
  const optionalPeers = Object.entries(packedManifest.peerDependenciesMeta ?? {})
    .filter(([, meta]) => meta?.optional === true)
    .map(([name]) => name)
    .sort();
  if (optionalPeers.join() !== Object.keys(optionalPeerVersions).sort().join()) {
    throw new Error(
      `Optional peers changed to ${optionalPeers.join(", ")}; update scripts/check-packages.mjs.`,
    );
  }
  const packedDependencySpecs = Object.values({
    ...packedManifest.dependencies,
    ...packedManifest.optionalDependencies,
    ...packedManifest.peerDependencies,
  });
  const unresolvedSpec = packedDependencySpecs.find(
    (spec) =>
      typeof spec === "string" && (spec.startsWith("workspace:") || spec.startsWith("catalog:")),
  );
  if (unresolvedSpec !== undefined) {
    throw new Error(`foldworks contains an unresolved dependency specifier: ${unresolvedSpec}`);
  }

  await mkdir(join(consumerDirectory, "src"), { recursive: true });
  await writeFile(
    join(consumerDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: "foldworks-package-smoke-test",
        private: true,
        type: "module",
        scripts: { build: "vite build", test: "vitest run", typecheck: "tsc --noEmit" },
        dependencies: {
          ...sharedRuntimeVersions,
          "@effect/platform-browser": "4.1.1",
          foldworks: `file:${archivePath}`,
        },
        devDependencies: {
          "@stylexjs/unplugin": "0.19.0",
          typescript: "6.0.3",
          vite: "8.2.2",
          vitest: "5.0.3",
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(consumerDirectory, "index.html"),
    '<!doctype html><html><body><main id="app"></main><script type="module" src="/src/main.ts"></script></body></html>\n',
  );
  await writeFile(
    join(consumerDirectory, "vite.config.ts"),
    `import { foldworksLayers } from "foldworks/ui/vite";
import stylex from "@stylexjs/unplugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [stylex.vite({ runtimeInjection: false, useCSSLayers: { before: foldworksLayers } }), {
    name: "native-editor-isolation",
    generateBundle(_options, bundle) {
      if (process.env.FOLDWORKS_NATIVE_SMOKE !== "1") return;
      for (const output of Object.values(bundle)) {
        if (output.type === "chunk" && Object.keys(output.modules).some((id) => /@codemirror|@lezer|monaco-editor|[/]yaml[/]/.test(id))) {
          this.error("The core native editor imports an external engine or the optional YAML parser.");
        }
      }
    },
  }],
});
`,
  );
  await writeFile(
    join(consumerDirectory, "tsconfig.json"),
    `${JSON.stringify(
      {
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
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(join(consumerDirectory, "src", "env.d.ts"), 'declare module "*.css";\n');

  // Views from the installed package must render under Vitest without the
  // StyleX compiler, which is the setup `foldworks/ui/vite` documents.
  await writeFile(
    join(consumerDirectory, "vitest.config.ts"),
    `import { foldworksStylexTest } from "foldworks/ui/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({ plugins: [foldworksStylexTest()] });
`,
  );
  await writeFile(
    join(consumerDirectory, "src", "view.test.ts"),
    `import * as stylex from "@stylexjs/stylex";
import { Button, sxAttrs } from "foldworks/ui";
import { Option } from "effect";
import { inertHtml as h } from "foldkit/html";
import { Scene } from "foldkit/test";
import { expect, it } from "vitest";

const styles = stylex.create({ action: { marginInline: "auto" } });

it("renders Foldworks and application StyleX in a view test", () => {
  const html = Button.view({ label: "Save", sx: styles.action }, h);
  if (html === null) throw new Error("Expected a button");
  const button = Option.getOrThrow(Scene.find(html, "button"));
  expect(Option.getOrThrow(Scene.attr(button, "class"))).toContain("action");
  expect(sxAttrs(h, styles.action)).toHaveLength(1);
});
`,
  );

  // Without the optional peers installed, every other entry must type-check,
  // test, and bundle.
  await writeEntrypointSmokeTest(scriptEntries.filter((entry) => !optionalPeerEntries.has(entry)));
  await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], {
    cwd: consumerDirectory,
  });
  await run("npm", ["run", "typecheck"], { cwd: consumerDirectory });
  await run("npm", ["run", "test"], { cwd: consumerDirectory });
  await run("npm", ["run", "build", "--", "--outDir", "dist-core"], { cwd: consumerDirectory });
  await assertBuiltAssets("dist-core");

  // With the optional peers installed, every entry builds together.
  await run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...Object.entries(optionalPeerVersions).map(([name, version]) => `${name}@${version}`),
    ],
    { cwd: consumerDirectory },
  );
  await writeEntrypointSmokeTest(scriptEntries);
  await run("npm", ["run", "typecheck"], { cwd: consumerDirectory });
  await run("npm", ["run", "build"], { cwd: consumerDirectory });
  await assertBuiltAssets("dist");

  // Check the default editor bundle independently of the other modules.
  await writeFile(
    join(consumerDirectory, "src", "main.ts"),
    `
import { CodeEditor } from "foldworks/code-editor";
import "foldworks/code-editor/styles.css";
document.querySelector("#app")!.textContent = Object.keys(CodeEditor).join(", ");
`,
  );
  await run("npm", ["run", "build", "--", "--outDir", "dist-native"], {
    cwd: consumerDirectory,
    env: { FOLDWORKS_NATIVE_SMOKE: "1" },
  });
  await run(
    "node",
    [
      "--input-type=module",
      "-e",
      'import { CodeEditor } from "foldworks/code-editor"; if (CodeEditor.init({ id: "ssr", text: "ok" }).document.text !== "ok") throw new Error("Editor import failed");',
    ],
    { cwd: consumerDirectory },
  );
  await run(
    "node",
    [
      "--input-type=module",
      "-e",
      `
import { Schema as S } from "effect";
import { CodeEditor } from "foldworks/code-editor";
import { withSchema } from "foldworks/code-editor/structured";
const editor = withSchema(CodeEditor.implementation, S.Struct({ enabled: S.Boolean }));
for (const [languageId, text] of [["yaml", "enabled: true"], ["json", '{"enabled":true}']]) {
  const model = editor.init({ id: "ssr", languageId, text });
  if (model.diagnostics.some(batch => batch.diagnostics.length)) throw new Error("Schema editor import failed");
}
`,
    ],
    { cwd: consumerDirectory },
  );

  console.log(
    `\nValidated the foldworks tarball, a clean Vite and Vitest consumer with and without optional peers, and native-editor bundle isolation.`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
