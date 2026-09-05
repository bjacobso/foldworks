import { Option, Schema as S, pipe } from "effect";
import { Route } from "foldkit";
import { defineRouteUnion } from "foldkit/route";

import { FormExampleId, FormMode } from "../form-builder/model";

export type Demo = "Home" | "Workbench" | "Workflow" | "DataGrid" | "FormBuilder" | "QueryBuilder" | "PdfAnnotator" | "UiKit";

export const WorkflowOrientation = S.Literals(["Vertical", "Horizontal"]);
export type WorkflowOrientation = typeof WorkflowOrientation.Type;

export const AppRoute = defineRouteUnion({
  Home: {},
  Workbench: {},
  Workflow: { orientation: S.Option(WorkflowOrientation) },
  DataGrid: {},
  FormBuilder: {
    example: S.Option(FormExampleId),
    mode: S.Option(FormMode),
  },
  QueryBuilder: {},
  PdfAnnotator: {},
  UiKit: {},
  NotFound: { path: S.String },
});
export type AppRoute = typeof AppRoute.Type;

export const workflowRouter = pipe(
  Route.literal("workflow"),
  Route.query(S.Struct({
    orientation: S.OptionFromOptional(WorkflowOrientation),
  })),
  Route.mapTo(AppRoute.Workflow),
);

export const homeRouter = pipe(
  Route.root,
  Route.mapTo(AppRoute.Home),
);

export const workbenchRouter = pipe(Route.literal("workbench"), Route.mapTo(AppRoute.Workbench));

export const dataGridRouter = pipe(
  Route.literal("data-grid"),
  Route.mapTo(AppRoute.DataGrid),
);

export const formBuilderRouter = pipe(
  Route.literal("form-builder"),
  Route.query(S.Struct({
    example: S.OptionFromOptional(FormExampleId),
    mode: S.OptionFromOptional(FormMode),
  })),
  Route.mapTo(AppRoute.FormBuilder),
);

export const uiKitRouter = pipe(
  Route.literal("ui-kit"),
  Route.mapTo(AppRoute.UiKit),
);

export const queryBuilderRouter = pipe(
  Route.literal("query-builder"),
  Route.mapTo(AppRoute.QueryBuilder),
);

export const pdfAnnotatorRouter = pipe(
  Route.literal("pdf-annotator"),
  Route.mapTo(AppRoute.PdfAnnotator),
);

const routeParser = Route.oneOf(
  workflowRouter,
  workbenchRouter,
  dataGridRouter,
  formBuilderRouter,
  queryBuilderRouter,
  pdfAnnotatorRouter,
  uiKitRouter,
  homeRouter,
);

export const urlToAppRoute = Route.parseUrlWithFallback(
  routeParser,
  AppRoute.NotFound,
);

export const demoFromRoute = (route: AppRoute): Demo => {
  switch (route._tag) {
    case "Home": return "Home";
    case "Workbench": return "Workbench";
    case "DataGrid": return "DataGrid";
    case "FormBuilder": return "FormBuilder";
    case "QueryBuilder": return "QueryBuilder";
    case "PdfAnnotator": return "PdfAnnotator";
    case "UiKit": return "UiKit";
    case "Workflow": return "Workflow";
    case "NotFound": return "Home";
  }
};

export const formStateFromRoute = (route: AppRoute): Readonly<{
  exampleId: FormExampleId;
  mode: FormMode;
}> => route._tag === "FormBuilder"
  ? {
      exampleId: Option.getOrElse(route.example, () => "Handoff" as const),
      mode: Option.getOrElse(route.mode, () => "Editor" as const),
    }
  : { exampleId: "Handoff", mode: "Editor" };

export const workflowOrientationFromRoute = (
  route: AppRoute,
): WorkflowOrientation => route._tag === "Workflow"
  ? Option.getOrElse(route.orientation, () => "Vertical" as const)
  : "Vertical";

export const workflowPath = (orientation: WorkflowOrientation): string =>
  workflowRouter({ orientation: Option.some(orientation) });

export const formBuilderPath = (
  exampleId: FormExampleId,
  mode: FormMode,
): string => formBuilderRouter({
  example: Option.some(exampleId),
  mode: Option.some(mode),
});
