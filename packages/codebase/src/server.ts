import { watch, type FSWatcher } from "node:fs";
import { readdir } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { basename, resolve } from "node:path";

import { appHtml } from "./app";
import { createSnapshot, readDiff, readHistory } from "./git";
import type { CodebaseConfig, DiffScope, RepositorySnapshot, ResolvedCodebaseConfig } from "./model";
import { normalizeRepositoryPath, readRepositoryFile, repositoryTitle, RepositoryAccessError } from "./repository";

export interface CodebaseServer {
  readonly config: ResolvedCodebaseConfig;
  readonly origin: string;
  close(): Promise<void>;
}

const defaultMaxFileSize = 1024 * 1024;

export const resolveCodebaseConfig = async (config: CodebaseConfig = {}): Promise<ResolvedCodebaseConfig> => {
  const root = resolve(config.root ?? process.cwd());
  const port = config.port ?? 4310;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new Error("Port must be an integer from 0 through 65535.");
  const maxFileSize = config.maxFileSize ?? defaultMaxFileSize;
  if (!Number.isInteger(maxFileSize) || maxFileSize < 1024) throw new Error("maxFileSize must be an integer of at least 1024 bytes.");
  return {
    root,
    title: config.title ?? await repositoryTitle(root),
    baseRef: config.baseRef ?? "origin/main",
    host: config.host ?? "127.0.0.1",
    port,
    maxFileSize,
  };
};

const json = (response: ServerResponse, status: number, value: unknown): void => {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
};

const validateOptionalPath = (config: ResolvedCodebaseConfig, url: URL): string | undefined => {
  const path = url.searchParams.get("path") ?? undefined;
  if (path === undefined) return undefined;
  return normalizeRepositoryPath(config.root, path).relative;
};

const ignoredWatchPath = (path: string): boolean =>
  path.startsWith("node_modules/") || path.includes("/node_modules/") ||
  path.startsWith("dist/") || path.includes("/dist/") ||
  path.startsWith(".context/") || path.startsWith(".git/objects/") || path.startsWith(".git/logs/");

export const startCodebaseServer = async (input: CodebaseConfig = {}): Promise<CodebaseServer> => {
  const config = await resolveCodebaseConfig(input);
  let cachedSnapshot: { readonly value: RepositorySnapshot; readonly at: number } | undefined;
  const clients = new Set<ServerResponse>();
  const watchers: FSWatcher[] = [];
  let changeTimer: NodeJS.Timeout | undefined;

  const snapshot = async (): Promise<RepositorySnapshot> => {
    if (cachedSnapshot !== undefined && Date.now() - cachedSnapshot.at < 350) return cachedSnapshot.value;
    const value = await createSnapshot(config);
    cachedSnapshot = { value, at: Date.now() };
    return value;
  };

  const announceChange = (): void => {
    cachedSnapshot = undefined;
    if (changeTimer !== undefined) clearTimeout(changeTimer);
    changeTimer = setTimeout(() => {
      for (const client of clients) client.write("event: change\ndata: {}\n\n");
    }, 100);
  };

  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "GET") {
        json(response, 405, { error: "The workbench is read-only." });
        return;
      }
      const url = new URL(request.url ?? "/", "http://codebase.local");
      if (url.pathname === "/" || url.pathname === "/index.html") {
        response.writeHead(200, {
          "cache-control": "no-store",
          "content-type": "text/html; charset=utf-8",
          "referrer-policy": "no-referrer",
          "x-content-type-options": "nosniff",
          "x-frame-options": "SAMEORIGIN",
        });
        response.end(appHtml);
        return;
      }
      if (url.pathname === "/api/snapshot") {
        json(response, 200, await snapshot());
        return;
      }
      if (url.pathname === "/api/file") {
        const path = url.searchParams.get("path");
        if (path === null) throw new RepositoryAccessError("A file path is required.", 400);
        json(response, 200, await readRepositoryFile(config, path));
        return;
      }
      if (url.pathname === "/api/diff") {
        const scope = url.searchParams.get("scope") ?? "unstaged";
        if (scope !== "staged" && scope !== "unstaged" && scope !== "branch") {
          throw new RepositoryAccessError("Diff scope must be staged, unstaged, or branch.", 400);
        }
        json(response, 200, await readDiff(config, scope as DiffScope, validateOptionalPath(config, url)));
        return;
      }
      if (url.pathname === "/api/history") {
        json(response, 200, await readHistory(config, validateOptionalPath(config, url)));
        return;
      }
      if (url.pathname === "/api/events") {
        response.writeHead(200, {
          "cache-control": "no-cache, no-transform",
          "connection": "keep-alive",
          "content-type": "text/event-stream",
          "x-accel-buffering": "no",
        });
        response.write("event: ready\ndata: {}\n\n");
        clients.add(response);
        request.on("close", () => clients.delete(response));
        return;
      }
      json(response, 404, { error: "Not found." });
    } catch (error) {
      if (error instanceof RepositoryAccessError) {
        json(response, error.status, { error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      json(response, 500, { error: message });
    }
  });

  const addWatcher = (path: string, recursive: boolean): void => {
    try {
      const watcher = watch(path, { recursive }, (_event, filename) => {
        if (filename !== null && ignoredWatchPath(filename.toString().replaceAll("\\", "/"))) return;
        announceChange();
      });
      watcher.on("error", () => watcher.close());
      watchers.push(watcher);
    } catch {
      // Live events are an enhancement; all API reads still reflect current disk state.
    }
  };
  addWatcher(config.root, false);
  for (const entry of await readdir(config.root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === ".context") continue;
    addWatcher(resolve(config.root, entry.name), entry.name !== ".git");
  }

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolveListen();
    });
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address !== null ? address.port : config.port;
  const displayHost = config.host === "0.0.0.0" || config.host === "::" ? "localhost" : config.host;

  return {
    config: { ...config, port: actualPort },
    origin: `http://${displayHost}:${actualPort}`,
    close: async () => {
      if (changeTimer !== undefined) clearTimeout(changeTimer);
      for (const watcher of watchers) watcher.close();
      for (const client of clients) client.end();
      await new Promise<void>((resolveClose, reject) => server.close((error) => error === undefined ? resolveClose() : reject(error)));
    },
  };
};

export const defaultCodebaseTitle = (root: string): string => basename(resolve(root));
