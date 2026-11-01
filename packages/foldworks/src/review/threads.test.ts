import { Schema as S } from "effect";
import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { expect, it } from "vitest";
import { Comment, Thread } from "./data";
import * as Threads from "./threads";

const initial = Threads.init({ id: "review" });
const comment = {
  id: "c",
  author: { id: "u", name: "Reviewer" },
  body: "Plain <script>\ntext",
  createdAt: "2026-10-16",
};
const thread = {
  id: "t",
  anchor: { path: "flags.json" },
  status: "open" as const,
  comments: [comment],
};
it("decodes generic anchors and comments", () => {
  expect(S.decodeUnknownSync(Thread(S.Struct({ path: S.String })))(thread)).toEqual(thread);
  expect(S.is(Comment)({ ...comment, author: "wrong" })).toBe(false);
});
it("retains failed drafts and protects newer typing against delayed acknowledgements", () => {
  let model = Threads.update(
    initial,
    Threads.Message.ChangedDraft({ draftKey: "a", value: "draft" }),
  ).model;
  const submitted = Threads.update(
    model,
    Threads.Message.Submitted({ draftKey: "a", kind: "create", targetId: "anchor" }),
  );
  expect(submitted.outMessage).toMatchObject({
    _tag: "RequestedCreateThread",
    anchorKey: "anchor",
    body: "draft",
  });
  expect(submitted.model.drafts.a).toBe("draft");
  model = Threads.update(
    model,
    Threads.Message.ChangedDraft({ draftKey: "a", value: "new draft" }),
  ).model;
  expect(
    Threads.update(model, Threads.Message.Committed({ draftKey: "a", body: "draft" })).model.drafts
      .a,
  ).toBe("new draft");
  expect(
    Threads.update(model, Threads.Message.Committed({ draftKey: "a", body: "new draft" })).model
      .drafts.a,
  ).toBeUndefined();
});
it("keeps drafts when cancelling and emits host-owned mutations", () => {
  const model = {
    ...initial,
    composerKey: "reply:t",
    drafts: { "reply:t": "reply" },
    returnFocusId: "gutter",
  };
  expect(Threads.update(model, Threads.Message.Cancelled()).model.drafts).toEqual(model.drafts);
  expect(Threads.update(model, Threads.Message.Cancelled()).commands).toHaveLength(1);
  for (const kind of ["reply", "edit"] as const)
    expect(
      Threads.update(model, Threads.Message.Submitted({ draftKey: "reply:t", kind, targetId: "t" }))
        .outMessage?._tag,
    ).toBe(kind === "reply" ? "RequestedReply" : "RequestedEdit");
  expect(
    Threads.update(model, Threads.Message.RequestedResolve({ threadId: "t" })).outMessage?._tag,
  ).toBe("RequestedResolve");
});
it("renders pending-safe plain text, resolved expansion, composer keys and a single list tab stop", () => {
  const h = inertHtml as unknown as HtmlBuilder<Threads.Message>;
  const config = { model: initial, toMessage: (m: Threads.Message) => m, thread };
  expect(Scene.findAll(Threads.threadView(config, h)!, "script")).toHaveLength(0);
  expect(
    Scene.findAll(
      Threads.threadView({ ...config, thread: { ...thread, status: "resolved" } }, h)!,
      ".fk-review__comment",
    ),
  ).toHaveLength(0);
  const list = Threads.listView(
    { ...config, threads: [thread, { ...thread, id: "t2" }], groupBy: (t) => t.anchor.path },
    h,
  )!;
  expect(Scene.findAll(list, '[tabIndex="0"]')).toHaveLength(1);
  expect(Scene.findAll(list, '[role="option"]')).toHaveLength(2);
  const composer = Threads.composerView(
    { ...config, draftKey: "new", targetId: "new", kind: "create" },
    h,
  )!;
  expect(Scene.findAll(composer, "textarea")).toHaveLength(1);
});

it("retains newer suggestion edits across acknowledgements and clears matching suggestion drafts", () => {
  let model = Threads.update(
    initial,
    Threads.Message.ChangedDraft({ draftKey: "s", value: "Try this" }),
  ).model;
  model = Threads.update(
    model,
    Threads.Message.ToggledSuggestion({ draftKey: "s", enabled: true, value: "old" }),
  ).model;
  model = Threads.update(
    model,
    Threads.Message.ChangedSuggestion({ draftKey: "s", value: "newer" }),
  ).model;
  const suggestion = { path: "f", startLine: 1, endLine: 1, expected: "old", replacement: "saved" };
  expect(
    Threads.update(
      model,
      Threads.Message.Committed({ draftKey: "s", body: "Try this", suggestion }),
    ).model.suggestionDrafts.s,
  ).toBe("newer");
  const committed = Threads.update(
    model,
    Threads.Message.Committed({
      draftKey: "s",
      body: "Try this",
      suggestion: { ...suggestion, replacement: "newer" },
    }),
  ).model;
  expect(committed.suggestionKeys).toEqual([]);
  expect(committed.suggestionDrafts.s).toBeUndefined();
});

it("submits current suggestion text even before a view refresh", () => {
  let model = {
    ...initial,
    drafts: { s: "Try this" },
    suggestionKeys: ["s"],
    suggestionDrafts: { s: "fresh replacement" },
  };
  const result = Threads.update(
    model,
    Threads.Message.Submitted({
      draftKey: "s",
      targetId: "anchor",
      kind: "create",
      suggestionAnchor: { path: "f", startLine: 1, endLine: 1, expected: "old" },
    }),
  );
  expect(result.outMessage).toMatchObject({ suggestion: { replacement: "fresh replacement" } });
});

it("retains a draft if the suggestion was removed during its save", () => {
  const model = {
    ...initial,
    drafts: { s: "body" },
    suggestionKeys: [],
    suggestionDrafts: { s: "replacement" },
  };
  const saved = {
    path: "f",
    startLine: 1,
    endLine: 1,
    expected: "old",
    replacement: "replacement",
  };
  expect(
    Threads.update(
      model,
      Threads.Message.Committed({ draftKey: "s", body: "body", suggestion: saved }),
    ).model.drafts.s,
  ).toBe("body");
});
