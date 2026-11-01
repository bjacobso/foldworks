import { describe, expect, it } from "vitest";
import { ReviewThreads } from "foldworks/review";
import { CodeEditor } from "foldworks/code-editor";
import { Message } from "./message";
import { freshModel, type Model } from "./model";
import { proposedFlags, suggestedFlags, editorFor } from "./fixture";
import { update } from "./update";
import { checks, mappedThread, canMerge } from "./domain";
const reduce = (model: Model, message: Message) => update(model, message).model;
const child = (model: Model, message: ReviewThreads.Message) =>
  reduce(model, Message.GotThreadsMessage({ message }));
const proposal = (): Model => {
  const model = freshModel(),
    file = model.files[0]!;
  return {
    ...model,
    files: model.files.map((f) => (f.path === file.path ? { ...f, text: proposedFlags } : f)),
    editor: editorFor(file.path).init({
      id: model.editor.id,
      uri: file.path,
      languageId: "json",
      text: proposedFlags,
    }),
  };
};
const comment = (
  model: Model,
  start: number,
  end: number,
  body: string,
  suggestion = false,
): Model => {
  model = reduce(
    model,
    Message.StartedSelection({ path: model.activePath, side: "new", line: start }),
  );
  model = reduce(
    model,
    Message.ExtendedSelection({
      path: model.activePath,
      side: "new",
      line: end,
      method: "Keyboard",
    }),
  );
  model = reduce(model, Message.EndedSelection());
  const draftKey = model.reviewUi.composerKey;
  model = child(model, ReviewThreads.Message.ChangedDraft({ draftKey, value: body }));
  const expected = proposedFlags
    .trimEnd()
    .split("\n")
    .slice(start - 1, end)
    .join("\n");
  if (suggestion) {
    model = child(
      model,
      ReviewThreads.Message.ToggledSuggestion({ draftKey, enabled: true, value: expected }),
    );
    model = child(
      model,
      ReviewThreads.Message.ChangedSuggestion({ draftKey, value: suggestedFlags }),
    );
  }
  return child(
    model,
    ReviewThreads.Message.Submitted({
      draftKey,
      kind: "create",
      targetId: draftKey,
      ...(suggestion
        ? {
            suggestionAnchor: {
              path: model.activePath,
              startLine: start,
              endLine: end,
              expected,
            },
          }
        : {}),
    }),
  );
};
describe("local change request", () => {
  it("completes pending review, suggestion, anchor remapping, current approval and merge history", () => {
    let model = reduce(proposal(), Message.OpenedRequest());
    expect(checks(model).map((c) => c.status)).toEqual(["passed", "failed"]);
    model = reduce(model, Message.SwitchedActor({ actor: "reviewer" }));
    model = comment(model, 4, 4, "Remove this temporary note.");
    model = comment(model, 3, 4, "Use a smaller rollout.", true);
    expect(model.threads.every((t) => t.comments[0]!.pending)).toBe(true);
    expect(model.reviewUi.drafts).toEqual({});
    model = reduce(model, Message.ChangedVerdict({ verdict: "request-changes" }));
    model = reduce(model, Message.SubmittedReview());
    model = reduce(model, Message.SwitchedActor({ actor: "author" }));
    const thread = model.threads[1]!;
    model = reduce(
      model,
      Message.AppliedSuggestion({
        threadId: thread.id,
        suggestion: thread.comments[0]!.suggestion!,
      }),
    );
    expect(mappedThread(model, model.threads[0]!).state).toBe("outdated");
    expect(mappedThread(model, model.threads[1]!).state).toBe("moved");
    expect(model.threads[1]!.status).toBe("resolved");
    expect(checks(model).every((c) => c.status === "passed")).toBe(true);
    expect(canMerge(model)).toBe(false);
    model = reduce(model, Message.SwitchedActor({ actor: "reviewer" }));
    model = reduce(model, Message.ChangedVerdict({ verdict: "approve" }));
    model = reduce(model, Message.SubmittedReview());
    model = reduce(model, Message.SwitchedActor({ actor: "author" }));
    expect(canMerge(model)).toBe(true);
    const merged = reduce(model, Message.Merged());
    expect(merged.status).toBe("merged");
    expect(merged.files.every((f) => f.text === f.baseText)).toBe(true);
    expect(merged.activity.map((e) => e.kind)).toContain("suggestion");
    expect(merged.activity.at(-1)!.title).toBe("Configuration merged locally");
    const stale = {
      ...model,
      files: model.files.map((f, i) =>
        i === 0 ? { ...f, text: f.text.replace('"rollout": 25', '"rollout": 20') } : f,
      ),
    };
    expect(canMerge(stale)).toBe(false);
  });
  it("blocks unauthorized merge/application and preserves text on stale suggestions", () => {
    let model = reduce(proposal(), Message.OpenedRequest());
    model = reduce(model, Message.SwitchedActor({ actor: "reviewer" }));
    model = comment(model, 3, 4, "Suggestion", true);
    model = reduce(model, Message.SubmittedReview());
    const suggestion = model.threads[0]!.comments[0]!.suggestion!;
    expect(
      reduce(model, Message.AppliedSuggestion({ suggestion, threadId: model.threads[0]!.id }))
        .files,
    ).toEqual(model.files);
    model = reduce(model, Message.SwitchedActor({ actor: "author" }));
    model = {
      ...model,
      files: model.files.map((f, i) =>
        i === 0 ? { ...f, text: f.text.replace('"rollout": 100', '"rollout": 99') } : f,
      ),
    };
    const next = reduce(
      model,
      Message.AppliedSuggestion({ suggestion, threadId: model.threads[0]!.id }),
    );
    expect(next.files).toEqual(model.files);
    expect(next.announcement).toContain("stale");
    expect(reduce(next, Message.Merged()).status).toBe("open");
  });
  it("validates editor messages and retains draft data when persistence fails", () => {
    let model = freshModel();
    model = reduce(
      model,
      Message.GotEditorMessage({
        message: CodeEditor.execute(
          CodeEditor.Operation.ReplaceDocument({
            uri: model.activePath,
            text: '{"checkout":"yes","rollout":0}',
            languageId: "json",
          }),
        ),
      }),
    );
    expect(checks(model)[0]!.status).toBe("failed");
    model = child(
      model,
      ReviewThreads.Message.ChangedDraft({ draftKey: "anchor", value: "Keep me" }),
    );
    expect(
      reduce(model, Message.Persisted({ error: "Storage unavailable" })).reviewUi.drafts.anchor,
    ).toBe("Keep me");
  });
});

it("advances the editor session when switching files to reject delayed native events", () => {
  const initial = freshModel();
  const next = reduce(initial, Message.SelectedFile({ path: "config/access.json" }));
  expect(next.editor.document.session).toBeGreaterThan(initial.editor.document.session);
  expect(next.editor.document.uri).toBe("config/access.json");
});
