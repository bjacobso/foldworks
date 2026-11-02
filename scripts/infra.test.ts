import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import { makeOAuthClient, OAuthCryptoError } from "alchemy/Auth/OAuthFlow";
import cloudflareContributions from "@alchemy.run/cloudflare/Contributions";
import deployment from "../alchemy.run";
import * as State from "alchemy/State";
import { createHash } from "node:crypto";
import { Effect, Result } from "effect";
import { WebCrypto } from "effect/crypto";
import { effect, expect } from "@effect/vitest";

effect("loads the deployment APIs with the shared Effect runtime", () =>
  Effect.sync(() => {
    expect(Alchemy.Stack).toBeTypeOf("function");
    expect(Effect.isEffect(deployment)).toBe(true);
    expect(Cloudflare.Website.Foldkit).toBeTypeOf("function");
    expect(Cloudflare.providers).toBeTypeOf("function");
    expect(Cloudflare.state).toBeTypeOf("function");
  }),
);

const oauthClient = makeOAuthClient({
  clientId: "offline-compatibility-test",
  endpoints: {
    authorize: "https://example.com/authorize",
    token: "https://example.com/token",
  },
  redirectUri: "https://example.com/callback",
  localCallbackUri: "http://127.0.0.1:9999/callback",
  auth: { kind: "pkce" },
});

effect("generates secure OAuth state and a matching S256 PKCE challenge offline", () =>
  Effect.gen(function* () {
    const authorization = yield* oauthClient.authorize(["read"]);
    const second = yield* oauthClient.authorize(["read"]);
    const url = new URL(authorization.url);
    expect(authorization.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.state).not.toBe(authorization.state);
    expect(authorization.verifier).toMatch(/^[A-Za-z0-9_-]{128}$/);
    expect(second.verifier).not.toBe(authorization.verifier);
    expect(url.searchParams.get("state")).toBe(authorization.state);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(
      createHash("sha256").update(authorization.verifier!).digest("base64url"),
    );
  }),
);

effect("keeps secure-random failures inside the OAuth error boundary", () =>
  Effect.gen(function* () {
    const result = yield* oauthClient.authorize().pipe(
      Effect.provideService(WebCrypto.WebCrypto, {
        ...globalThis.crypto,
        getRandomValues: () => {
          throw new Error("random source unavailable");
        },
      }),
      Effect.result,
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(OAuthCryptoError);
      expect(result.failure).toMatchObject({ operation: "Secure random generation" });
    }
  }),
);

effect("keeps digest failures inside the OAuth crypto error boundary", () =>
  Effect.gen(function* () {
    const result = yield* oauthClient.authorize().pipe(
      Effect.provideService(WebCrypto.WebCrypto, {
        randomUUID: globalThis.crypto.randomUUID.bind(globalThis.crypto),
        getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
        subtle: {
          digest: () => Promise.reject(new Error("digest unavailable")),
        } as unknown as SubtleCrypto,
      }),
      Effect.result,
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure).toBeInstanceOf(OAuthCryptoError);
      expect(result.failure).toMatchObject({ operation: "PKCE digest" });
    }
  }),
);

effect("loads the Cloudflare state-store contribution and lifecycle offline", () =>
  Effect.gen(function* () {
    const store = yield* cloudflareContributions.stateStores!.cloudflare!.load;
    expect(store.layer).toBeTypeOf("function");
    expect(store.lifecycle?.bootstrap).toBeTypeOf("function");
    expect(store.lifecycle?.teardown).toBeTypeOf("function");
  }),
);

effect("reads preview outputs through the state path without sharing production state", () =>
  Effect.gen(function* () {
    const store = yield* Effect.flatten(State.State);
    yield* store.setOutput({
      stack: "Foldworks",
      stage: "prod",
      value: { demo: "https://foldworks.dev" },
    });
    yield* store.setOutput({
      stack: "Foldworks",
      stage: "pr-42",
      value: { demo: "https://foldworks-pr-42.example.workers.dev" },
    });
    const entries = yield* State.readState({ path: "Foldworks/pr-42/output" });
    expect(entries).toEqual([
      {
        path: "Foldworks/pr-42/output",
        kind: "output",
        value: { demo: "https://foldworks-pr-42.example.workers.dev" },
      },
    ]);
    yield* store.deleteStack({ stack: "Foldworks", stage: "pr-42" });
    expect(yield* store.getOutput({ stack: "Foldworks", stage: "pr-42" })).toBeUndefined();
    expect(yield* store.getOutput({ stack: "Foldworks", stage: "prod" })).toEqual({
      demo: "https://foldworks.dev",
    });
  }).pipe(Effect.provide(Alchemy.inMemoryState())),
);
