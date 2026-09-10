import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import type { Root } from "mdast";
import { ensureDocument } from "./editing";
import {
  block,
  normalizeRuns,
  plainText,
  safeUrl,
  text,
  validateDocument,
  type Block,
  type Document,
  type Mark,
  type Registry,
  type Run,
} from "./document";

/** Structural AST subset shared by remark's standard and directive nodes. */
interface Ast {
  type: string;
  children?: Ast[];
  value?: string;
  depth?: number;
  ordered?: boolean;
  start?: number;
  checked?: boolean | null;
  url?: string;
  title?: string | null;
  lang?: string | null;
  name?: string;
  attributes?: Record<string, string | null | undefined>;
}
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);
const writer = unified()
  .use(remarkStringify, { bullet: "-", fences: true, listItemIndent: "one" })
  .use(remarkGfm)
  .use(remarkDirective);
export type CodecResult<T> = Readonly<{
  value?: T;
  diagnostics: ReadonlyArray<string>;
}>;

export const importMarkdown = (
  source: string,
  registry: Registry,
): CodecResult<Document> => {
  if (source.length > 1000000)
    return { diagnostics: ["Markdown exceeds the 1 MB limit."] };
  const diagnostics: string[] = [];
  let id = 0;
  const allocate = () => `md-${++id}`;
  const inline = (
    nodes: Ast[],
    marks: ReadonlyArray<Mark> = [],
  ): ReadonlyArray<Run> =>
    normalizeRuns(
      nodes.flatMap((node) => {
        if (node.type === "text") return [text(node.value ?? "", marks)];
        if (node.type === "break") return [text("\n", marks)];
        if (node.type === "inlineCode")
          return [
            text(node.value ?? "", [...marks, { type: "code", value: "" }]),
          ];
        const type = (
          {
            strong: "bold",
            emphasis: "italic",
            delete: "strike",
            link: "link",
          } as Readonly<Record<string, Mark["type"]>>
        )[node.type];
        if (type) {
          if (type === "link" && !safeUrl(node.url ?? ""))
            diagnostics.push("Unsupported link protocol.");
          return inline(node.children ?? [], [
            ...marks,
            { type, value: type === "link" ? (node.url ?? "") : "" },
          ]);
        }
        diagnostics.push(
          `Unsupported Markdown inline node: ${node.type}. Import cancelled.`,
        );
        return [];
      }),
    );
  const blocks = (nodes: Ast[], depth = 0): ReadonlyArray<Block> => {
    if (depth > 20) {
      diagnostics.push("Markdown nesting exceeds 20 levels.");
      return [];
    }
    return nodes.map((node) => {
      const children = () => blocks(node.children ?? [], depth + 1);
      switch (node.type) {
        case "paragraph":
          return block(allocate(), "paragraph", inline(node.children ?? []));
        case "heading":
          return block(allocate(), "heading", inline(node.children ?? []), {
            level: String(node.depth),
          });
        case "code":
          return block(allocate(), "codeBlock", [text(node.value ?? "")], {
            language: node.lang ?? "",
          });
        case "blockquote":
          return block(allocate(), "blockquote", [], {}, children());
        case "thematicBreak":
          return block(allocate(), "rule");
        case "list":
          return block(
            allocate(),
            node.ordered
              ? "orderedList"
              : node.children?.some(
                    (child) => typeof child.checked === "boolean",
                  )
                ? "taskList"
                : "bulletList",
            [],
            { start: String(node.start ?? 1) },
            children(),
          );
        case "listItem":
          return block(
            allocate(),
            "listItem",
            [],
            { checked: String(node.checked ?? false) },
            children(),
          );
        case "containerDirective":
        case "leafDirective": {
          const name = node.name?.replace(/^foldworks-/, "") ?? "";
          const definition = registry.get(name);
          if (
            !node.name?.startsWith("foldworks-") ||
            !definition ||
            node.attributes?.version !== "1"
          ) {
            diagnostics.push(
              `Unknown or unsupported directive: ${node.name}. Import cancelled.`,
            );
            return block(allocate());
          }
          const attrs = Object.fromEntries(
            Object.entries(node.attributes ?? {})
              .filter(([key]) => key !== "version")
              .map(([key, value]) => [key, value ?? ""]),
          );
          if (definition.kind === "text") {
            const paragraphs = node.children ?? [];
            if (
              paragraphs.some((child) => child.type !== "paragraph") ||
              paragraphs.length > 1
            )
              diagnostics.push(
                `Custom text block ${name} requires a single paragraph.`,
              );
            return block(
              allocate(),
              name,
              inline(paragraphs[0]?.children ?? []),
              { ...definition.defaults, ...attrs },
            );
          }
          const nested = definition.kind === "container" ? children() : [];
          return block(
            allocate(),
            name,
            [],
            { ...definition.defaults, ...attrs },
            definition.kind === "container" && !nested.length
              ? [block(allocate())]
              : nested,
          );
        }
        default:
          diagnostics.push(
            `Unsupported Markdown block: ${node.type}. Import cancelled.`,
          );
          return block(allocate());
      }
    });
  };
  try {
    const ast = parser.parse(source) as unknown as Ast;
    const parsed = blocks(ast.children ?? []);
    const value: Document = ensureDocument(
      {
        version: 1,
        blocks: parsed.length ? parsed : [block(allocate())],
      },
      registry,
      allocate,
    );
    const error = validateDocument(value, registry);
    if (error) diagnostics.push(error);
    return diagnostics.length ? { diagnostics } : { value, diagnostics };
  } catch (error) {
    return {
      diagnostics: [
        error instanceof Error ? error.message : "Could not parse Markdown.",
      ],
    };
  }
};

export const exportMarkdown = (
  document: Document,
  registry: Registry,
  mode: "foldworks" | "portable" = "foldworks",
  allowLoss = false,
): CodecResult<string> => {
  const diagnostics: string[] = [];
  const inline = (runs: ReadonlyArray<Run>): Ast[] =>
    runs.flatMap((run) =>
      run.text.split("\n").flatMap((value, index) => {
        let node: Ast = {
          type: run.marks.some((mark) => mark.type === "code")
            ? "inlineCode"
            : "text",
          value,
        };
        for (const mark of [...run.marks].reverse()) {
          if (mark.type !== "code")
            node = {
              type: (
                {
                  bold: "strong",
                  italic: "emphasis",
                  strike: "delete",
                  link: "link",
                } as const
              )[mark.type],
              children: [node],
              ...(mark.type === "link" ? { url: mark.value } : {}),
            };
        }
        return [...(index ? [{ type: "break" }] : []), node];
      }),
    );
  const blocks = (nodes: ReadonlyArray<Block>): Ast[] =>
    nodes.map((node) => {
      switch (node.type) {
        case "paragraph":
          return { type: "paragraph", children: inline(node.content) };
        case "heading":
          return {
            type: "heading",
            depth: Number(node.attrs.level),
            children: inline(node.content),
          };
        case "codeBlock":
          return {
            type: "code",
            lang: node.attrs.language || null,
            value: plainText(node),
          };
        case "blockquote":
          return { type: "blockquote", children: blocks(node.children) };
        case "rule":
          return { type: "thematicBreak" };
        case "bulletList":
        case "orderedList":
        case "taskList":
          return {
            type: "list",
            ordered: node.type === "orderedList",
            start: Number(node.attrs.start ?? 1),
            children: node.children.map((item) => ({
              type: "listItem",
              checked:
                node.type === "taskList" ? item.attrs.checked === "true" : null,
              children: blocks(item.children),
            })),
          };
        default: {
          const definition = registry.get(node.type);
          if (!definition) {
            diagnostics.push(`Unknown block ${node.type}.`);
            return { type: "paragraph", children: [] };
          }
          if (mode === "portable") {
            diagnostics.push(
              `${definition.label}: custom attributes are not representable in portable Markdown.`,
            );
            return definition.kind === "container"
              ? { type: "blockquote", children: blocks(node.children) }
              : {
                  type: "paragraph",
                  children: [
                    {
                      type: "text",
                      value:
                        definition.portable?.(node) ??
                        node.attrs.label ??
                        definition.label,
                    },
                  ],
                };
          }
          return {
            type:
              definition.kind === "atom"
                ? "leafDirective"
                : "containerDirective",
            name: `foldworks-${node.type}`,
            attributes: { ...node.attrs, version: "1" },
            children:
              definition.kind === "text"
                ? [{ type: "paragraph", children: inline(node.content) }]
                : blocks(node.children),
          };
        }
      }
    });
  try {
    const error = validateDocument(document, registry);
    if (error) return { diagnostics: [error] };
    const ast = { type: "root", children: blocks(document.blocks) };
    if (diagnostics.length && !allowLoss) return { diagnostics };
    return { value: writer.stringify(ast as unknown as Root), diagnostics };
  } catch (error) {
    return {
      diagnostics: [
        error instanceof Error ? error.message : "Could not export Markdown.",
      ],
    };
  }
};
