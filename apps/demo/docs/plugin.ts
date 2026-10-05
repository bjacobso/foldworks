import { resolve } from "node:path";
import type { Plugin } from "vite";
import { generateCatalog } from "./generate.ts";

const virtualId = "virtual:foldworks-docs";
const resolvedId = "\0" + virtualId;
const root = resolve(import.meta.dirname, "../../..");

/** One generated catalog for development, the website, and downloadable JSON. */
export const moduleDocs = (): Plugin => {
  let pending: ReturnType<typeof generateCatalog> | undefined;
  const catalog = () => (pending ??= generateCatalog(root));
  const invalidate = () => {
    pending = undefined;
  };
  return {
    name: "foldworks-module-docs",
    resolveId: (id) => (id === virtualId ? resolvedId : undefined),
    async load(id) {
      if (id === resolvedId) return `export default ${JSON.stringify(await catalog())};`;
    },
    configureServer(server) {
      const directory = resolve(root, "packages");
      server.watcher.add(directory);
      const refresh = (path: string) => {
        if (
          !path.startsWith(directory + "/") ||
          !/\.(?:ts|md|json)$/.test(path) ||
          path.includes("/dist/")
        )
          return;
        invalidate();
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", refresh).on("add", refresh).on("unlink", refresh);
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split("?")[0] !== "/docs/manifest.json") return next();
        try {
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify(await catalog()));
        } catch (error) {
          next(error);
        }
      });
    },
    async generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "docs/manifest.json",
        source: JSON.stringify(await catalog()),
      });
    },
  };
};
