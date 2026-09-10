import { Effect, Schema as S } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { Command, type Update } from "foldkit";
import * as File from "foldkit/file";
import {
  Block,
  Document,
  Mark,
  Run,
  Selection,
  block,
  caret,
  clampSelection,
  collapsed,
  createRegistry,
  find,
  leaves,
  normalizeRuns,
  plainText,
  safeUrl,
  sliceRuns,
  updateBlock,
  validateDocument,
  type Registry,
} from "./document";
import {
  allocator,
  convert,
  createBlock,
  deleteText,
  ensureDocument,
  indentList,
  moveBlock,
  replaceRange,
  split,
  toggleMark,
  topBlock,
  type Edit,
} from "./editing";
import { exportMarkdown, importMarkdown } from "./markdown";

const Snapshot = S.Struct({
  document: Document,
  selection: Selection,
  storedMarks: S.Array(Mark),
  explicitMarks: S.Boolean,
});
type Snapshot = typeof Snapshot.Type;
export const Model = S.Struct({
  id: S.String,
  document: Document,
  selection: Selection,
  storedMarks: S.Array(Mark),
  explicitMarks: S.Boolean,
  past: S.Array(Snapshot),
  future: S.Array(Snapshot),
  revision: S.Number,
  lastInputAt: S.Number,
  group: S.String,
  editable: S.Boolean,
  sourceOpen: S.Boolean,
  source: S.String,
  sourceRevision: S.Number,
  exportText: S.String,
  diagnostics: S.Array(S.String),
  announcement: S.String,
  slashOpen: S.Boolean,
  linkOpen: S.Boolean,
  linkValue: S.String,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Selected: { selection: Selection },
  Input: {
    kind: S.Literals(["text", "backward", "forward", "split", "break"]),
    value: S.String,
    selection: Selection,
    time: S.Number,
    baseRevision: S.Number,
  },
  Reconciled: {
    id: S.String,
    content: S.Array(Run),
    selection: Selection,
    baseRevision: S.Number,
    time: S.Number,
  },
  Format: { type: Mark.fields.type },
  Convert: { type: S.String },
  Indent: { outdent: S.Boolean },
  Insert: { type: S.String },
  Attributes: { id: S.String, key: S.String, value: S.String },
  Move: { id: S.String, direction: S.Literals(["up", "down"]) },
  Drop: { id: S.String, target: S.String, before: S.Boolean },
  Duplicate: { id: S.String },
  DeleteBlock: { id: S.String },
  Undo: {},
  Redo: {},
  ToggleSource: {},
  CancelSource: {},
  ApplySource: {},
  ChangedSource: { value: S.String },
  Files: { files: S.Array(File.File) },
  Imported: { value: S.String, expectedRevision: S.Number },
  Export: { portable: S.Boolean },
  ToggleEditable: {},
  ToggleSlash: {},
  ChangedLink: { value: S.String },
  ApplyLink: {},
  CancelLink: {},
  Load: { document: Document, expectedRevision: S.Number },
  Failed: { reason: S.String },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Changed: { document: Document, revision: S.Number },
});
export type OutMessage = typeof OutMessage.Type;

export type InitConfig = Readonly<{
  id: string;
  document?: Document;
  markdown?: string;
  editable?: boolean;
}>;
export const init = (
  config: InitConfig,
  registry: Registry = createRegistry(),
): Model => {
  const imported =
    config.markdown === undefined
      ? undefined
      : importMarkdown(config.markdown, registry);
  let document = config.document ??
    imported?.value ?? {
      version: 1 as const,
      blocks: [block(`${config.id}-1`)],
    };
  const error = validateDocument(document, registry);
  if (error) throw new Error(error);
  document = ensureDocument(
    document,
    registry,
    allocator(document, `${config.id}-empty`),
  );
  return {
    id: config.id,
    document,
    selection: caret(
      leaves(document).find((node) => registry.get(node.type)?.kind === "text")!
        .id,
    ),
    storedMarks: [],
    explicitMarks: false,
    past: [],
    future: [],
    revision: 0,
    lastInputAt: 0,
    group: "",
    editable: config.editable ?? true,
    sourceOpen: false,
    source: "",
    sourceRevision: 0,
    exportText: "",
    diagnostics: imported?.diagnostics ?? [],
    announcement: "Editor ready.",
    slashOpen: false,
    linkOpen: false,
    linkValue: "",
  };
};
const snapshot = (model: Model): Snapshot => ({
  document: model.document,
  selection: model.selection,
  storedMarks: model.storedMarks,
  explicitMarks: model.explicitMarks,
});
const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
const commit = (
  model: Model,
  edit: Edit,
  registry: Registry,
  announcement = "Document changed.",
  group = "",
  time = 0,
): Model => {
  const error = validateDocument(edit.document, registry);
  if (error) return { ...model, diagnostics: [error], announcement: error };
  if (same(model.document, edit.document))
    return {
      ...model,
      selection: clampSelection(model.document, edit.selection),
    };
  const coalesce =
    group !== "" && model.group === group && time - model.lastInputAt < 1000;
  return {
    ...model,
    ...edit,
    selection: clampSelection(edit.document, edit.selection),
    past: coalesce ? model.past : [...model.past, snapshot(model)].slice(-100),
    future: [],
    revision: model.revision + 1,
    group,
    lastInputAt: time,
    diagnostics: [],
    announcement,
    exportText: "",
  };
};
export const activeMarks = (model: Model): ReadonlyArray<Mark> => {
  if (model.explicitMarks) return model.storedMarks;
  const node = find(model.document, model.selection.anchor.id);
  return node
    ? (sliceRuns(
        node.content,
        Math.max(0, model.selection.anchor.offset - 1),
        Math.max(1, model.selection.anchor.offset),
      )[0]?.marks ?? [])
    : [];
};
export const reduce = (
  model: Model,
  message: Message,
  registry: Registry,
): Model => {
  const allocate = allocator(
    model.document,
    `${model.id}-${model.revision + 1}`,
  );
  const edit = (result: Edit, announcement?: string) =>
    commit(model, result, registry, announcement);
  const allowedReadonly = [
    "Selected",
    "ToggleEditable",
    "Export",
    "Load",
    "Failed",
    "CancelSource",
    "CancelLink",
  ];
  if (!model.editable && !allowedReadonly.includes(message._tag)) return model;
  switch (message._tag) {
    case "Selected": {
      const selection = clampSelection(model.document, message.selection);
      return same(selection, model.selection)
        ? model
        : {
            ...model,
            selection,
            storedMarks: [],
            explicitMarks: false,
            group: "",
          };
    }
    case "Input": {
      if (message.baseRevision !== model.revision)
        return {
          ...model,
          diagnostics: [
            "Input arrived for an older document revision. Current content retained.",
          ],
        };
      const selection = clampSelection(model.document, message.selection);
      const base = {
        ...model,
        selection,
        group: collapsed(selection) ? model.group : "",
      };
      const marks =
        find(model.document, selection.anchor.id)?.type === "codeBlock"
          ? []
          : activeMarks(base);
      let result: Edit;
      if (message.kind === "text" || message.kind === "break")
        result = replaceRange(
          model.document,
          selection,
          message.kind === "break" ? "\n" : message.value,
          marks,
          registry,
          allocate,
        );
      else if (message.kind === "split")
        result = split(model.document, selection, registry, allocate);
      else
        result = deleteText(
          model.document,
          selection,
          message.kind === "backward",
          registry,
          allocate,
        );
      const editedNode = find(result.document, result.selection.anchor.id);
      if (
        message.kind === "text" &&
        message.value === " " &&
        editedNode?.type === "paragraph"
      ) {
        const prefix = plainText(editedNode);
        const heading = /^(#{1,6}) $/.exec(prefix);
        const type = heading
          ? "heading"
          : prefix === "> "
            ? "blockquote"
            : /^[-*] $/.test(prefix)
              ? "bulletList"
              : /^1\. $/.test(prefix)
                ? "orderedList"
                : /^\[ \] $/.test(prefix)
                  ? "taskList"
                  : undefined;
        if (type) {
          const cleared = updateBlock(
            result.document,
            editedNode.id,
            (node) => ({ ...node, content: [] }),
          );
          result = convert(
            cleared,
            caret(editedNode.id),
            type,
            registry,
            allocate,
          );
          if (heading)
            result = {
              ...result,
              document: updateBlock(
                result.document,
                result.selection.anchor.id,
                (node) => ({
                  ...node,
                  attrs: { level: String(heading[1]!.length) },
                }),
              ),
            };
        }
      }
      let next = commit(
        base,
        result,
        registry,
        "",
        message.kind === "text" ? `typing:${result.selection.anchor.id}` : "",
        message.time,
      );
      // Slash insertion uses a separate command menu; the slash itself is ordinary text until selected.
      const node = find(next.document, next.selection.anchor.id);
      next = {
        ...next,
        slashOpen:
          node?.type !== "codeBlock" &&
          plainText(node ?? block("empty")).startsWith("/") &&
          collapsed(next.selection),
      };
      return next;
    }
    case "Reconciled": {
      if (message.baseRevision !== model.revision)
        return {
          ...model,
          diagnostics: [
            "Native edit conflicted with a newer change. Current document retained.",
          ],
        };
      const document = updateBlock(model.document, message.id, (node) => ({
        ...node,
        content: normalizeRuns(message.content),
      }));
      return commit(
        model,
        { document, selection: message.selection },
        registry,
        "",
        "",
        message.time,
      );
    }
    case "Format": {
      if (message.type === "link")
        return {
          ...model,
          linkOpen: !model.linkOpen,
          linkValue:
            activeMarks(model).find((mark) => mark.type === "link")?.value ??
            "",
        };
      const mark: Mark = { type: message.type, value: "" };
      if (collapsed(model.selection)) {
        const marks = activeMarks(model);
        return {
          ...model,
          storedMarks: marks.some((m) => m.type === mark.type)
            ? marks.filter((m) => m.type !== mark.type)
            : mark.type === "code"
              ? [mark]
              : [...marks.filter((m) => m.type !== "code"), mark],
          explicitMarks: true,
          group: "",
        };
      }
      return edit({
        document: toggleMark(model.document, model.selection, mark),
        selection: model.selection,
      });
    }
    case "ChangedLink":
      return { ...model, linkValue: message.value };
    case "CancelLink":
      return { ...model, linkOpen: false };
    case "ApplyLink": {
      if (!safeUrl(model.linkValue))
        return {
          ...model,
          diagnostics: [
            "Use an https://, http://, mailto:, /path, or #anchor link.",
          ],
        };
      const mark: Mark = { type: "link", value: model.linkValue };
      if (collapsed(model.selection))
        return {
          ...model,
          storedMarks: [
            ...activeMarks(model).filter((m) => m.type !== "link"),
            mark,
          ],
          explicitMarks: true,
          linkOpen: false,
        };
      return {
        ...edit({
          document: toggleMark(model.document, model.selection, mark),
          selection: model.selection,
        }),
        linkOpen: false,
      };
    }
    case "Convert":
      return edit(
        convert(
          model.document,
          model.selection,
          message.type,
          registry,
          allocate,
        ),
      );
    case "Indent":
      return edit(
        indentList(model.document, model.selection, message.outdent, allocate),
      );
    case "Insert": {
      if (!registry.has(message.type)) return model;
      const selected = find(model.document, model.selection.anchor.id);
      if (model.slashOpen && selected && plainText(selected).startsWith("/")) {
        const cleared = updateBlock(model.document, selected.id, (node) => ({
          ...node,
          content: [],
        }));
        return {
          ...edit(
            convert(
              cleared,
              caret(selected.id),
              message.type,
              registry,
              allocate,
            ),
          ),
          slashOpen: false,
        };
      }
      const current = topBlock(model.document, model.selection.anchor.id);
      const index = current
        ? model.document.blocks.indexOf(current) + 1
        : model.document.blocks.length;
      const node = createBlock(message.type, registry, allocate);
      const extra =
        registry.get(node.type)?.kind === "atom" ? [block(allocate())] : [];
      const document: Document = {
        version: 1,
        blocks: [
          ...model.document.blocks.slice(0, index),
          node,
          ...extra,
          ...model.document.blocks.slice(index),
        ],
      };
      const target = extra[0] ?? leaves({ version: 1, blocks: [node] })[0]!;
      return {
        ...edit(
          { document, selection: caret(target.id) },
          `${registry.get(node.type)?.label} inserted.`,
        ),
        slashOpen: false,
      };
    }
    case "Attributes":
      return edit({
        document: updateBlock(model.document, message.id, (node) => ({
          ...node,
          attrs: { ...node.attrs, [message.key]: message.value },
        })),
        selection: model.selection,
      });
    case "Move": {
      const index = model.document.blocks.findIndex(
        (node) => node.id === message.id,
      );
      const target =
        model.document.blocks[index + (message.direction === "up" ? -1 : 1)];
      return target
        ? edit(
            {
              document: moveBlock(
                model.document,
                message.id,
                target.id,
                message.direction === "up",
              ),
              selection: model.selection,
            },
            `Block moved ${message.direction}.`,
          )
        : model;
    }
    case "Drop":
      return edit(
        {
          document: moveBlock(
            model.document,
            message.id,
            message.target,
            message.before,
          ),
          selection: model.selection,
        },
        "Block moved.",
      );
    case "Duplicate": {
      const index = model.document.blocks.findIndex(
        (node) => node.id === message.id,
      );
      const original = model.document.blocks[index];
      if (!original) return model;
      const clone = (node: Block): Block => ({
        ...node,
        id: allocate(),
        children: node.children.map(clone),
      });
      const copy = clone(original);
      const document: Document = {
        version: 1,
        blocks: [
          ...model.document.blocks.slice(0, index + 1),
          copy,
          ...model.document.blocks.slice(index + 1),
        ],
      };
      return edit(
        {
          document,
          selection: caret(leaves({ version: 1, blocks: [copy] })[0]!.id),
        },
        "Block duplicated.",
      );
    }
    case "DeleteBlock":
      return edit(
        {
          document: ensureDocument(
            {
              version: 1,
              blocks: model.document.blocks.filter(
                (node) => node.id !== message.id,
              ),
            },
            registry,
            allocate,
          ),
          selection: model.selection,
        },
        "Block deleted.",
      );
    case "Undo":
    case "Redo": {
      const undo = message._tag === "Undo";
      const value = undo ? model.past.at(-1) : model.future[0];
      return value
        ? {
            ...model,
            ...value,
            past: undo
              ? model.past.slice(0, -1)
              : [...model.past, snapshot(model)],
            future: undo
              ? [snapshot(model), ...model.future]
              : model.future.slice(1),
            revision: model.revision + 1,
            group: "",
            announcement: undo ? "Undone." : "Redone.",
            exportText: "",
            slashOpen: false,
          }
        : model;
    }
    case "ToggleSource": {
      if (model.sourceOpen) return { ...model, sourceOpen: false };
      const result = exportMarkdown(model.document, registry);
      return result.value === undefined
        ? { ...model, diagnostics: result.diagnostics }
        : {
            ...model,
            sourceOpen: true,
            source: result.value,
            sourceRevision: model.revision,
            diagnostics: [],
            slashOpen: false,
          };
    }
    case "CancelSource":
      return { ...model, sourceOpen: false, diagnostics: [] };
    case "ChangedSource":
      return { ...model, source: message.value };
    case "ApplySource":
    case "Imported": {
      if (
        message._tag === "Imported" &&
        message.expectedRevision !== model.revision
      )
        return {
          ...model,
          diagnostics: [
            "Import cancelled because the document changed while the file was loading.",
          ],
        };
      if (
        message._tag === "ApplySource" &&
        model.sourceRevision !== model.revision
      )
        return {
          ...model,
          diagnostics: [
            "The document changed while source was open. Cancel and reopen source to avoid overwriting newer edits.",
          ],
        };
      const result = importMarkdown(
        message._tag === "Imported" ? message.value : model.source,
        registry,
      );
      return result.value
        ? {
            ...edit(
              {
                document: result.value,
                selection: caret(
                  leaves(result.value).find(
                    (node) => registry.get(node.type)?.kind === "text",
                  )!.id,
                ),
              },
              "Markdown applied.",
            ),
            sourceOpen: false,
          }
        : { ...model, diagnostics: result.diagnostics };
    }
    case "Export": {
      const result = exportMarkdown(
        model.document,
        registry,
        message.portable ? "portable" : "foldworks",
        message.portable,
      );
      return {
        ...model,
        exportText: result.value ?? "",
        diagnostics: result.diagnostics,
        announcement: "Markdown export prepared.",
      };
    }
    case "ToggleEditable":
      return {
        ...model,
        editable: !model.editable,
        sourceOpen: false,
        slashOpen: false,
        linkOpen: false,
      };
    case "ToggleSlash":
      return { ...model, slashOpen: !model.slashOpen };
    case "Load": {
      if (model.revision !== message.expectedRevision)
        return {
          ...model,
          diagnostics: ["Load rejected: the document has changed."],
        };
      const error = validateDocument(message.document, registry);
      return error
        ? { ...model, diagnostics: [error] }
        : {
            ...init(
              {
                id: model.id,
                document: message.document,
                editable: model.editable,
              },
              registry,
            ),
            revision: model.revision + 1,
          };
    }
    case "Failed":
      return { ...model, diagnostics: [message.reason] };
    case "Files":
      return model;
  }
};
const ReadFile = Command.define("ReadEditorMarkdown", {
  args: { file: File.File, expectedRevision: S.Number },
  messages: [Message.Imported, Message.Failed],
  execute: ({ file, expectedRevision }) =>
    File.readAsText(file).pipe(
      Effect.map((value) => Message.Imported({ value, expectedRevision })),
      Effect.catch(() =>
        Effect.succeed(
          Message.Failed({ reason: "The Markdown file could not be read." }),
        ),
      ),
    ),
});
export const updateWith =
  (registry: Registry) =>
  (
    model: Model,
    message: Message,
  ): Update.ReturnWithOutMessage<Model, Message, OutMessage> => {
    if (message._tag === "Files" && model.editable) {
      const file = message.files[0];
      if (file && File.size(file) <= 1000000)
        return {
          model,
          commands: [ReadFile({ file, expectedRevision: model.revision })],
        };
      return {
        model: {
          ...model,
          diagnostics: ["Choose a Markdown file smaller than 1 MB."],
        },
      };
    }
    const next = reduce(model, message, registry);
    return {
      model: next,
      ...(next.revision !== model.revision
        ? {
            outMessage: OutMessage.Changed({
              document: next.document,
              revision: next.revision,
            }),
          }
        : {}),
    };
  };
