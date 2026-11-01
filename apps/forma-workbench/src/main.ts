import { Runtime } from "foldkit";
import { TsLanguageHost } from "@formalang/host/ts-host";
import { Workspace } from "./workbench/index";
import { projects } from "./projects";

const application = Runtime.makeElement({
  Model: Workspace.Model,
  init: () =>
    Workspace.init({
      id: "workbench",
      projects,
      project: new URLSearchParams(window.location.search).get("project") ?? projects[0]!.id,
    }),
  update: Workspace.update,
  view: Workspace.view,
  container: document.getElementById("root"),
  resources: Workspace.layer(new TsLanguageHost(), projects),
  // Report slow phases without sending the whole program model through Vite's console bridge.
  slow: {
    onSlow: ({ _tag, durationMs }) =>
      console.warn(`[foldkit] Slow ${_tag}: ${durationMs.toFixed(1)}ms`),
  },
});

Runtime.run(application);
