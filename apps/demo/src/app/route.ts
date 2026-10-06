import { Option, Schema as S, pipe } from "effect";
import { Route } from "foldkit";
import { defineRouteUnion } from "foldkit/route";

import { DataGridExample } from "../data-grid/example";
import { FormExampleId, FormMode } from "../form-builder/model";

export type Demo =
  | "Docs"
  | "Home"
  | "Editor"
  | "Orchestrator"
  | "Agent"
  | "CodeEditor"
  | "Codebase"
  | "DiffViewer"
  | "Workbench"
  | "Workflow"
  | "Statechart"
  | "DataTable"
  | "DataGrid"
  | "FormBuilder"
  | "QueryBuilder"
  | "Outliner"
  | "PdfAnnotator"
  | "PdfViewer"
  | "UiKit";

export const WorkflowOrientation = S.Literals(["Vertical", "Horizontal"]);
export type WorkflowOrientation = typeof WorkflowOrientation.Type;

export const AppRoute = defineRouteUnion({
  Docs: { package: S.Option(S.String), module: S.Option(S.String) },
  Home: {},
  Editor: {},
  Agent: {},
  Orchestrator: {},
  CodeEditor: {},
  Codebase: {},
  DiffViewer: {},
  Workbench: {},
  Workflow: { orientation: S.Option(WorkflowOrientation) },
  Statechart: {},
  DataTable: { person: S.Option(S.String) },
  DataGrid: { example: S.Option(DataGridExample) },
  FormBuilder: {
    example: S.Option(FormExampleId),
    mode: S.Option(FormMode),
  },
  QueryBuilder: {},
  Outliner: {},
  PdfAnnotator: {},
  PdfViewer: {},
  UiKit: {},
  NotFound: { path: S.String },
});
export type AppRoute = typeof AppRoute.Type;

export const workflowRouter = pipe(
  Route.literal("workflow"),
  Route.query(
    S.Struct({
      orientation: S.OptionFromOptional(WorkflowOrientation),
    }),
  ),
  Route.mapTo(AppRoute.Workflow),
);

export const docsRouter = pipe(
  Route.literal("docs"),
  Route.query(
    S.Struct({ package: S.OptionFromOptional(S.String), module: S.OptionFromOptional(S.String) }),
  ),
  Route.mapTo(AppRoute.Docs),
);

export const homeRouter = pipe(Route.root, Route.mapTo(AppRoute.Home));

export const statechartRouter = pipe(Route.literal("statechart"), Route.mapTo(AppRoute.Statechart));

export const codeEditorRouter = pipe(
  Route.literal("code-editor"),
  Route.mapTo(AppRoute.CodeEditor),
);

export const codebaseRouter = pipe(Route.literal("codebase"), Route.mapTo(AppRoute.Codebase));

export const diffViewerRouter = pipe(
  Route.literal("diff-viewer"),
  Route.mapTo(AppRoute.DiffViewer),
);

export const orchestratorRouter = pipe(
  Route.literal("orchestrator"),
  Route.mapTo(AppRoute.Orchestrator),
);

export const agentRouter = pipe(Route.literal("agent"), Route.mapTo(AppRoute.Agent));

export const workbenchRouter = pipe(Route.literal("workbench"), Route.mapTo(AppRoute.Workbench));

export const dataTableRouter = pipe(
  Route.literal("data-table"),
  Route.query(S.Struct({ person: S.OptionFromOptional(S.String) })),
  Route.mapTo(AppRoute.DataTable),
);

export const dataGridRouter = pipe(
  Route.literal("data-grid"),
  Route.query(S.Struct({ example: S.OptionFromOptional(DataGridExample) })),
  Route.mapTo(AppRoute.DataGrid),
);

export const formBuilderRouter = pipe(
  Route.literal("form-builder"),
  Route.query(
    S.Struct({
      example: S.OptionFromOptional(FormExampleId),
      mode: S.OptionFromOptional(FormMode),
    }),
  ),
  Route.mapTo(AppRoute.FormBuilder),
);

export const uiKitRouter = pipe(Route.literal("ui-kit"), Route.mapTo(AppRoute.UiKit));

export const queryBuilderRouter = pipe(
  Route.literal("query-builder"),
  Route.mapTo(AppRoute.QueryBuilder),
);

export const outlinerRouter = pipe(Route.literal("outliner"), Route.mapTo(AppRoute.Outliner));

export const pdfAnnotatorRouter = pipe(
  Route.literal("pdf-annotator"),
  Route.mapTo(AppRoute.PdfAnnotator),
);

export const pdfViewerRouter = pipe(Route.literal("pdf-viewer"), Route.mapTo(AppRoute.PdfViewer));

export const editorRouter = pipe(Route.literal("editor"), Route.mapTo(AppRoute.Editor));

const routeParser = Route.oneOf(
  docsRouter,
  editorRouter,
  workflowRouter,
  statechartRouter,
  agentRouter,
  orchestratorRouter,
  workbenchRouter,
  codebaseRouter,
  diffViewerRouter,
  codeEditorRouter,
  dataTableRouter,
  dataGridRouter,
  formBuilderRouter,
  queryBuilderRouter,
  outlinerRouter,
  pdfAnnotatorRouter,
  pdfViewerRouter,
  uiKitRouter,
  homeRouter,
);

export const urlToAppRoute = Route.parseUrlWithFallback(routeParser, AppRoute.NotFound);

export const demoFromRoute = (route: AppRoute): Demo => {
  switch (route._tag) {
    case "Docs":
      return "Docs";
    case "Home":
      return "Home";
    case "Editor":
      return "Editor";
    case "Orchestrator":
      return "Orchestrator";
    case "Agent":
      return "Agent";
    case "CodeEditor":
      return "CodeEditor";
    case "Codebase":
      return "Codebase";
    case "DiffViewer":
      return "DiffViewer";
    case "Workbench":
      return "Workbench";
    case "DataTable":
      return "DataTable";
    case "DataGrid":
      return "DataGrid";
    case "FormBuilder":
      return "FormBuilder";
    case "QueryBuilder":
      return "QueryBuilder";
    case "Outliner":
      return "Outliner";
    case "PdfAnnotator":
      return "PdfAnnotator";
    case "PdfViewer":
      return "PdfViewer";
    case "UiKit":
      return "UiKit";
    case "Workflow":
      return "Workflow";
    case "Statechart":
      return "Statechart";
    case "NotFound":
      return "Home";
  }
};

export const formStateFromRoute = (
  route: AppRoute,
): Readonly<{
  exampleId: FormExampleId;
  mode: FormMode;
}> =>
  route._tag === "FormBuilder"
    ? {
        exampleId: Option.getOrElse(route.example, () => "Handoff" as const),
        mode: Option.getOrElse(route.mode, () => "Editor" as const),
      }
    : { exampleId: "Handoff", mode: "Editor" };

export const workflowOrientationFromRoute = (route: AppRoute): WorkflowOrientation =>
  route._tag === "Workflow"
    ? Option.getOrElse(route.orientation, () => "Vertical" as const)
    : "Vertical";

export const workflowPath = (orientation: WorkflowOrientation): string =>
  workflowRouter({ orientation: Option.some(orientation) });

export const dataTablePath = (personId?: string): string =>
  dataTableRouter({
    person: personId === undefined ? Option.none() : Option.some(personId),
  });

export const dataGridPath = (example: DataGridExample = "Worksheet"): string =>
  dataGridRouter({
    example: example === "Worksheet" ? Option.none() : Option.some(example),
  });

export const dataGridExampleFromRoute = (route: AppRoute): DataGridExample =>
  route._tag === "DataGrid"
    ? Option.getOrElse(route.example, () => "Worksheet" as const)
    : "Worksheet";

export const dataTablePersonFromRoute = (route: AppRoute): string =>
  route._tag === "DataTable" ? Option.getOrElse(route.person, () => "") : "";

export const formBuilderPath = (exampleId: FormExampleId, mode: FormMode): string =>
  formBuilderRouter({
    example: Option.some(exampleId),
    mode: Option.some(mode),
  });
