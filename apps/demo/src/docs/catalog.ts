import type { MarkdownDocumentEncoded } from "@foldkit/markdown";

export type ApiSymbol = Readonly<{
  name: string;
  kind: "type" | "interface" | "class" | "enum" | "function" | "value" | "export";
  description: string;
  signature: string;
  source: string;
  line: number;
}>;
export type Contract = Readonly<{
  name: string;
  kind: "model" | "messages" | "outMessages";
  fields: ReadonlyArray<Readonly<{ name: string; schema: string; description: string }>>;
}>;
export type ModuleDoc = Readonly<{
  id: string;
  path: string;
  symbols: ReadonlyArray<ApiSymbol>;
  contracts: ReadonlyArray<Contract>;
  imports: ReadonlyArray<string>;
}>;
export type PackageDoc = Readonly<{
  id: string;
  name: string;
  version: string;
  description: string;
  readme: MarkdownDocumentEncoded;
  dependencies: ReadonlyArray<string>;
  entrypoints: ReadonlyArray<string>;
  modules: ReadonlyArray<ModuleDoc>;
}>;
export const docsPath = (packageId = "", moduleId = ""): string =>
  `/docs${packageId ? `?package=${encodeURIComponent(packageId)}` : ""}${moduleId ? `&module=${encodeURIComponent(moduleId)}` : ""}`;
export const sourceUrl = (path: string, line?: number): string =>
  `https://github.com/bjacobso/foldworks/blob/main/${path}${line === undefined ? "" : `#L${line}`}`;
