import { Option, Schema as S, pipe } from "effect";
import { Route } from "foldkit";
import { defineRouteUnion } from "foldkit/route";

import { FormExampleId, FormMode } from "../form-builder/model";

export type Demo = "Workflow" | "DataGrid" | "FormBuilder";

export const AppRoute = defineRouteUnion({
  Workflow: {},
  DataGrid: {},
  FormBuilder: {
    example: S.Option(FormExampleId),
    mode: S.Option(FormMode),
  },
  NotFound: { path: S.String },
});
export type AppRoute = typeof AppRoute.Type;

export const workflowRouter = pipe(
  Route.literal("workflow"),
  Route.mapTo(AppRoute.Workflow),
);

const rootRouter = pipe(Route.root, Route.mapTo(AppRoute.Workflow));

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

const routeParser = Route.oneOf(
  workflowRouter,
  dataGridRouter,
  formBuilderRouter,
  rootRouter,
);

export const urlToAppRoute = Route.parseUrlWithFallback(
  routeParser,
  AppRoute.NotFound,
);

export const demoFromRoute = (route: AppRoute): Demo => {
  switch (route._tag) {
    case "DataGrid": return "DataGrid";
    case "FormBuilder": return "FormBuilder";
    case "NotFound":
    case "Workflow": return "Workflow";
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

export const formBuilderPath = (
  exampleId: FormExampleId,
  mode: FormMode,
): string => formBuilderRouter({
  example: Option.some(exampleId),
  mode: Option.some(mode),
});
