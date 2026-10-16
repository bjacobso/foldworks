import { expect, it } from "vitest";
import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { CheckList, checkSummary, MergeReadiness, ChangeRequestHeader } from "./chrome";
import * as Files from "./files";
const h = inertHtml as unknown as HtmlBuilder<string>;
const files = [
  {
    path: "config/a.json",
    status: "modified" as const,
    additions: 2,
    deletions: 1,
    openThreads: 2,
  },
  { path: "config/b.json", status: "added" as const, additions: 4, deletions: 0, viewed: true },
];
it("aggregates directory counts and filters viewed files without owning them", () => {
  const model = Files.init({ id: "files", files });
  expect(Files.fileNodes(files)[0]!.label).toContain("+6 −1 · 2 open threads");
  expect(Files.visibleFiles({ ...model, onlyUnviewed: true }, { files })).toHaveLength(1);
  expect(Files.fileNodes(files, "flat")).toHaveLength(2);
  expect(
    Files.update(model, Files.Message.RequestedViewed({ path: files[0]!.path, viewed: true }), {
      files,
    }).outMessage,
  ).toMatchObject({ _tag: "RequestedViewed", viewed: true });
  const html = Files.view({ model, files, toMessage: () => "files" }, h)!;
  expect(Scene.findAll(html, '[role="tree"]')).toHaveLength(1);
  expect(Scene.findAll(html, 'input[type="checkbox"]')).toHaveLength(3);
});
it("summarizes all check statuses and provides optional details and rerun intent", () => {
  const checks = [
    { id: "s", name: "Schema", status: "failed" as const },
    { id: "p", name: "Policy", status: "passed" as const },
  ];
  expect(checkSummary(checks)).toBe("1 failed, 1 passed");
  const html = CheckList.view(
    { checks, onRerun: () => "rerun", renderDetails: () => h.p([], ["Local validator"]) },
    h,
  )!;
  expect(Scene.findAll(html, "details")).toHaveLength(2);
  expect(Scene.findAll(html, "button")).toHaveLength(2);
});
it("uses host merge availability even when displayed requirements differ", () => {
  const html = MergeReadiness.view(
    {
      requirements: [
        {
          id: "r",
          label: "Approval",
          outcome: "met",
          reason: "Reviewed",
          children: [{ id: "c", label: "Owner", outcome: "met", reason: "Confirmed" }],
        },
      ],
      canMerge: false,
      onMerge: "merge",
      strategies: [{ id: "custom", label: "Apply configuration" }],
      strategy: "custom",
      onStrategyChange: () => "strategy",
    },
    h,
  )!;
  expect(Scene.findAll(html, "button[disabled]")).toHaveLength(1);
  expect(Scene.findAll(html, "select")).toHaveLength(1);
  expect(
    Scene.findAll(
      ChangeRequestHeader.view(
        {
          title: "Enable flag",
          status: "draft",
          author: { id: "a", name: "Author" },
          baseLabel: "saved",
          headLabel: "draft",
        },
        h,
      )!,
      "header",
    ),
  ).toHaveLength(1);
});
