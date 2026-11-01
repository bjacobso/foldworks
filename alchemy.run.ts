import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "Foldworks",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const demo = yield* Cloudflare.Website.Foldkit("Demo", {
      rootDir: "apps/demo",
      // The demo Vite build also emits the private Forma app at /forma/.
      memo: { workspaces: [{ cwd: "../forma-workbench" }, { cwd: "../../packages" }] },
      domain: {
        name: "foldworks.dev",
        aliases: ["www.foldworks.dev"],
      },
    });

    return {
      demo: demo.url,
      formaWorkbench: "https://foldworks.dev/forma/",
    };
  }),
);
