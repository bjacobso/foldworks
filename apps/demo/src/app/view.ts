import { view as docsView, catalog as docsCatalog } from "../docs/view";
import { docsPath } from "../docs/catalog";
import { groupPackages, packageIcon } from "../docs/packages";
import { type LayerId, layers } from "../stack";
import { type Document, type Html, type HtmlBuilder } from "foldkit/html";
import { Match, Option } from "effect";
import * as stylex from "@stylexjs/stylex";

import {
  Blocks,
  Bot,
  Braces,
  FileSearch,
  FileText,
  FolderGit2,
  FileDiff,
  House,
  ListFilter,
  ListTree,
  ListChecks,
  Monitor,
  Moon,
  Network,
  Palette,
  Sun,
  Table2,
  Workflow as WorkflowIcon,
} from "@lucide/icons";
import { Badge, Icon, Select, Toolbar } from "@foldworks/ui";
import { PdfAnnotator } from "@foldworks/pdf-annotator";
import { ArticleEditor } from "../editor/demo";
import { Sidebar } from "@foldworks/sidebar";

import { view as orchestratorView } from "../orchestrator/view";
import { view as agentView } from "../agent/view";
import { view as codeEditorView } from "../code-editor/view";
import { view as codebaseView } from "../codebase/view";
import { view as diffViewerView } from "../diff-viewer/view";
import { view as workbenchView } from "../workbench/view";
import { contacts } from "../data-table/contacts";
import { view as dataTableView } from "../data-table/view";
import { view as dataGridView } from "../data-grid/demo";
import { countRows, coverageRows } from "../data-grid/coverage-rows";
import { people } from "../data-grid/rows";
import { view as formEditorView } from "../form-builder/view";
import { view as homeView } from "../home/view";
import { view as outlinerView } from "../outliner/view";
import { view as pdfViewerView } from "../pdf-viewer/view";
import { view as queryBuilderView } from "../query-builder/view";
import { statechartSummary, view as statechartView } from "../statechart/view";
import { view as uiKitView } from "../ui-kit/view";
import { allNodes } from "../workflow/graph";
import {
  editorRouter,
  agentRouter,
  orchestratorRouter,
  dataTablePath,
  dataGridPath,
  codeEditorRouter,
  codebaseRouter,
  diffViewerRouter,
  workbenchRouter,
  demoFromRoute,
  formBuilderPath,
  homeRouter,
  outlinerRouter,
  pdfAnnotatorRouter,
  pdfViewerRouter,
  queryBuilderRouter,
  statechartRouter,
  uiKitRouter,
  workflowPath,
  type Demo,
} from "./route";
import { className, styles } from "../workflow/styles";
import { view as workflowEditorView } from "../workflow/view";
import { Message } from "./message";
import type { Model } from "./model";

const compact = "@media (max-width: 640px)";

const toolbarStyles = stylex.create({
  root: {
    flexWrap: { default: "nowrap", [compact]: "wrap" },
    rowGap: "8px",
  },
  copy: {
    flexBasis: "auto",
    flexGrow: { default: 0, [compact]: 1 },
    flexShrink: 1,
  },
  actions: {
    marginLeft: "auto",
  },
  title: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  description: {
    display: { default: "block", [compact]: "none" },
  },
  badge: {
    display: { default: "inline-flex", [compact]: "none" },
  },
});

const toolbarSelectStyles = stylex.create({
  root: {
    alignItems: "center",
    display: "inline-flex",
    flexShrink: 0,
    position: "relative",
  },
  icon: {
    color: "var(--muted-foreground)",
    left: { default: "10px", [compact]: "50%" },
    pointerEvents: "none",
    position: "absolute",
    top: "50%",
    transform: { default: "translateY(-50%)", [compact]: "translate(-50%, -50%)" },
  },
  select: {
    appearance: { default: null, [compact]: "none" },
    color: { default: null, [compact]: "transparent" },
    minHeight: { default: null, [compact]: "36px" },
    paddingLeft: { default: "32px", [compact]: 0 },
    paddingRight: { default: null, [compact]: 0 },
  },
  theme: { width: { default: "190px", [compact]: "36px" } },
  appearance: { width: { default: "118px", [compact]: "36px" } },
});

const appearanceIcon = (preference: Model["themePreference"]): Icon.IconData =>
  preference === "Light" ? Sun : preference === "Dark" ? Moon : Monitor;

/** A native select with a leading icon that collapses to an icon button on phones. */
const iconSelect = (
  icon: Icon.IconData,
  width: stylex.StyleXStyles,
  config: Select.ControlConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  h.span(
    [h.Class(className(toolbarSelectStyles.root))],
    [
      h.span(
        [h.Class(className(toolbarSelectStyles.icon)), h.AriaHidden(true)],
        [Icon.view({ icon, size: 15 }, h)],
      ),
      Select.control(
        {
          ...config,
          sx: toolbarSelectStyles.select,
          slotProps: { root: { sx: width } },
        },
        h,
      ),
    ],
  );

const toolbarBadge = (config: Badge.ViewConfig<Message>, h: HtmlBuilder<Message>): Html =>
  Badge.view({ ...config, sx: toolbarStyles.badge }, h);

const activeAnnouncement = (model: Model): string => {
  const demo = demoFromRoute(model.route);
  return demo === "Workflow"
    ? model.workflowEditor.announcement
    : demo === "Statechart"
      ? model.statechart.announcement
      : demo === "FormBuilder"
        ? model.formEditor.announcement
        : demo === "QueryBuilder"
          ? model.queryBuilderDemo.announcement
          : demo === "PdfAnnotator"
            ? model.pdfAnnotator.announcement
            : demo === "PdfViewer"
              ? ""
              : demo === "UiKit"
                ? model.uiKit.announcement
                : demo === "Agent"
                  ? ""
                  : demo === "DataTable"
                    ? model.dataTableDemo.announcement
                    : model.announcement;
};

const navigationGroups = (model: Model): ReadonlyArray<Sidebar.NavigationGroup> => {
  const demo = demoFromRoute(model.route);
  if (model.route._tag === "Docs") {
    const activePackage = model.route.package;
    return [
      {
        id: "docs",
        label: "Documentation",
        items: [
          {
            id: "docs-home",
            label: "All packages",
            href: docsPath(),
            icon: Blocks,
            isActive: Option.isNone(model.route.package),
          },
          { id: "demo-home", label: "Demos & examples", href: homeRouter(), icon: House },
        ],
      },
      ...groupPackages(docsCatalog).map((group) => ({
        id: `docs-${group.id}`,
        label: group.title,
        items: group.packages.map((pkg) => ({
          id: pkg.id,
          label: pkg.id,
          href: docsPath(pkg.id),
          icon: packageIcon(pkg.id),
          isActive: Option.getOrElse(activePackage, () => "") === pkg.id,
        })),
      })),
    ];
  }
  const docsItem = (packageId: string, label: string): Sidebar.NavigationItem => ({
    id: packageId,
    label,
    href: docsPath(packageId),
    icon: packageIcon(packageId),
  });
  // Every entry opens the best place to see one part of the stack: a live demo
  // where one exists, otherwise the package reference for headless behavior.
  const itemsByLayer: Readonly<Record<LayerId, ReadonlyArray<Sidebar.NavigationItem>>> = {
    Workbenches: [
      {
        id: "orchestrator",
        label: "Outline workspace",
        href: orchestratorRouter(),
        icon: ListTree,
        isActive: demo === "Orchestrator",
      },
      {
        id: "agent",
        label: "Agent playground",
        href: agentRouter(),
        icon: Bot,
        isActive: demo === "Agent",
      },
      {
        id: "codebase",
        label: "Codebase workbench",
        href: codebaseRouter(),
        icon: FolderGit2,
        isActive: demo === "Codebase",
      },
      {
        id: "workbench",
        label: "Workers workbench",
        href: workbenchRouter(),
        icon: Table2,
        isActive: demo === "Workbench",
      },
    ],
    ApplicationPrimitives: [
      {
        id: "editor",
        label: "Document editor",
        href: editorRouter(),
        icon: FileText,
        isActive: demo === "Editor",
      },
      {
        id: "code-editor",
        label: "Code editor",
        href: codeEditorRouter(),
        icon: Braces,
        isActive: demo === "CodeEditor",
      },
      {
        id: "outliner",
        label: "Outliner",
        href: outlinerRouter(),
        icon: ListTree,
        isActive: demo === "Outliner",
      },
      {
        id: "data-table",
        label: "Data table",
        href: dataTablePath(),
        icon: Table2,
        isActive: demo === "DataTable",
      },
      {
        id: "data-grid",
        label: "Data grid",
        href: dataGridPath(),
        icon: Table2,
        isActive: demo === "DataGrid",
      },
      {
        id: "query-builder",
        label: "Query builder",
        href: queryBuilderRouter(),
        icon: ListFilter,
        isActive: demo === "QueryBuilder",
      },
      {
        id: "form-builder",
        label: "Form builder",
        href: formBuilderPath(model.formEditor.exampleId, model.formEditor.mode),
        icon: ListChecks,
        isActive: demo === "FormBuilder",
      },
      {
        id: "workflow",
        label: "Workflow builder",
        href: workflowPath(model.workflowEditor.workflow.orientation),
        icon: WorkflowIcon,
        isActive: demo === "Workflow",
      },
      {
        id: "diff-viewer",
        label: "Diff review",
        href: diffViewerRouter(),
        icon: FileDiff,
        isActive: demo === "DiffViewer",
      },
      {
        id: "pdf-viewer",
        label: "PDF viewer",
        href: pdfViewerRouter(),
        icon: FileSearch,
        isActive: demo === "PdfViewer",
      },
      {
        id: "pdf-annotator",
        label: "PDF annotator",
        href: pdfAnnotatorRouter(),
        icon: FileText,
        isActive: demo === "PdfAnnotator",
      },
    ],
    Behaviors: [
      {
        id: "statechart",
        label: "Statechart editor",
        href: statechartRouter(),
        icon: Network,
        isActive: demo === "Statechart",
      },
      docsItem("keyboard", "Keyboard commands"),
      docsItem("history", "Undo history"),
      docsItem("text-intelligence", "Text intelligence"),
      docsItem("pdf", "PDF rendering"),
    ],
    Components: [
      {
        id: "ui",
        label: "UI system",
        href: uiKitRouter(),
        icon: Blocks,
        isActive: demo === "UiKit",
      },
    ],
    // Every page exposes the token layer through the theme picker in the header.
    Tokens: [],
  };
  return [
    {
      id: "overview",
      label: "Overview",
      items: [
        {
          id: "home",
          label: "Home",
          href: homeRouter(),
          icon: House,
          isActive: demo === "Home",
        },
        {
          id: "documentation",
          label: "Documentation",
          href: docsPath(),
          icon: FileText,
          isActive: demo === "Docs",
        },
      ],
    },
    ...layers
      .filter((layer) => itemsByLayer[layer.id].length > 0)
      .map((layer) => ({ id: layer.id, label: layer.title, items: itemsByLayer[layer.id] })),
  ];
};

const childRegion = (
  model: Model,
  region: "Palette" | "Toolbar" | "Content" | "Overlay",
  h: HtmlBuilder<Message>,
): Html => {
  const demo = demoFromRoute(model.route);
  if (demo === "Workflow") {
    return h.submodel({
      slotId: `workflow-${region.toLowerCase()}`,
      model: model.workflowEditor,
      view: workflowEditorView,
      viewInputs: { region },
      toParentMessage: (message) => Message.GotWorkflowEditorMessage({ message }),
    });
  }
  if (demo === "Statechart") {
    return region === "Overlay"
      ? h.empty
      : h.submodel({
          slotId: `statechart-${region.toLowerCase()}`,
          model: model.statechart,
          view: statechartView,
          viewInputs: { region },
          toParentMessage: (message) => Message.GotStatechartMessage({ message }),
        });
  }
  if (demo === "FormBuilder") {
    return h.submodel({
      slotId: `form-${region.toLowerCase()}`,
      model: model.formEditor,
      view: formEditorView,
      viewInputs: { region },
      toParentMessage: (message) => Message.GotFormEditorMessage({ message }),
    });
  }
  return h.empty;
};

const persistenceBadge = (model: Model, h: HtmlBuilder<Message>): Html =>
  model.persistenceStatus === "Saved"
    ? Badge.view({ label: "Saved locally", tone: "success", dot: true }, h)
    : model.persistenceStatus === "Saving"
      ? Badge.view({ label: "Saving", dot: true }, h)
      : Badge.view({ label: "Save failed", tone: "danger", dot: true }, h);

const docsDescription = (model: Model): string => {
  if (model.route._tag !== "Docs") return "";
  const packageId = Option.getOrUndefined(model.route.package);
  const moduleId = Option.getOrUndefined(model.route.module);
  return packageId === undefined
    ? `${docsCatalog.length} packages · APIs · messages · state machines`
    : `@foldworks/${packageId}${moduleId === undefined ? "" : ` › ${moduleId}`}`;
};

const toolbar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const demo = demoFromRoute(model.route);
  const title =
    demo === "Docs"
      ? "Documentation"
      : demo === "Editor"
        ? "Document editor"
        : demo === "Agent"
          ? "Interactive agent"
          : demo === "CodeEditor"
            ? "Code editor"
            : demo === "Codebase"
              ? "Codebase workbench"
              : demo === "DiffViewer"
                ? "Code review"
                : demo === "Workbench"
                  ? "Workers workbench"
                  : demo === "Workflow"
                    ? "Candidate workflow"
                    : demo === "Statechart"
                      ? "Statechart"
                      : demo === "DataTable"
                        ? "People"
                        : demo === "DataGrid"
                          ? model.dataGridDemo.example === "Coverage"
                            ? "Coverage matrix"
                            : "Headcount worksheet"
                          : demo === "FormBuilder"
                            ? model.formEditor.document.title
                            : demo === "QueryBuilder"
                              ? "Employee query"
                              : demo === "Outliner"
                                ? "Outliner"
                                : demo === "Orchestrator"
                                  ? "Outline workspace"
                                  : demo === "PdfAnnotator"
                                    ? "PDF annotator"
                                    : demo === "PdfViewer"
                                      ? "Onboarding packet review"
                                      : demo === "Home"
                                        ? "Foldworks"
                                        : "@foldworks/ui";
  const description =
    demo === "Docs"
      ? docsDescription(model)
      : demo === "Editor"
        ? "Native Foldkit editing · Markdown · Custom blocks"
        : demo === "Agent"
          ? "Streaming · tool calls · human approval"
          : demo === "CodeEditor"
            ? "Configuration · Scripts · Syntax highlighting"
            : demo === "Codebase"
              ? "Living documentation · source · history · Git diffs"
              : demo === "DiffViewer"
                ? "Split and unified diffs · line comments · review progress"
                : demo === "Workbench"
                  ? "Inspect · Explain · Preview · Apply · History"
                  : demo === "Workflow"
                    ? `${allNodes(model.workflowEditor.document).length} nodes · structured auto-layout`
                    : demo === "Statechart"
                      ? statechartSummary(model.statechart)
                      : demo === "DataTable"
                        ? `${contacts.length} people · resource-first CRUD table`
                        : demo === "DataGrid"
                          ? model.dataGridDemo.example === "Coverage"
                            ? `${countRows(coverageRows).toLocaleString("en-US")} rows · row groups · gap highlighting`
                            : `${people.length} rows · cell editing · spreadsheet controls`
                          : demo === "FormBuilder"
                            ? `${model.formEditor.document.sections.length} sections · ${model.formEditor.document.actors.length} actors`
                            : demo === "QueryBuilder"
                              ? "Configured attributes · recursive groups · live validation"
                              : demo === "Outliner"
                                ? "Indent · reorder · fold · hoist · drag and drop"
                                : demo === "Orchestrator"
                                  ? "Notes · threads · context · results"
                                  : demo === "PdfAnnotator"
                                    ? `${model.pdfAnnotator.annotations.length} annotations · drag, resize, and export`
                                    : demo === "PdfViewer"
                                      ? "Read-only pages · overlay hotspots · crop boxes and rotation"
                                      : demo === "Home"
                                        ? "The UI standard library for Foldkit and StyleX"
                                        : "61 components · Foldkit behavior · StyleX";
  return Toolbar.view(
    {
      title,
      description,
      sx: toolbarStyles.root,
      slotProps: {
        copy: { sx: toolbarStyles.copy },
        actions: { sx: toolbarStyles.actions },
        title: { sx: toolbarStyles.title },
        description: { sx: toolbarStyles.description },
      },
      actions: [
        ...(demo === "Editor"
          ? [toolbarBadge({ label: "Native editor preview", dot: true }, h)]
          : demo === "Agent"
            ? [toolbarBadge({ label: "Simulated", tone: "info", dot: true }, h)]
            : demo === "Workflow" || demo === "FormBuilder"
              ? [persistenceBadge(model, h), childRegion(model, "Toolbar", h)]
              : demo === "Statechart"
                ? [childRegion(model, "Toolbar", h)]
                : demo === "CodeEditor"
                  ? [toolbarBadge({ label: "Live diagnostics", tone: "info", dot: true }, h)]
                  : demo === "Codebase"
                    ? [toolbarBadge({ label: "Read-only fixture", tone: "info", dot: true }, h)]
                    : demo === "DiffViewer"
                      ? [
                          toolbarBadge(
                            { label: "Interactive prototype", tone: "info", dot: true },
                            h,
                          ),
                        ]
                      : demo === "Workbench"
                        ? [toolbarBadge({ label: "Reference workspace", dot: true }, h)]
                        : demo === "DataTable"
                          ? [
                              toolbarBadge(
                                {
                                  label: "Semantic table + controlled data",
                                  tone: "info",
                                  dot: true,
                                },
                                h,
                              ),
                            ]
                          : demo === "DataGrid"
                            ? [
                                toolbarBadge(
                                  {
                                    label:
                                      model.dataGridDemo.example === "Coverage"
                                        ? "Virtualized row groups"
                                        : "Excel-like grid",
                                    tone: "info",
                                    dot: true,
                                  },
                                  h,
                                ),
                              ]
                            : demo === "QueryBuilder"
                              ? [
                                  toolbarBadge(
                                    { label: "Validates as you edit", tone: "success", dot: true },
                                    h,
                                  ),
                                ]
                              : demo === "Outliner"
                                ? [
                                    toolbarBadge(
                                      { label: "Keyboard first", tone: "info", dot: true },
                                      h,
                                    ),
                                  ]
                                : demo === "PdfAnnotator"
                                  ? [
                                      toolbarBadge(
                                        {
                                          label: "Foldkit drag + PDF export",
                                          tone: "info",
                                          dot: true,
                                        },
                                        h,
                                      ),
                                    ]
                                  : demo === "PdfViewer"
                                    ? [
                                        toolbarBadge(
                                          { label: "Read-only viewer", tone: "info", dot: true },
                                          h,
                                        ),
                                      ]
                                    : demo === "Home" || demo === "Docs"
                                      ? []
                                      : [
                                          toolbarBadge(
                                            { label: "61 components", tone: "info", dot: true },
                                            h,
                                          ),
                                          toolbarBadge({ label: "StyleX + Foldkit" }, h),
                                        ]),
        iconSelect(
          Palette,
          toolbarSelectStyles.theme,
          {
            value: model.themeName,
            ariaLabel: "Theme",
            onChange: (name) =>
              Message.SelectedThemeName({
                name: name as Model["themeName"],
              }),
            options: [
              { value: "Shadcn", label: "shadcn/ui" },
              { value: "Blueprint", label: "Palantir Blueprint" },
              { value: "Office", label: "Microsoft Office" },
              { value: "Fluent2", label: "Microsoft Fluent 2" },
              { value: "Google", label: "Google" },
              { value: "Apple", label: "Apple" },
              { value: "Polaris", label: "Shopify Polaris 2" },
            ],
          },
          h,
        ),
        iconSelect(
          appearanceIcon(model.themePreference),
          toolbarSelectStyles.appearance,
          {
            value: model.themePreference,
            ariaLabel: "Appearance",
            onChange: (preference) =>
              Message.SelectedThemePreference({
                preference: preference as Model["themePreference"],
              }),
            options: [
              { value: "System", label: "System" },
              { value: "Light", label: "Light" },
              { value: "Dark", label: "Dark" },
            ],
          },
          h,
        ),
      ],
    },
    h,
  );
};

const content = (model: Model, h: HtmlBuilder<Message>): Html => {
  const demo = demoFromRoute(model.route);
  if (model.route._tag === "Docs")
    return h.submodel({
      slotId: "docs-content",
      model: model.docs,
      view: docsView,
      viewInputs: {
        packageId: Option.getOrElse(model.route.package, () => ""),
        moduleId: Option.getOrElse(model.route.module, () => ""),
      },
      toParentMessage: (message) => Message.GotDocsMessage({ message }),
    });
  if (demo === "Home") return homeView(h);
  if (demo === "Editor")
    return h.submodel({
      slotId: "document-editor",
      model: model.editor,
      view: ArticleEditor.view,
      toParentMessage: (message) => Message.GotEditorMessage({ message }),
    });
  if (demo === "Orchestrator")
    return h.submodel({
      slotId: "orchestrator-content",
      model: model.orchestrator,
      view: orchestratorView,
      toParentMessage: (message) => Message.GotOrchestratorMessage({ message }),
    });
  if (demo === "Agent")
    return h.submodel({
      slotId: "agent-content",
      model: model.agent,
      view: agentView,
      toParentMessage: (message) => Message.GotAgentMessage({ message }),
    });
  if (demo === "CodeEditor")
    return h.submodel({
      slotId: "code-editor-content",
      model: model.codeEditor,
      view: codeEditorView,
      viewInputs: {
        isDark:
          model.themePreference === "Dark" ||
          (model.themePreference === "System" && model.systemIsDark),
      },
      toParentMessage: (message) => Message.GotCodeEditorMessage({ message }),
    });
  if (demo === "Codebase") return codebaseView(h);
  if (demo === "DiffViewer")
    return h.submodel({
      slotId: "diff-viewer-content",
      model: model.diffViewerDemo,
      view: diffViewerView,
      toParentMessage: (message) => Message.GotDiffViewerDemoMessage({ message }),
    });
  if (demo === "Workbench")
    return h.submodel({
      slotId: "workbench-content",
      model: model.workbench,
      view: workbenchView,
      toParentMessage: (message) => Message.GotWorkbenchMessage({ message }),
    });
  if (
    demo === "Workflow" ||
    demo === "Statechart" ||
    (demo === "FormBuilder" && model.formEditor.mode === "Editor")
  ) {
    const paletteLabel =
      demo === "Workflow" ? "Workflow nodes" : demo === "Statechart" ? "States" : "Form fields";
    return h.div(
      [h.Class(className(styles.editorWorkspace))],
      [
        h.aside(
          [h.Class(className(styles.editorPalette)), h.AriaLabel(paletteLabel)],
          [childRegion(model, "Palette", h)],
        ),
        childRegion(model, "Content", h),
      ],
    );
  }
  if (demo === "FormBuilder") {
    return childRegion(model, "Content", h);
  }
  if (demo === "DataTable") {
    return h.submodel({
      slotId: "data-table-content",
      model: model.dataTableDemo,
      view: dataTableView,
      toParentMessage: (message) => Message.GotDataTableDemoMessage({ message }),
    });
  }
  if (demo === "DataGrid") {
    return h.submodel({
      slotId: "data-grid-content",
      model: model.dataGridDemo,
      view: dataGridView,
      toParentMessage: (message) => Message.GotDataGridDemoMessage({ message }),
    });
  }
  if (demo === "QueryBuilder") {
    return h.submodel({
      slotId: "query-builder-content",
      model: model.queryBuilderDemo,
      view: queryBuilderView,
      toParentMessage: (message) => Message.GotQueryBuilderDemoMessage({ message }),
    });
  }
  if (demo === "Outliner") {
    return h.submodel({
      slotId: "outliner-content",
      model: model.outlinerDemo,
      view: outlinerView,
      toParentMessage: (message) => Message.GotOutlinerDemoMessage({ message }),
    });
  }
  if (demo === "PdfAnnotator") {
    return h.submodel({
      slotId: "pdf-annotator-content",
      model: model.pdfAnnotator,
      view: PdfAnnotator.view,
      toParentMessage: (message) => Message.GotPdfAnnotatorMessage({ message }),
    });
  }
  if (demo === "PdfViewer") {
    return h.submodel({
      slotId: "pdf-viewer-content",
      model: model.pdfViewerDemo,
      view: pdfViewerView,
      toParentMessage: (message) => Message.GotPdfViewerDemoMessage({ message }),
    });
  }
  return h.submodel({
    slotId: "ui-kit-content",
    model: model.uiKit,
    view: uiKitView,
    toParentMessage: (message) => Message.GotUiKitMessage({ message }),
  });
};

const documentTitle = (demo: Demo): string =>
  Match.value(demo).pipe(
    Match.when("Docs", () => "Documentation · Foldworks"),
    Match.when("Editor", () => "Document editor · Foldworks"),
    Match.when("Orchestrator", () => "Outline workspace · Foldworks"),
    Match.when("Agent", () => "Interactive agent · Foldworks"),
    Match.when("CodeEditor", () => "Code editor · Foldworks"),
    Match.when("Codebase", () => "Codebase workbench · Foldworks"),
    Match.when("DiffViewer", () => "Code review · Foldworks"),
    Match.when("Workbench", () => "Workers workbench · Foldworks"),
    Match.when("Home", () => "Foldworks · The UI standard library for Foldkit and StyleX"),
    Match.when("DataTable", () => "Data table · Foldworks"),
    Match.when("DataGrid", () => "Data grid · Foldworks"),
    Match.when("FormBuilder", () => "Form builder · Foldworks"),
    Match.when("QueryBuilder", () => "Query builder · Foldworks"),
    Match.when("Outliner", () => "Outliner · Foldworks"),
    Match.when("PdfAnnotator", () => "PDF annotator · Foldworks"),
    Match.when("PdfViewer", () => "PDF viewer · Foldworks"),
    Match.when("UiKit", () => "UI components · Foldworks"),
    Match.when("Workflow", () => "Workflow · Foldworks"),
    Match.when("Statechart", () => "Statechart · Foldworks"),
    Match.exhaustive,
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const demo = demoFromRoute(model.route);
  const preview = demo === "FormBuilder" && model.formEditor.mode === "Preview";
  return {
    title: documentTitle(demo),
    body: h.main(
      [h.Class(className(styles.app))],
      [
        preview
          ? h.section(
              [h.Class(className(styles.workspace))],
              [toolbar(model, h), content(model, h)],
            )
          : Sidebar.view(
              {
                model: model.sidebar,
                toParentMessage: (message) => Message.GotSidebarMessage({ message }),
                brand: {
                  title: "Foldworks",
                  description: "Foldkit + StyleX",
                  href: homeRouter(),
                  icon: Blocks,
                },
                groups: navigationGroups(model),
                header: toolbar(model, h),
                content: content(model, h),
                footer: {
                  title: "UI standard library",
                  description: `${docsCatalog.length} Foldworks packages`,
                  icon: Blocks,
                },
                ariaLabel: "Foldworks navigation",
                variant: "inset",
                collapsible: "icon",
              },
              h,
            ),
        demo === "Workflow" || demo === "FormBuilder" ? childRegion(model, "Overlay", h) : h.empty,
        h.div(
          [h.Class(className(styles.srOnly)), h.AriaLive("assertive")],
          [activeAnnouncement(model)],
        ),
      ],
    ),
  };
};
