import type { Update } from "foldkit";

import { Message } from "./message";
import type { Model } from "./model";

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    ChangedQuery: ({ query }) => ({ model: { ...model, query } }),
    ChangedSelection: ({ rowIds }) => ({
      model: {
        ...model,
        selectedRowIds: [...new Set(rowIds)],
        announcement: `${new Set(rowIds).size} people selected.`,
      },
    }),
    ChangedSorting: ({ sorting }) => ({ model: {
      ...model,
      sorting,
      announcement: sorting._tag === "Some"
        ? `Sorted by ${sorting.value.columnId} ${sorting.value.direction.toLowerCase()}.`
        : "Table sorting cleared.",
    } }),
    ChangedDensity: ({ density }) => ({ model: { ...model, density } }),
    ClearedSelection: () => ({
      model: { ...model, selectedRowIds: [], announcement: "Selection cleared." },
    }),
    ClickedExport: () => ({
      model: { ...model, announcement: "Export prepared for the current people view." },
    }),
    ClickedCreate: () => ({
      model: { ...model, announcement: "New person action requested." },
    }),
    ClickedRowActions: ({ rowId }) => ({
      model: { ...model, announcement: `Actions opened for ${rowId}.` },
    }),
  });
