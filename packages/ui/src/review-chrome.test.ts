import { expect, it, vi } from "vitest";
import { inertHtml, type HtmlBuilder } from "foldkit/html";
import { Scene } from "foldkit/test";
import { TransactionTimeline } from "./operational";
import * as Tree from "./tree";
const h = inertHtml as unknown as HtmlBuilder<string>;
it("keeps transaction entries compatible and renders each host activity body once", () => {
  const renderBody = vi.fn(() => h.p([], ["Review submitted"]));
  const entry = {
    id: "e",
    title: "Review",
    actor: "Reviewer",
    timestamp: "today",
    context: "local",
    changes: [],
    kind: "review",
  };
  const html = TransactionTimeline.view({ label: "Activity", entries: [entry], renderBody }, h)!;
  expect(Scene.findAll(html, '[data-entry-kind="review"]')).toHaveLength(1);
  expect(renderBody).toHaveBeenCalledTimes(1);
});
it("renders a checkable tree with viewed state and hidden editing actions", () => {
  const html = Tree.view(
    {
      model: Tree.init({ id: "files" }),
      nodes: [
        {
          id: "f",
          label: "file.json",
          branch: false,
          parentId: null,
          renamable: false,
          movable: false,
        },
      ],
      label: "Files",
      toParentMessage: () => "tree",
      checkedIds: ["f"],
      onCheckedChange: () => "viewed",
      showActions: false,
    },
    h,
  )!;
  expect(Scene.findAll(html, '[aria-checked="true"]')).toHaveLength(1);
  expect(Scene.findAll(html, '[role="group"]')).toHaveLength(0);
});
