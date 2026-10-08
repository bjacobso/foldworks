/**
 * The Foldworks stack. Each layer is built only from the layers beneath it.
 * The home page, navigation sidebar, and documentation index all group
 * packages by these layers, ordered from the top of the stack to the bottom.
 */
export type LayerId =
  | "Workbenches"
  | "ApplicationPrimitives"
  | "Behaviors"
  | "Components"
  | "Tokens";

export type Layer = Readonly<{
  id: LayerId;
  index: string;
  title: string;
  summary: string;
  examples: ReadonlyArray<string>;
  /** Package ids without the `@foldworks/` scope. */
  packageIds: ReadonlyArray<string>;
}>;

export const layers: ReadonlyArray<Layer> = [
  {
    id: "Workbenches",
    index: "05",
    title: "Workbenches",
    summary: "Complete tools composed from the layers below. Ship them, or read them as recipes.",
    examples: ["Agent chat", "Generative UI", "Codebase", "Statechart", "Orchestrator"],
    packageIds: ["agent", "generative-ui", "codebase"],
  },
  {
    id: "ApplicationPrimitives",
    index: "04",
    title: "Application primitives",
    summary:
      "The surfaces every serious product ends up building, with models, messages, and updates included.",
    examples: [
      "DataGrid",
      "DataTable",
      "Editor",
      "CodeEditor",
      "Outliner",
      "QueryBuilder",
      "FormBuilder",
      "Workflow",
      "DiffViewer",
      "PdfAnnotator",
    ],
    packageIds: [
      "editor",
      "code-editor",
      "outliner",
      "data-table",
      "data-grid",
      "query-builder",
      "form-builder",
      "workflow",
      "diff-viewer",
      "pdf-viewer",
      "pdf-annotator",
    ],
  },
  {
    id: "Behaviors",
    index: "03",
    title: "Behaviors",
    summary: "Headless engines that more than one surface shares.",
    examples: ["Commands", "Shortcuts", "History", "Mentions", "Diagnostics", "Graph layout"],
    packageIds: ["keyboard", "history", "text-intelligence", "diagram", "pdf"],
  },
  {
    id: "Components",
    index: "02",
    title: "Components",
    summary: "Accessible controls, overlays, and application chrome.",
    examples: ["Button", "Dialog", "Select", "Command", "Tooltip", "Tree", "SplitView", "Sidebar"],
    packageIds: ["ui", "sidebar"],
  },
  {
    id: "Tokens",
    index: "01",
    title: "Tokens",
    summary: "Semantic CSS variables, light and dark, shared by every layer above.",
    examples: ["Shadcn", "Blueprint", "Office", "Google", "Apple", "Polaris"],
    // Tokens and themes ship inside @foldworks/ui, which is listed under Components.
    packageIds: [],
  },
];

/** The layer that owns a package, if the package has been placed in the stack. */
export const layerOf = (packageId: string): Layer | undefined =>
  layers.find((layer) => layer.packageIds.includes(packageId));
