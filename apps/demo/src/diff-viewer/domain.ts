import { diffFile, mapRange, type JsonValue, type RangeMapping } from "@foldworks/diff-viewer";
import { highlight } from "@foldworks/code-editor";
import { validate } from "@foldworks/code-editor/structured";
import type { Check } from "@foldworks/review";
import type { ChangedFiles } from "@foldworks/review";
import type { Model, ReviewThread } from "./model";
import { Flags, Access } from "./fixture";

export const currentFile = (model: Model) => model.files.find((f) => f.path === model.activePath)!;
export const fileDiff = (file: Model["files"][number]) =>
  diffFile({ path: file.path, oldText: file.baseText, newText: file.text, context: 3 });
export const revisionKey = (model: Model) =>
  JSON.stringify(model.files.map((f) => [f.path, f.text]));
export const diagnostics = (file: Model["files"][number]) =>
  validate(file.path.endsWith("flags.json") ? Flags : Access, {
    uri: file.path,
    session: 0,
    revision: 0,
    languageId: "json",
    text: file.text,
    lineEnding: "lf",
  });
export const mappedThread = (model: Model, thread: ReviewThread): RangeMapping => {
  const file = model.files.find((f) => f.path === thread.anchor.path);
  if (!file) return { state: "outdated", reason: "unknown" };
  const from = diffFile({
    path: file.path,
    oldText: thread.anchor.revisionText,
    newText: thread.anchor.revisionText,
  });
  const mapping = mapRange(from, thread.anchor, fileDiff(file));
  return mapping.state !== "outdated" && thread.anchor.originalText !== thread.anchor.revisionText
    ? { ...mapping, state: "moved" }
    : mapping;
};
export const changedFiles = (model: Model): readonly ChangedFiles.ChangedFile[] =>
  model.files
    .filter((f) => f.text !== f.baseText)
    .map((file) => {
      const diff = fileDiff(file),
        issues = diagnostics(file);
      return {
        path: file.path,
        status: diff.status,
        additions: diff.additions,
        deletions: diff.deletions,
        viewed: model.viewedPaths.includes(file.path),
        openThreads: model.threads.filter((t) => t.anchor.path === file.path && t.status === "open")
          .length,
        ...(issues.length ? { annotationTone: "danger" as const } : {}),
      };
    });
export const checks = (model: Model): readonly Check[] => {
  const issues = model.files.flatMap(diagnostics);
  let policy = false;
  try {
    const flags = JSON.parse(model.files.find((f) => f.path.endsWith("flags.json"))!.text);
    const access = JSON.parse(model.files.find((f) => f.path.endsWith("access.json"))!.text);
    policy = (!flags.checkout || flags.rollout <= 25) && access.requireApproval === true;
  } catch {
    /* invalid syntax is also a failed policy input */
  }
  return [
    {
      id: "schema",
      name: "Local schema validation",
      status: issues.length ? "failed" : "passed",
      summary: issues.length
        ? `${issues.length} configuration diagnostics`
        : "Both files satisfy their Effect schemas.",
    },
    {
      id: "policy",
      name: "Local rollout policy",
      status: policy ? "passed" : "failed",
      summary: "Illustrative policy: checkout rollout ≤25% and access changes require approval.",
    },
  ];
};
export const openCurrentThreads = (model: Model) =>
  model.threads.filter((t) => t.status === "open" && mappedThread(model, t).state !== "outdated");
export const approved = (model: Model) =>
  model.reviews.at(-1)?.verdict === "approve" &&
  model.reviews.at(-1)?.revision === revisionKey(model);
export const canMerge = (model: Model) =>
  model.actor === "author" &&
  model.status === "open" &&
  approved(model) &&
  checks(model).every((c) => c.status === "passed") &&
  !openCurrentThreads(model).length &&
  !model.threads.some((t) => t.comments.some((c) => c.pending));
export const parseValue = (text: string): JsonValue | undefined => {
  try {
    return JSON.parse(text) as JsonValue;
  } catch {
    return undefined;
  }
};

/** Adapt the editor lexer to the shared UTF-16 semantic-token vocabulary. */
export const reviewHighlight = (content: string, language: string) => {
  let offset = 0;
  return (highlight(content, language)[0] ?? []).map((token) => {
    const from = offset;
    offset += token.text.length;
    return { from, to: offset, kind: token.kind };
  });
};
