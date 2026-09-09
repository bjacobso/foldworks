import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const documents = new Map([
  ["/docs/ui/setup.md", resolve(import.meta.dirname, "../../packages/ui/README.md")],
  ["/docs/ui/stateful.md", resolve(import.meta.dirname, "../../packages/ui/docs/stateful.md")],
  ["/docs/ui/capabilities.md", resolve(import.meta.dirname, "../../packages/ui/docs/capabilities.md")],
]);
const index = `# Foldworks UI

> UI components for Foldkit applications using StyleX. Stateful components use Foldkit models and messages.

- [Setup and themes](/docs/ui/setup.md)
- [Stateful integration and examples](/docs/ui/stateful.md)
- [Component capabilities and limitations](/docs/ui/capabilities.md)

Use Stateful.Tabs, Stateful.Dialog, Stateful.Select, and Stateful.Command for managed interactions.
Forward child updates and commands with Update.foldChild. Check capabilities before assuming behavioral parity.
`;

const readDocument = async (path: string, source: string): Promise<string> => {
  const markdown = await readFile(source, "utf8");
  // The package README lives one level above docs; its published Markdown twin does not.
  return path === "/docs/ui/setup.md" ? markdown.replaceAll(
    "](docs/", "](",
  ) : markdown;
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
        response.setHeader("Content-Type", source === undefined ? "text/plain; charset=utf-8" : "text/markdown; charset=utf-8");
        response.end(source === undefined ? index : await readDocument(path, source));
      } catch (error) { next(error); }
    });
  },
  async generateBundle() {
    this.emitFile({ type: "asset", fileName: "llms.txt", source: index });
    for (const [path, source] of documents) {
      this.emitFile({ type: "asset", fileName: path.slice(1), source: await readDocument(path, source) });
    }
  },
});
