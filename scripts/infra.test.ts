import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";
import { effect, expect } from "@effect/vitest";

effect("loads the deployment APIs with the shared Effect runtime", () =>
  Effect.sync(() => {
    expect(Alchemy.Stack).toBeTypeOf("function");
    expect(Cloudflare.Website.Foldkit).toBeTypeOf("function");
    expect(Cloudflare.providers).toBeTypeOf("function");
    expect(Cloudflare.state).toBeTypeOf("function");
  }),
);
