import { type Document, type Html, type HtmlBuilder } from "foldkit/html";

import {
  Blocks,
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
import { view as uiKitView } from "../ui-kit/view";
import { allNodes } from "../workflow/graph";
import {
  dataGridRouter,
  demoFromRoute,
  formBuilderPath,
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
      : demo === "UiKit"
        ? model.uiKit.announcement
        : model.announcement;
};

const navigation = (model: Model, h: HtmlBuilder<Message>): Html => {
  const demo = demoFromRoute(model.route);
  return h.nav([h.Class(className(styles.demoNav)), h.AriaLabel("Example views")], [
    h.a([
      h.Href(workflowPath(model.workflowEditor.workflow.orientation)),
      h.Class(className(styles.demoNavItem, demo === "Workflow" && styles.demoNavItemActive)),
      h.AriaCurrent(demo === "Workflow" ? "page" : "false"),
    ], [Icon.view({ icon: WorkflowIcon, size: 15 }, h), "Workflow builder"]),
    h.a([
      h.Href(dataGridRouter()),
      h.Class(className(styles.demoNavItem, demo === "DataGrid" && styles.demoNavItemActive)),
      h.AriaCurrent(demo === "DataGrid" ? "page" : "false"),
    ], [Icon.view({ icon: Table2, size: 15 }, h), "Data grid"]),
    h.a([
      h.Href(formBuilderPath(model.formEditor.exampleId, model.formEditor.mode)),
      h.Class(className(styles.demoNavItem, demo === "FormBuilder" && styles.demoNavItemActive)),
      h.AriaCurrent(demo === "FormBuilder" ? "page" : "false"),
    ], [Icon.view({ icon: ListChecks, size: 15 }, h), "Form builder"]),
    h.a([
      h.Href(uiKitRouter()),
      h.Class(className(styles.demoNavItem, demo === "UiKit" && styles.demoNavItemActive)),
      h.AriaCurrent(demo === "UiKit" ? "page" : "false"),
    ], [Icon.view({ icon: Blocks, size: 15 }, h), "UI components"]),
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

const palette = (model: Model, h: HtmlBuilder<Message>): Html => {
  const demo = demoFromRoute(model.route);
  const tools = demo === "Workflow" || demo === "FormBuilder"
    ? childRegion(model, "Palette", h)
    : demo === "DataGrid"
      ? h.div([h.Class(className(styles.gridFeatureList))], [
          h.p([h.Class(className(styles.paletteLabel))], ["Initial grid primitives"]),
          h.p([], ["Typed column definitions"]),
          h.p([], ["Headless derived row model"]),
          h.p([], ["Sorting and custom cells"]),
          h.p([], ["Keyboard selection"]),
          h.p([], ["Resizable columns"]),
        ])
      : h.div([h.Class(className(styles.gridFeatureList))], [
          h.p([h.Class(className(styles.paletteLabel))], ["Design system"]),
          h.p([], ["Shared semantic tokens"]),
          h.p([], ["Foldkit-native controls"]),
          h.p([], ["All component variants"]),
          h.p([], ["Controlled interaction states"]),
          h.p([], ["Reusable composition"]),
        ]);
  const hint = demo === "Workflow"
    ? "Node types, sizes, branches, and views are registered by this application. The workflow package owns structure and interaction."
    : demo === "DataGrid"
      ? "The application owns row data and cell rendering. The package owns table derivation and interaction state."
      : demo === "FormBuilder"
        ? "Sections define journey order and reference actors. Drag fields between pages, pages between sections, and sections across the document."
        : "The UI package owns visual primitives and accessible Foldkit composition. Applications keep control of their data and messages.";
  return h.aside(
    [h.Class(className(styles.palette)), h.AriaLabel("Demo navigation and tools")],
    [
      h.div([h.Class(className(styles.brandRow))], [
        h.div([h.Class(className(styles.brandMark)), h.AriaHidden(true)], ["O"]),
        h.p([h.Class(className(styles.brand))], ["Demo"]),
      ]),
      navigation(model, h),
      tools,
      h.p([h.Class(className(styles.paletteHint))], [hint]),
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
        : "Foldkit UI";
  const description = demo === "Workflow"
    ? `${allNodes(model.workflowEditor.document).length} nodes · structured auto-layout`
    : demo === "DataGrid"
      ? `${people.length} people · controlled Foldkit data grid`
      : demo === "FormBuilder"
        ? `${model.formEditor.document.sections.length} sections · ${model.formEditor.document.actors.length} actors`
        : "9 opinionated primitives · shared semantic tokens";
  return Toolbar.view({
    title,
    description,
    actions: [
      ...(demo === "Workflow" || demo === "FormBuilder"
        ? [persistenceBadge(model, h), childRegion(model, "Toolbar", h)]
        : demo === "DataGrid"
          ? [Badge.view({ label: "Headless core + DOM view" }, h)]
          : [
              Badge.view({ label: "9 primitives", tone: "info", dot: true }, h),
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
  if (demo === "Workflow" || demo === "FormBuilder") {
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
    title: `${demo === "DataGrid" ? "Data grid" : demo === "FormBuilder" ? "Form builder" : demo === "UiKit" ? "UI components" : "Workflow"} · Demo`,
    body: h.main(
      [h.Class(className(styles.app, preview && styles.appFormPreview))],
      [
        preview ? h.empty : palette(model, h),
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
