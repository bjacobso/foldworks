import { Schema as S } from "effect";
import { CodeEditor } from "foldworks/code-editor";
import { ReviewThreads, ChangedFiles, Thread, Verdict } from "foldworks/review";
import { initialFiles, editorFor, storageKey } from "./fixture";

export const FileState = S.Struct({ path: S.String, baseText: S.String, text: S.String });
export const Range = S.Struct({
  path: S.String,
  side: S.Literals(["old", "new"]),
  startLine: S.Number,
  endLine: S.Number,
});
export const Anchor = S.Struct({ ...Range.fields, revisionText: S.String, originalText: S.String });
export type Anchor = typeof Anchor.Type;
export const ReviewThread = Thread(Anchor);
export type ReviewThread = typeof ReviewThread.Type;
export const Activity = S.Struct({
  id: S.String,
  title: S.String,
  actor: S.String,
  timestamp: S.String,
  context: S.String,
  kind: S.String,
  changes: S.Array(S.Struct({ label: S.String, before: S.String, after: S.String })),
});
export const Model = S.Struct({
  files: S.Array(FileState),
  editor: CodeEditor.Model,
  activePath: S.String,
  threads: S.Array(ReviewThread),
  reviewUi: ReviewThreads.Model,
  filesUi: ChangedFiles.Model,
  draftAnchors: S.Record(S.String, Anchor),
  selection: S.NullOr(Range),
  dragging: S.Boolean,
  mode: S.Literals(["Unified", "Split"]),
  semantic: S.Boolean,
  viewedPaths: S.Array(S.String),
  expandedGaps: S.Array(S.String),
  actor: S.Literals(["author", "reviewer"]),
  status: S.Literals(["draft", "open", "merged", "closed"]),
  summary: S.String,
  verdict: Verdict,
  reviews: S.Array(S.Struct({ verdict: Verdict, summary: S.String, revision: S.String })),
  activity: S.Array(Activity),
  nextId: S.Number,
  announcement: S.String,
  storageError: S.String,
  dark: S.Boolean,
});
export type Model = typeof Model.Type;
export const freshModel = (): Model => ({
  files: initialFiles,
  editor: editorFor(initialFiles[0]!.path).init({
    id: "change-request-editor",
    uri: initialFiles[0]!.path,
    languageId: "json",
    text: initialFiles[0]!.text,
  }),
  activePath: initialFiles[0]!.path,
  threads: [],
  reviewUi: ReviewThreads.init({ id: "change-request-review" }),
  filesUi: ChangedFiles.init({
    id: "change-request-files",
    files: initialFiles.map((f) => ({ ...f, status: "modified", additions: 0, deletions: 0 })),
  }),
  draftAnchors: {},
  selection: null,
  dragging: false,
  mode: "Unified",
  semantic: false,
  viewedPaths: [],
  expandedGaps: [],
  actor: "author",
  status: "draft",
  summary: "",
  verdict: "comment",
  reviews: [],
  activity: [],
  nextId: 1,
  announcement: "Local configuration workspace ready.",
  storageError: "",
  dark: false,
});
const restore = (): Model => {
  if (typeof localStorage === "undefined") return freshModel();
  try {
    const text = localStorage.getItem(storageKey);
    if (!text) return freshModel();
    const saved = S.decodeUnknownSync(Model)(JSON.parse(text));
    const file = saved.files.find((f) => f.path === saved.activePath) ?? saved.files[0];
    if (!file) return freshModel();
    return {
      ...saved,
      dragging: false,
      editor: editorFor(file.path).init({
        id: "change-request-editor",
        uri: file.path,
        languageId: "json",
        text: file.text,
      }),
    };
  } catch {
    return {
      ...freshModel(),
      storageError: "Saved simulation could not be read. This session starts fresh.",
    };
  }
};
export const initialModel = restore();
