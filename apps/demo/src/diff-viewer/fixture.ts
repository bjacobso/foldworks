import { parseUnifiedDiff } from "@foldworks/diff-viewer";

export const reviewPatch = `diff --git a/apps/demo/src/review/commands.ts b/apps/demo/src/review/commands.ts
index 42b49ad..7c8e510 100644
--- a/apps/demo/src/review/commands.ts
+++ b/apps/demo/src/review/commands.ts
@@ -18,7 +18,14 @@ export const submitReview = (review: Review) =>
 export const publishReview = async (review: Review, client: Client) => {
-  await client.createReview(review);
+  const pending = review.comments.filter((comment) => !comment.resolved);
+  if (pending.length === 0) {
+    throw new Error("Add at least one unresolved comment before publishing");
+  }
+
+  await client.createReview({ ...review, comments: pending });
+  metrics.increment("review.published", { disposition: review.disposition });
 };
${" "}
 export const discardReview = (id: string) => storage.remove(id);
@@ -48,6 +55,12 @@ export const summarizeReview = (review: Review): Summary => ({
   files: new Set(review.comments.map((comment) => comment.path)).size,
   comments: review.comments.length,
+  blocking: review.comments.filter((comment) => comment.severity === "blocking").length,
 });
+
+export const reviewIsReady = (review: Review): boolean =>
+  review.comments.some((comment) => !comment.resolved) &&
+  review.comments.every((comment) => comment.body.trim().length > 0);
diff --git a/apps/demo/src/review/panel.ts b/apps/demo/src/review/panel.ts
new file mode 100644
index 0000000..d3a0183
--- /dev/null
+++ b/apps/demo/src/review/panel.ts
@@ -0,0 +1,24 @@
+import type { Html, HtmlBuilder } from "foldkit/html";
+
+import type { Review, ReviewMessage } from "./model";
+
+export const reviewPanel = (
+  review: Review,
+  h: HtmlBuilder<ReviewMessage>,
+): Html => h.aside([h.Class("review-panel")], [
+  h.header([], [
+    h.h2([], ["Review details"]),
+    h.span([], [\`\${review.comments.length} comments\`]),
+  ]),
+  h.div([h.Class("review-panel__progress")], [
+    h.span([], [\`\${review.viewedFiles.length} / \${review.files.length} viewed\`]),
+  ]),
+  h.ul([], review.comments.map((comment) => h.li([], [
+    h.strong([], [comment.author]),
+    h.p([], [comment.body]),
+  ]))),
+]);
diff --git a/packages/codebase/src/git.ts b/packages/codebase/src/git.ts
index 842f220..a8d96d1 100644
--- a/packages/codebase/src/git.ts
+++ b/packages/codebase/src/git.ts
@@ -71,10 +71,16 @@ export const repositoryChanges = async (root: string) => {
   const output = await git(root, ["status", "--short"]);
-  return output.split("\\n").filter(Boolean).map(parseStatusLine);
+  return output
+    .split("\\n")
+    .filter(Boolean)
+    .map(parseStatusLine)
+    .sort((left, right) => left.path.localeCompare(right.path));
 };
${" "}
-export const diff = (root: string, scope: DiffScope) =>
-  git(root, scope === "staged" ? ["diff", "--cached"] : ["diff"]);
+export const diff = (root: string, scope: DiffScope, path?: string) => {
+  const args = scope === "staged" ? ["diff", "--cached"] : ["diff"];
+  if (path !== undefined) args.push("--", path);
+  return git(root, args);
+};
diff --git a/packages/diff-viewer/README.md b/packages/diff-viewer/README.md
new file mode 100644
index 0000000..f79ab30
--- /dev/null
+++ b/packages/diff-viewer/README.md
@@ -0,0 +1,13 @@
+# Diff viewer
+
+A controlled code review primitive for Foldkit applications.
+
+## Design goals
+
+- Keep repository access outside the renderer.
+- Support unified and side-by-side layouts.
+- Make every changed line keyboard reachable.
+- Keep review comments in application-owned state.
+- Render large patches incrementally.
+
+The demo uses a static patch. Production adapters can provide data from local
+Git, GitHub, GitLab, or an agent workspace without changing the view contract.
diff --git a/apps/demo/src/styles.css b/apps/demo/src/styles.css
index f3b4a79..8b0e49e 100644
--- a/apps/demo/src/styles.css
+++ b/apps/demo/src/styles.css
@@ -7,6 +7,7 @@
 @import "@foldworks/code-editor/styles.css";
 @import "@foldworks/data-grid/styles.css";
 @import "@foldworks/data-table/styles.css";
+@import "@foldworks/diff-viewer/styles.css";
 @import "@foldworks/pdf-annotator/styles.css";
${" "}
 *,
`;

export const reviewFiles = parseUnifiedDiff(reviewPatch);
