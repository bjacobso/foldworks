import * as Alchemy from "alchemy";
import * as Output from "alchemy/Output";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "Foldworks",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    const demo = yield* Cloudflare.Website.Foldkit("Demo", {
      rootDir: "apps/demo",
      // The demo Vite build also emits the private Forma app at /forma/.
      memo: { workspaces: [{ cwd: "../forma-workbench" }, { cwd: "../../packages" }] },
      domain:
        stage === "prod" ? { name: "foldworks.dev", aliases: ["www.foldworks.dev"] } : undefined,
    });

    return {
      demo: demo.url,
      formaWorkbench:
        stage === "prod"
          ? "https://foldworks.dev/forma/"
          : Output.map(demo.url, (url) => (url ? new URL("/forma/", url).href : undefined)),
    };
  }),
);
