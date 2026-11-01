import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { makeOAuthClient, OAuthError } from "alchemy/Auth/OAuthFlow";
import { createHash } from "node:crypto";
import { Effect, Result } from "effect";
import { WebCrypto } from "effect/crypto";
import { effect, expect } from "@effect/vitest";

effect("loads the deployment APIs with the shared Effect runtime", () =>
  Effect.sync(() => {
    expect(Alchemy.Stack).toBeTypeOf("function");
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
      expect(result.failure).toBeInstanceOf(OAuthError);
      expect(result.failure.error).toBe("crypto_error");
    }
  }),
);
