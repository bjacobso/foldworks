import { type Document, type Html, type HtmlBuilder } from "foldkit/html";
import { Match } from "effect";

import {
  Blocks,
  Bot,
  Braces,
  FileText,
  House,
  ListFilter,
  ListChecks,
  Table2,
  Workflow as WorkflowIcon,
} from "@lucide/icons";
import {
  Badge,
  Select,
  Toolbar,
} from "@foldworks/ui";
import { PdfAnnotator } from "@foldworks/pdf-annotator";
import { Sidebar } from "@foldworks/sidebar";

import { view as agentView } from "../agent/view";
import { view as codeEditorView } from "../code-editor/view";
import { view as workbenchView } from "../workbench/view";
import { view as dataGridView } from "../data-grid/demo";
import { people } from "../data-grid/rows";
import { view as formEditorView } from "../form-builder/view";
import { view as homeView } from "../home/view";
import { view as queryBuilderView } from "../query-builder/view";
import { view as uiKitView } from "../ui-kit/view";
import { allNodes } from "../workflow/graph";
import {
  agentRouter,
  dataGridRouter,
  codeEditorRouter,
  workbenchRouter,
  demoFromRoute,
  formBuilderPath,
  homeRouter,
  pdfAnnotatorRouter,
  queryBuilderRouter,
  uiKitRouter,
  workflowPath,
  type Demo,
} from "./route";
import { className, styles } from "../workflow/styles";
import { view as workflowEditorView } from "../workflow/view";
import { Message } from "./message";
import type { Model } from "./model";

const activeAnnouncement = (model: Model): string => {
  const demo = demoFromRoute(model.route);
  return demo === "Workflow"
    ? model.workflowEditor.announcement
    : demo === "FormBuilder"
      ? model.formEditor.announcement
      : demo === "QueryBuilder"
        ? model.queryBuilderDemo.announcement
      : demo === "PdfAnnotator"
        ? model.pdfAnnotator.announcement
      : demo === "UiKit"
        ? model.uiKit.announcement
      : demo === "Agent"
        ? ""
        : model.announcement;
};

const navigationGroups = (model: Model): ReadonlyArray<Sidebar.NavigationGroup> => {
  const demo = demoFromRoute(model.route);
  return [
    {
      id: "overview",
      label: "Overview",
      items: [{
        id: "home",
        label: "Home",
        href: homeRouter(),
        icon: House,
        isActive: demo === "Home",
      }],
    },
    {
      id: "reference-applications",
      label: "Reference applications",
      items: [
        { id: "agent", label: "Agent playground", href: agentRouter(), icon: Bot, isActive: demo === "Agent" },
        { id: "workbench", label: "Workers workbench", href: workbenchRouter(), icon: Table2, isActive: demo === "Workbench" },
      ],
    },
    {
      id: "foundation",
      label: "Foundation",
      items: [{
        id: "ui",
        label: "@foldworks/ui",
        href: uiKitRouter(),
        icon: Blocks,
        isActive: demo === "UiKit",
      }],
    },
    {
      id: "application-primitives",
      label: "Application primitives",
      items: [
        { id: "code-editor", label: "Code editor", href: codeEditorRouter(), icon: Braces, isActive: demo === "CodeEditor" },
        { id: "data-grid", label: "Data grid", href: dataGridRouter(), icon: Table2, isActive: demo === "DataGrid" },
        { id: "query-builder", label: "Query builder", href: queryBuilderRouter(), icon: ListFilter, isActive: demo === "QueryBuilder" },
        { id: "form-builder", label: "Form builder", href: formBuilderPath(model.formEditor.exampleId, model.formEditor.mode), icon: ListChecks, isActive: demo === "FormBuilder" },
        { id: "workflow", label: "Workflow builder", href: workflowPath(model.workflowEditor.workflow.orientation), icon: WorkflowIcon, isActive: demo === "Workflow" },
        { id: "pdf-annotator", label: "PDF annotator", href: pdfAnnotatorRouter(), icon: FileText, isActive: demo === "PdfAnnotator" },
      ],
    },
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

const toolbar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const demo = demoFromRoute(model.route);
  const title = demo === "Agent" ? "Interactive agent" : demo === "CodeEditor" ? "Code editor" : demo === "Workbench" ? "Workers workbench" : demo === "Workflow"
    ? "Candidate workflow"
    : demo === "DataGrid"
      ? "People operations"
      : demo === "FormBuilder"
        ? model.formEditor.document.title
        : demo === "QueryBuilder"
          ? "Employee query"
        : demo === "PdfAnnotator"
          ? "PDF annotator"
        : demo === "Home"
          ? "Foldworks"
          : "@foldworks/ui";
  const description = demo === "Agent" ? "Streaming · tool calls · human approval" : demo === "CodeEditor" ? "Configuration · Scripts · Syntax highlighting" : demo === "Workbench" ? "Inspect · Explain · Preview · Apply · History" : demo === "Workflow"
    ? `${allNodes(model.workflowEditor.document).length} nodes · structured auto-layout`
    : demo === "DataGrid"
      ? `${people.length} people · controlled Foldkit data grid`
      : demo === "FormBuilder"
        ? `${model.formEditor.document.sections.length} sections · ${model.formEditor.document.actors.length} actors`
        : demo === "QueryBuilder"
          ? "Configured attributes · recursive groups · live validation"
        : demo === "PdfAnnotator"
          ? `${model.pdfAnnotator.annotations.length} annotations · drag, resize, and export`
        : demo === "Home"
          ? "Polished application primitives for Foldkit and StyleX"
          : "61 application primitives · Foldkit behavior · StyleX";
  return Toolbar.view({
    title,
    description,
    actions: [
      ...(demo === "Agent"
        ? [Badge.view({ label: "Simulated", tone: "info", dot: true }, h)]
        : demo === "Workflow" || demo === "FormBuilder"
        ? [persistenceBadge(model, h), childRegion(model, "Toolbar", h)]
        : demo === "CodeEditor"
          ? [Badge.view({ label: "Live diagnostics", tone: "info", dot: true }, h)]
        : demo === "Workbench"
          ? [Badge.view({ label: "Reference workspace", dot: true }, h)]
        : demo === "DataGrid"
          ? [Badge.view({ label: "Headless core + DOM view" }, h)]
          : demo === "QueryBuilder"
            ? [Badge.view({ label: "Validates as you edit", tone: "success", dot: true }, h)]
          : demo === "PdfAnnotator"
            ? [Badge.view({ label: "Foldkit drag + PDF export", tone: "info", dot: true }, h)]
          : demo === "Home"
            ? [
                Badge.view({ label: "10 packages", tone: "info", dot: true }, h),
                Badge.view({ label: "Open source" }, h),
              ]
            : [
              Badge.view({ label: "61 primitives", tone: "info", dot: true }, h),
              Badge.view({ label: "StyleX + Foldkit" }, h),
            ]),
      Select.control({
        value: model.themeName,
        ariaLabel: "Theme",
        onChange: (name) => Message.SelectedThemeName({
          name: name as Model["themeName"],
        }),
        options: [
          { value: "Neutral", label: "Neutral" },
          { value: "Zinc", label: "Zinc" },
          { value: "Blue", label: "Blue" },
          { value: "Soft", label: "Soft" },
        ],
      }, h),
      Select.control({
        value: model.themePreference,
        ariaLabel: "Appearance",
        onChange: (preference) => Message.SelectedThemePreference({
          preference: preference as Model["themePreference"],
        }),
        options: [
          { value: "System", label: "System" },
          { value: "Light", label: "Light" },
          { value: "Dark", label: "Dark" },
        ],
      }, h),
    ],
  }, h);
};

const content = (model: Model, h: HtmlBuilder<Message>): Html => {
  const demo = demoFromRoute(model.route);
  if (demo === "Home") return homeView(h);
  if (demo === "Agent") return h.submodel({
    slotId: "agent-content",
    model: model.agent,
    view: agentView,
    toParentMessage: (message) => Message.GotAgentMessage({ message }),
  });
  if (demo === "CodeEditor") return h.submodel({
    slotId: "code-editor-content",
    model: model.codeEditor,
    view: codeEditorView,
    viewInputs: { isDark: model.themePreference === "Dark" || (model.themePreference === "System" && model.systemIsDark) },
    toParentMessage: (message) => Message.GotCodeEditorMessage({ message }),
  });
  if (demo === "Workbench") return h.submodel({
    slotId: "workbench-content",
    model: model.workbench,
    view: workbenchView,
    toParentMessage: (message) => Message.GotWorkbenchMessage({ message }),
  });
  if (demo === "Workflow" || (demo === "FormBuilder" && model.formEditor.mode === "Editor")) {
    const paletteLabel = demo === "Workflow" ? "Workflow nodes" : "Form fields";
    return h.div([h.Class(className(styles.editorWorkspace))], [
      h.aside([h.Class(className(styles.editorPalette)), h.AriaLabel(paletteLabel)], [
        childRegion(model, "Palette", h),
      ]),
      childRegion(model, "Content", h),
    ]);
  }
  if (demo === "FormBuilder") {
    return childRegion(model, "Content", h);
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
  if (demo === "PdfAnnotator") {
    return h.submodel({
      slotId: "pdf-annotator-content",
      model: model.pdfAnnotator,
      view: PdfAnnotator.view,
      toParentMessage: (message) => Message.GotPdfAnnotatorMessage({ message }),
    });
  }
  return h.submodel({
    slotId: "ui-kit-content",
    model: model.uiKit,
    view: uiKitView,
    toParentMessage: (message) => Message.GotUiKitMessage({ message }),
  });
};

const documentTitle = (demo: Demo): string => Match.value(demo).pipe(
  Match.when("Agent", () => "Interactive agent · Foldworks"),
  Match.when("CodeEditor", () => "Code editor · Foldworks"),
  Match.when("Workbench", () => "Workers workbench · Foldworks"),
  Match.when("Home", () => "Foldworks · Application primitives for Foldkit and StyleX"),
  Match.when("DataGrid", () => "Data grid · Foldworks"),
  Match.when("FormBuilder", () => "Form builder · Foldworks"),
  Match.when("QueryBuilder", () => "Query builder · Foldworks"),
  Match.when("PdfAnnotator", () => "PDF annotator · Foldworks"),
  Match.when("UiKit", () => "UI components · Foldworks"),
  Match.when("Workflow", () => "Workflow · Foldworks"),
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
          ? h.section([h.Class(className(styles.workspace))], [toolbar(model, h), content(model, h)])
          : Sidebar.view({
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
                title: "Application primitives",
                description: "Ten Foldworks packages",
                icon: Blocks,
              },
              ariaLabel: "Foldworks navigation",
              variant: "inset",
              collapsible: "icon",
            }, h),
        demo === "Workflow" || demo === "FormBuilder"
          ? childRegion(model, "Overlay", h)
          : h.empty,
        h.div([h.Class(className(styles.srOnly)), h.AriaLive("assertive")], [
          activeAnnouncement(model),
        ]),
      ],
    ),
  };
};
