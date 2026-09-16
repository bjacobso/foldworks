import { readFile, stat } from "node:fs/promises";
import { basename, extname, relative, resolve, sep } from "node:path";

import type { FileResult, ResolvedCodebaseConfig } from "./model";

const languages: Readonly<Record<string, string>> = {
  ".css": "css",
  ".go": "go",
  ".html": "html",
  ".java": "java",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".mjs": "javascript",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".sh": "shell",
  ".sql": "sql",
  ".toml": "toml",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
};

export const isRestrictedRepositoryPath = (path: string): boolean =>
  path.split("/").some((part) => part === ".git" || part === "node_modules") ||
  path.split("/").some((part) => part === ".env" || part.startsWith(".env."));

export const normalizeRepositoryPath = (root: string, input: string): { readonly absolute: string; readonly relative: string } => {
  const normalizedInput = input.replaceAll("\\", "/").replace(/^\/+/, "");
  if (normalizedInput.length === 0 || isRestrictedRepositoryPath(normalizedInput)) {
    throw new RepositoryAccessError("That path is not available.", 403);
  }

  const absolute = resolve(root, normalizedInput);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (absolute !== root && !absolute.startsWith(rootPrefix)) {
    throw new RepositoryAccessError("The path must stay inside the repository.", 403);
  }

  return { absolute, relative: relative(root, absolute).replaceAll("\\", "/") };
};

export class RepositoryAccessError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RepositoryAccessError";
    this.status = status;
  }
}

export const readRepositoryFile = async (
  config: ResolvedCodebaseConfig,
  path: string,
): Promise<FileResult> => {
  const resolved = normalizeRepositoryPath(config.root, path);
  const metadata = await stat(resolved.absolute).catch(() => undefined);
  if (metadata === undefined || !metadata.isFile()) {
    throw new RepositoryAccessError("File not found.", 404);
  }
  if (metadata.size > config.maxFileSize) {
    throw new RepositoryAccessError(`File exceeds the ${config.maxFileSize} byte limit.`, 413);
  }

  const bytes = await readFile(resolved.absolute);
  if (bytes.includes(0)) {
    throw new RepositoryAccessError("Binary files are not displayed.", 415);
  }

  return {
    path: resolved.relative,
    language: languages[extname(resolved.relative).toLowerCase()] ?? "text",
    text: bytes.toString("utf8"),
    size: bytes.byteLength,
  };
};

export const repositoryTitle = async (root: string): Promise<string> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
    if (typeof parsed === "object" && parsed !== null && "name" in parsed && typeof parsed.name === "string") {
      return parsed.name;
    }
  } catch {
    // The repository name is a useful, deterministic fallback.
  }
  return basename(root);
};
