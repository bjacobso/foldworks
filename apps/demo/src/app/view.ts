import { type Document, type Html, type HtmlBuilder } from "foldkit/html";

import {
  Blocks,
  ListFilter,
  ListChecks,
  Table2,
  Workflow as WorkflowIcon,
} from "@lucide/icons";
import {
  Badge,
  Icon,
  Select,
  Toolbar,
} from "@foldworks/ui";

import { people, view as dataGridView } from "../data-grid/demo";
import { view as formEditorView } from "../form-builder/view";
import { view as queryBuilderView } from "../query-builder/view";
import { view as uiKitView } from "../ui-kit/view";
import { allNodes } from "../workflow/graph";
import {
  dataGridRouter,
  demoFromRoute,
  formBuilderPath,
  queryBuilderRouter,
  uiKitRouter,
  workflowPath,
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
      : demo === "UiKit"
        ? model.uiKit.announcement
        : model.announcement;
};

const navigation = (model: Model, h: HtmlBuilder<Message>): Html => {
  const demo = demoFromRoute(model.route);
  return h.nav([h.Class(className(styles.demoNav)), h.AriaLabel("Example views")], [
    h.a([
      h.Href(uiKitRouter()),
      h.Class(className(styles.demoNavItem, demo === "UiKit" && styles.demoNavItemActive)),
      h.AriaCurrent(demo === "UiKit" ? "page" : "false"),
    ], [Icon.view({ icon: Blocks, size: 15 }, h), "@foldworks/ui"]),
    h.a([
      h.Href(dataGridRouter()),
      h.Class(className(styles.demoNavItem, demo === "DataGrid" && styles.demoNavItemActive)),
      h.AriaCurrent(demo === "DataGrid" ? "page" : "false"),
    ], [Icon.view({ icon: Table2, size: 15 }, h), "Data grid"]),
    h.a([
      h.Href(queryBuilderRouter()),
      h.Class(className(styles.demoNavItem, demo === "QueryBuilder" && styles.demoNavItemActive)),
      h.AriaCurrent(demo === "QueryBuilder" ? "page" : "false"),
    ], [Icon.view({ icon: ListFilter, size: 15 }, h), "Query builder"]),
    h.a([
      h.Href(formBuilderPath(model.formEditor.exampleId, model.formEditor.mode)),
      h.Class(className(styles.demoNavItem, demo === "FormBuilder" && styles.demoNavItemActive)),
      h.AriaCurrent(demo === "FormBuilder" ? "page" : "false"),
    ], [Icon.view({ icon: ListChecks, size: 15 }, h), "Form builder"]),
    h.a([
      h.Href(workflowPath(model.workflowEditor.workflow.orientation)),
      h.Class(className(styles.demoNavItem, demo === "Workflow" && styles.demoNavItemActive)),
      h.AriaCurrent(demo === "Workflow" ? "page" : "false"),
    ], [Icon.view({ icon: WorkflowIcon, size: 15 }, h), "Workflow builder"]),
  ]);
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

const sidebar = (model: Model, h: HtmlBuilder<Message>): Html => {
  return h.aside(
    [h.Class(className(styles.sidebar)), h.AriaLabel("Foldworks navigation")],
    [
      h.div([h.Class(className(styles.brandRow))], [
        h.p([h.Class(className(styles.brand))], ["Foldworks"]),
      ]),
      navigation(model, h),
    ],
  );
};

const persistenceBadge = (model: Model, h: HtmlBuilder<Message>): Html =>
  model.persistenceStatus === "Saved"
    ? Badge.view({ label: "Saved locally", tone: "success", dot: true }, h)
    : model.persistenceStatus === "Saving"
      ? Badge.view({ label: "Saving", dot: true }, h)
      : Badge.view({ label: "Save failed", tone: "danger", dot: true }, h);

const toolbar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const demo = demoFromRoute(model.route);
  const title = demo === "Workflow"
    ? "Candidate workflow"
    : demo === "DataGrid"
      ? "People operations"
      : demo === "FormBuilder"
        ? model.formEditor.document.title
        : demo === "QueryBuilder"
          ? "Employee query"
        : "@foldworks/ui";
  const description = demo === "Workflow"
    ? `${allNodes(model.workflowEditor.document).length} nodes · structured auto-layout`
    : demo === "DataGrid"
      ? `${people.length} people · controlled Foldkit data grid`
      : demo === "FormBuilder"
        ? `${model.formEditor.document.sections.length} sections · ${model.formEditor.document.actors.length} actors`
        : demo === "QueryBuilder"
          ? "Configured attributes · recursive groups · live validation"
        : "13 application primitives · Foldkit behavior · StyleX";
  return Toolbar.view({
    title,
    description,
    actions: [
      ...(demo === "Workflow" || demo === "FormBuilder"
        ? [persistenceBadge(model, h), childRegion(model, "Toolbar", h)]
        : demo === "DataGrid"
          ? [Badge.view({ label: "Headless core + DOM view" }, h)]
          : demo === "QueryBuilder"
            ? [Badge.view({ label: "Validates as you edit", tone: "success", dot: true }, h)]
          : [
              Badge.view({ label: "13 primitives", tone: "info", dot: true }, h),
              Badge.view({ label: "StyleX + Foldkit" }, h),
            ]),
      Select.control({
        value: model.themePreference,
        ariaLabel: "Color theme",
        onChange: (preference) => Message.SelectedThemePreference({
          preference: preference as Model["themePreference"],
        }),
        options: [
          { value: "System", label: "System theme" },
          { value: "Light", label: "Light theme" },
          { value: "Dark", label: "Dark theme" },
        ],
      }, h),
    ],
  }, h);
};

const content = (model: Model, h: HtmlBuilder<Message>): Html => {
  const demo = demoFromRoute(model.route);
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
  return h.submodel({
    slotId: "ui-kit-content",
    model: model.uiKit,
    view: uiKitView,
    toParentMessage: (message) => Message.GotUiKitMessage({ message }),
  });
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const demo = demoFromRoute(model.route);
  const preview = demo === "FormBuilder" && model.formEditor.mode === "Preview";
  return {
    title: `${demo === "DataGrid" ? "Data grid" : demo === "FormBuilder" ? "Form builder" : demo === "QueryBuilder" ? "Query builder" : demo === "UiKit" ? "UI components" : "Workflow"} · Foldworks`,
    body: h.main(
      [h.Class(className(styles.app, preview && styles.appFormPreview))],
      [
        preview ? h.empty : sidebar(model, h),
        h.section([h.Class(className(styles.workspace))], [toolbar(model, h), content(model, h)]),
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
