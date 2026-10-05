import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript-api";
import { encodeDocument } from "@foldkit/markdown";
import { parseMarkdown } from "@foldkit/markdown/vite";
import type { ApiSymbol, Contract, ModuleDoc, PackageDoc } from "../src/docs/catalog.ts";

const portable = (path: string) => path.split(sep).join("/");
const comment = (node: ts.Node, file: ts.SourceFile): string =>
  ts
    .getLeadingCommentRanges(file.text, node.pos)
    ?.map((range) => file.text.slice(range.pos, range.end))
    .filter((text) => text.startsWith("/**"))
    .map((text) =>
      text
        .replace(/^\/\*\*|\*\/$/g, "")
        .replace(/^\s*\* ?/gm, "")
        .trim(),
    )
    .join("\n") ?? "";
const nameOf = (node: ts.PropertyName): string =>
  ts.isStringLiteral(node) ? node.text : node.getText();
const exported = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  !!ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);

/** Extract syntax, never guess reducer behavior from source text. */
export const analyzeModule = (source: string, path: string, id: string): ModuleDoc => {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const symbols: ApiSymbol[] = [];
  const contracts: Contract[] = [];
  const imports: string[] = [];
  const add = (
    name: string,
    kind: ApiSymbol["kind"],
    node: ts.Node,
    signature = node.getText(file),
    docs = node,
  ) => {
    symbols.push({
      name,
      kind,
      signature,
      source: node.getText(file),
      description: comment(docs, file),
      line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
    });
  };
  for (const node of file.statements) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node)) {
      add(node.exportClause?.getText(file) ?? "*", "export", node);
      continue;
    }
    if (!exported(node)) continue;
    if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      add(node.name.text, ts.isTypeAliasDeclaration(node) ? "type" : "interface", node);
    } else if (ts.isClassDeclaration(node) && node.name) {
      add(node.name.text, "class", node);
    } else if (ts.isEnumDeclaration(node)) {
      add(node.name.text, "enum", node);
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      const signature = node.body
        ? source.slice(node.getStart(file), node.body.getStart(file)).trim() + ";"
        : node.getText(file);
      add(node.name.text, "function", node, signature);
    } else if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        const name = declaration.name.getText(file);
        const init = declaration.initializer;
        const callable = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
        const signature = callable
          ? `export const ${source.slice(declaration.getStart(file), init.body.getStart(file)).trim()} …`
          : `export const ${declaration.getText(file)}`;
        add(name, callable ? "function" : "value", declaration, signature, node);
        if (
          !["Model", "Message", "OutMessage"].includes(name) ||
          !init ||
          !ts.isCallExpression(init)
        )
          continue;
        const object = init.arguments[0];
        // Only extract literal Struct/message records; unions and aliases remain visible in API source.
        if (!object || !ts.isObjectLiteralExpression(object)) continue;
        const fields = object.properties.filter(ts.isPropertyAssignment).map((property) => ({
          name: nameOf(property.name),
          schema: property.initializer.getText(file),
          description: comment(property, file),
        }));
        contracts.push({
          name,
          kind: name === "Model" ? "model" : name === "Message" ? "messages" : "outMessages",
          fields,
        });
      }
    }
  }
  return { id, path, symbols, contracts, imports: [...new Set(imports)] };
};

const resolveSource = (base: string, specifier: string): string | undefined => {
  if (!specifier.startsWith(".")) return;
  const stem = resolve(dirname(base), specifier).replace(/\.(?:js|ts)$/, "");
  return [stem + ".ts", resolve(stem, "index.ts")].find(existsSync);
};

/** Follow package export maps and local re-exports, including namespace barrels. */
export const generateCatalog = async (root: string): Promise<ReadonlyArray<PackageDoc>> => {
  const catalog: PackageDoc[] = [];
  for (const entry of (await readdir(resolve(root, "packages"), { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const packageRoot = resolve(root, "packages", entry.name);
    if (!entry.isDirectory() || !existsSync(resolve(packageRoot, "package.json"))) continue;
    const pkg = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8")) as {
      name: string;
      version: string;
      description?: string;
      private?: boolean;
      exports?: Record<string, string | { import?: string; types?: string }>;
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    if (pkg.private || !pkg.name.startsWith("@foldworks/")) continue;
    const modules = new Map<string, ModuleDoc>();
    const visit = async (path: string): Promise<void> => {
      if (modules.has(path)) return;
      const source = await readFile(path, "utf8");
      const id = portable(relative(resolve(packageRoot, "src"), path)).replace(/\.ts$/, "");
      const module = analyzeModule(source, portable(relative(root, path)), id);
      modules.set(path, module);
      const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
      for (const node of ast.statements) {
        if (
          !ts.isExportDeclaration(node) ||
          !node.moduleSpecifier ||
          !ts.isStringLiteral(node.moduleSpecifier)
        )
          continue;
        const target = resolveSource(path, node.moduleSpecifier.text);
        if (target && target.startsWith(packageRoot + sep)) await visit(target);
      }
    };
    const entrypoints: string[] = [];
    for (const [key, target] of Object.entries(pkg.exports ?? {})) {
      const runtime = typeof target === "string" ? target : target.import;
      if (!runtime?.endsWith(".js")) continue;
      const source = resolve(
        packageRoot,
        runtime.replace(/^\.\/dist\//, "src/").replace(/\.js$/, ".ts"),
      );
      if (!existsSync(source)) throw new Error(`Documentation source missing: ${source}`);
      entrypoints.push(key === "." ? pkg.name : pkg.name + key.slice(1));
      await visit(source);
    }
    const readmePath = resolve(packageRoot, "README.md");
    const readme = existsSync(readmePath)
      ? await readFile(readmePath, "utf8")
      : `# ${pkg.name}\n\n${pkg.description ?? ""}`;
    catalog.push({
      id: entry.name,
      name: pkg.name,
      version: pkg.version,
      description: pkg.description ?? "",
      readme: encodeDocument(parseMarkdown(readme)),
      entrypoints,
      dependencies: [
        ...new Set([
          ...Object.keys(pkg.dependencies ?? {}),
          ...Object.keys(pkg.peerDependencies ?? {}),
        ]),
      ].sort(),
      modules: [...modules.values()].sort((a, b) => a.id.localeCompare(b.id)),
    });
  }
  return catalog;
};
