import { Editor, Message, type BlockDefinition } from "@foldworks/editor";

const ProjectReference: BlockDefinition = {
  name: "project",
  label: "Project reference",
  kind: "atom",
  defaults: {
    projectId: "launch",
    label: "Product launch",
    status: "Planning",
  },
  validate: (attrs) =>
    Boolean(attrs.projectId?.trim()) &&
    Boolean(attrs.label?.trim()) &&
    ["Planning", "In progress", "Complete"].includes(attrs.status ?? ""),
  portable: (node) => `${node.attrs.label} (${node.attrs.status})`,
  view: (node, h) =>
    h.div(
      [h.Class("editor-demo-project")],
      [
        h.span(
          [h.Class("editor-demo-project__icon"), h.AriaHidden(true)],
          ["↗"],
        ),
        h.div(
          [],
          [
            h.small([], ["PROJECT REFERENCE"]),
            h.input([
              h.AriaLabel("Project label"),
              h.Value(node.attrs.label ?? ""),
              h.OnChange((value) =>
                Message.Attributes({ id: node.id, key: "label", value }),
              ),
            ]),
          ],
        ),
        h.select(
          [
            h.AriaLabel("Project status"),
            h.Value(node.attrs.status ?? "Planning"),
            h.OnChange((value) =>
              Message.Attributes({ id: node.id, key: "status", value }),
            ),
          ],
          ["Planning", "In progress", "Complete"].map((value) =>
            h.option([h.Value(value)], [value]),
          ),
        ),
      ],
    ),
};

export const ArticleEditor = Editor.define({ blocks: [ProjectReference] });
export const initialEditor = () =>
  ArticleEditor.init({
    id: "foldworks-document-editor",
    markdown: `# The next chapter

Good work starts with a little space to think. This is your document—write, rearrange, and make it yours.

## Make room for the details

Select some text to make it **bold**, *italic*, or add a link. Use the block menu to turn a thought into something more structured.

- A clear idea worth exploring
- A few notes from the team
- A plan that can grow with you

:::foldworks-callout{version="1" tone="info"}
**A small reminder**

You can move this whole callout using its block handle. Every move is undoable.
:::

::foldworks-project{version="1" projectId="launch" label="Product launch" status="Planning"}

## Ready when you are

- [x] Give the idea a home
- [ ] Bring the team into the conversation
- [ ] Make something worth sharing

Start a new paragraph and type / to add a block.
`,
  });
