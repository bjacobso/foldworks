import { expect, it } from "vitest";
import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { ReviewSubmit, ReviewerList } from "./submission";
import { threadView, init } from "./threads";
const h = inertHtml as unknown as HtmlBuilder<string>;
it("restricts verdicts and disables submission for a disallowed choice", () => {
  const html = ReviewSubmit.view(
    {
      summary: "",
      verdict: "approve",
      pendingCount: 2,
      allowedVerdicts: ["comment"],
      onSummaryChange: () => "summary",
      onVerdictChange: () => "verdict",
      onSubmit: "submit",
    },
    h,
  )!;
  expect(Scene.findAll(html, "button")).toHaveLength(2);
  expect(Scene.findAll(html, "button[disabled]")).toHaveLength(1);
  expect(
    Scene.findAll(
      ReviewerList.view(
        {
          reviewers: [
            {
              author: { id: "r", name: "Reviewer" },
              required: true,
              ownedFileCount: 2,
              verdict: "request-changes",
            },
          ],
        },
        h,
      )!,
      '[data-verdict="request-changes"]',
    ),
  ).toHaveLength(1);
});
it("shows pending suggestions and exposes application only when supplied by the host", () => {
  const thread = {
    id: "t",
    anchor: 1,
    status: "open" as const,
    comments: [
      {
        id: "c",
        author: { id: "r", name: "R" },
        createdAt: "today",
        body: "Use this",
        pending: true,
        suggestion: { path: "f", startLine: 1, endLine: 1, expected: "a", replacement: "b" },
      },
    ],
  };
  const html = threadView(
    {
      model: init({ id: "t" }),
      thread,
      toMessage: () => "message",
      onApplySuggestion: () => "apply",
    },
    h,
  )!;
  expect(Scene.findAll(html, "ins")).toHaveLength(1);
  expect(Scene.findAll(html, ".fk-diff-viewer")).toHaveLength(1);
});
