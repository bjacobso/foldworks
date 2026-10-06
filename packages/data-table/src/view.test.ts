import { inertHtml as h } from "foldkit/html";
import { Scene } from "foldkit/test";
import { expect, it } from "vitest";

import { defineColumns } from "./core";
import { view } from "./view";

it("replaces records with decorative shared skeletons while the table is busy", () => {
  const html = view(
    {
      id: "people",
      label: "People",
      columns: defineColumns<{ id: string; name: string }>()([
        { id: "name", header: "Name", accessor: (row) => row.name },
      ]),
      rows: [{ id: "one", name: "Ada" }],
      getRowId: (row) => row.id,
      onSelectedRowsChange: () => "selected" as never,
      isLoading: true,
      loadingRowCount: 2,
    },
    h,
  );
  if (html === null) throw new Error("Expected a table");

  expect(Scene.findAll(html, 'table[aria-busy="true"]')).toHaveLength(1);
  expect(Scene.findAll(html, 'tbody tr[aria-hidden="true"]')).toHaveLength(2);
  expect(Scene.findAll(html, '[role="status"]')).toHaveLength(0);
  expect(Scene.findAll(html, '.skeleton[aria-hidden="true"]')).toHaveLength(4);
  expect(Scene.findAll(html, ".skeletonText")[0]?.data?.style).toMatchObject({
    width: "min(75%, 140px)",
    height: "10px",
  });
  expect(Scene.textContent(html)).not.toContain("Ada");
});
