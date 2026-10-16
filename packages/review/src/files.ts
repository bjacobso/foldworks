import { Option, Schema as S } from "effect";
import { Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { Html, HtmlBuilder } from "foldkit/html";
import { Tree } from "@foldworks/ui";
import type { DiffFileStatus } from "@foldworks/diff-viewer";

export type ChangedFile = Readonly<{
  path: string;
  status: DiffFileStatus;
  additions: number;
  deletions: number;
  viewed?: boolean;
  openThreads?: number;
  annotationTone?: "info" | "warning" | "danger" | "success";
}>;
export type Config = Readonly<{ files: readonly ChangedFile[]; mode?: "tree" | "flat" }>;
export const Model = S.Struct({ tree: Tree.Model, filter: S.String, onlyUnviewed: S.Boolean });
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  GotTreeMessage: { message: Tree.Message },
  ChangedFilter: { value: S.String },
  ChangedOnlyUnviewed: { value: S.Boolean },
  RequestedViewed: { path: S.String, viewed: S.Boolean },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  SelectedFile: { path: S.String },
  RequestedViewed: { path: S.String, viewed: S.Boolean },
});
export type OutMessage = typeof OutMessage.Type;
const fileId = (path: string) => `file:${path}`;
export const visibleFiles = (model: Model, config: Config): readonly ChangedFile[] =>
  config.files.filter(
    (file) =>
      (!model.onlyUnviewed || !file.viewed) &&
      file.path.toLocaleLowerCase().includes(model.filter.trim().toLocaleLowerCase()),
  );
export const fileNodes = (
  files: readonly ChangedFile[],
  mode: "tree" | "flat" = "tree",
): readonly Tree.Node[] => {
  if (new Set(files.map((f) => f.path)).size !== files.length)
    throw new Error("Changed file paths must be unique");
  const nodes: Tree.Node[] = [];
  const directories = new Set<string>();
  const stats = (subset: readonly ChangedFile[]) =>
    `+${subset.reduce((sum, f) => sum + f.additions, 0)} −${subset.reduce((sum, f) => sum + f.deletions, 0)} · ${subset.reduce((sum, f) => sum + (f.openThreads ?? 0), 0)} open threads`;
  for (const file of files) {
    const parts = file.path.split("/");
    let parentId: string | null = null;
    if (mode === "tree")
      for (let i = 1; i < parts.length; i++) {
        const prefix = parts.slice(0, i).join("/");
        const id = `dir:${prefix}`;
        if (!directories.has(id)) {
          nodes.push({
            id,
            parentId,
            label: `${parts[i - 1]} · ${stats(files.filter((f) => f.path.startsWith(prefix + "/")))}`,
            branch: true,
            renamable: false,
            movable: false,
          });
          directories.add(id);
        }
        parentId = id;
      }
    nodes.push({
      id: fileId(file.path),
      parentId,
      label: `${file.status[0]!.toUpperCase()} ${mode === "flat" ? file.path : parts.at(-1)} · ${stats([file])}${file.annotationTone ? ` · ${file.annotationTone} annotation` : ""}`,
      branch: false,
      renamable: false,
      movable: false,
    });
  }
  return nodes;
};
export const init = (config: Readonly<{ id: string; files?: readonly ChangedFile[] }>): Model => ({
  tree: Tree.init({
    id: config.id,
    expandedIds: fileNodes(config.files ?? [])
      .filter((n) => n.branch)
      .map((n) => n.id),
  }),
  filter: "",
  onlyUnviewed: false,
});
export const update = (
  model: Model,
  message: Message,
  config: Config,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> =>
  Message.match(message, {
    ChangedFilter: ({ value }) => ({ model: { ...model, filter: value } }),
    ChangedOnlyUnviewed: ({ value }) => ({ model: { ...model, onlyUnviewed: value } }),
    RequestedViewed: ({ path, viewed }) =>
      config.files.some((f) => f.path === path)
        ? {
            model: { ...model, tree: { ...model.tree, activeId: fileId(path) } },
            outMessage: OutMessage.RequestedViewed({ path, viewed }),
          }
        : { model },
    GotTreeMessage: ({ message }) => {
      return Update.foldChild({
        update: (tree: Tree.Model, message: Tree.Message) =>
          Tree.update(tree, message, {
            nodes: fileNodes(visibleFiles(model, config), config.mode),
          }),
        read: (model: Model) => Option.some(model.tree),
        write: (model, tree) => ({ ...model, tree }),
        toParentMessage: (message) => Message.GotTreeMessage({ message }),
        foldOutMessage: (out) => (model: Model) =>
          out._tag === "Selected" && out.id.startsWith("file:")
            ? { model, outMessage: OutMessage.SelectedFile({ path: out.id.slice(5) }) }
            : { model },
      })(model, message);
    },
  });
export const view = <ParentMessage>(
  config: Config & Readonly<{ model: Model; toMessage: (message: Message) => ParentMessage }>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const files = visibleFiles(config.model, config),
    { toMessage } = config;
  return h.section(
    [h.Class("fk-review__panel"), h.AriaLabel("Changed files")],
    [
      h.h3([], ["Changed files"]),
      h.input([
        h.Type("search"),
        h.AriaLabel("Filter changed files"),
        h.Value(config.model.filter),
        h.OnInput((value) => toMessage(Message.ChangedFilter({ value }))),
      ]),
      h.label(
        [],
        [
          h.input([
            h.Type("checkbox"),
            h.Checked(config.model.onlyUnviewed),
            h.OnClick(
              toMessage(Message.ChangedOnlyUnviewed({ value: !config.model.onlyUnviewed })),
            ),
          ]),
          "Show only unviewed",
        ],
      ),
      Tree.view(
        {
          model: config.model.tree,
          nodes: fileNodes(files, config.mode),
          label: "Changed files",
          showActions: false,
          checkedIds: files.filter((f) => f.viewed).map((f) => fileId(f.path)),
          onCheckedChange: (id, viewed) =>
            toMessage(Message.RequestedViewed({ path: id.slice(5), viewed })),
          toParentMessage: (message) => toMessage(Message.GotTreeMessage({ message })),
        },
        h,
      ),
    ],
  );
};
