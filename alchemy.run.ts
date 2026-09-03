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
    });

    return {
      demo: demo.url,
    };
  }),
);
