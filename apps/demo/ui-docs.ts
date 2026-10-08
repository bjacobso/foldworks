import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const documents = new Map([
  ["/docs/README.md", resolve(import.meta.dirname, "../../README.md")],
  ["/docs/ui/desktop.md", resolve(import.meta.dirname, "../../packages/ui/docs/desktop.md")],
  ["/docs/ui/setup.md", resolve(import.meta.dirname, "../../packages/ui/README.md")],
  ["/docs/ui/stateful.md", resolve(import.meta.dirname, "../../packages/ui/docs/stateful.md")],
  [
    "/docs/ui/capabilities.md",
    resolve(import.meta.dirname, "../../packages/ui/docs/capabilities.md"),
  ],
  ["/docs/ui/primitives.md", resolve(import.meta.dirname, "../../packages/ui/docs/primitives.md")],
]);
const index = `# Foldworks

> Pre-1.0 application primitives for Foldkit and StyleX. Install a package with \`pnpm add @foldworks/ui\` and supply its peer dependencies and StyleX transform as described in Setup and themes; try the shipped examples at https://foldworks.dev.

Foldworks includes editors, tables, grids, outlines, diagrams, workflows, PDF surfaces, application chrome, and agent UI. APIs are evolving. The demo's agent and outline orchestration flows are local simulations, with no provider calls or tool side effects.

## Project and package reference

- [Project guide](https://foldworks.dev/docs/README.md): Package overview, compatibility, local setup, and demo applications.
- [Generated source catalog](https://foldworks.dev/docs/manifest.json): JSON reference for every public package and reachable source module, including README guides, declarations, and model/message contracts. Browse it interactively at https://foldworks.dev/docs.

## UI guides

- [Setup and themes](https://foldworks.dev/docs/ui/setup.md): Peer dependencies, StyleX configuration, themes, and testing views.
- [Stateful integration and examples](https://foldworks.dev/docs/ui/stateful.md): Models, messages, commands, and child update integration.
- [Component capabilities and limitations](https://foldworks.dev/docs/ui/capabilities.md): Supported interactions and current limits.
- [Layout and foundational primitives](https://foldworks.dev/docs/ui/primitives.md): Controlled presentation and reusable layout components.
- [Desktop primitives and architecture](https://foldworks.dev/docs/ui/desktop.md): Keyboard commands, application compositions, and package boundaries.

Use Stateful components for managed interactions and root primitives for controlled presentation.
Forward child updates and commands with Update.foldChild. Check capabilities before assuming behavioral parity.
`;

const readDocument = async (path: string, source: string): Promise<string> => {
  const markdown = await readFile(source, "utf8");
  // The project guide's relative links refer to repository files, not site routes.
  if (path === "/docs/README.md") {
    return markdown.replace(
      /\]\((?:\.\/)?((?:packages|apps|docs)\/[^)]+|AGENTS\.md)\)/g,
      "](https://github.com/bjacobso/foldworks/blob/main/$1)",
    );
  }
  // The package README lives one level above docs; its published Markdown twin does not.
  return path === "/docs/ui/setup.md" ? markdown.replaceAll("](docs/", "](") : markdown;
};

/** Publish the package's documentation without maintaining a second copy. */
export const uiDocs = (): Plugin => ({
  name: "foldworks-ui-docs",
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const path = request.url?.split("?")[0] ?? "";
      const source = documents.get(path);
      if (path !== "/llms.txt" && source === undefined) return next();
      try {
        response.setHeader(
          "Content-Type",
          source === undefined ? "text/plain; charset=utf-8" : "text/markdown; charset=utf-8",
        );
        response.end(source === undefined ? index : await readDocument(path, source));
      } catch (error) {
        next(error);
      }
    });
  },
  async generateBundle() {
    this.emitFile({ type: "asset", fileName: "llms.txt", source: index });
    for (const [path, source] of documents) {
      this.emitFile({
        type: "asset",
        fileName: path.slice(1),
        source: await readDocument(path, source),
      });
    }
  },
});
