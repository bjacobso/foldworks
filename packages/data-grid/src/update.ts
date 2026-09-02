import { Match as M, Option } from "effect";
import type { Update } from "foldkit";

import { Message } from "./message";
import { ResizeState, type Model, type Sorting } from "./model";

type UpdateReturn = Update.Return<Model, Message>;

const nextSorting = (
  sorting: Option.Option<Sorting>,
  columnId: string,
): Option.Option<Sorting> =>
  Option.match(sorting, {
    onNone: () => Option.some({ columnId, direction: "Ascending" as const }),
    onSome: (current) => {
      if (current.columnId !== columnId) {
        return Option.some({ columnId, direction: "Ascending" as const });
      }
      return current.direction === "Ascending"
        ? Option.some({ columnId, direction: "Descending" as const })
        : Option.none();
    },
  });

const writeColumnWidth = (model: Model, columnId: string, width: number): Model => ({
  ...model,
  columnSizes: model.columnSizes.some((size) => size.columnId === columnId)
    ? model.columnSizes.map((size) =>
        size.columnId === columnId ? { ...size, width } : size,
      )
    : [...model.columnSizes, { columnId, width }],
});

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    SelectedCell: ({ rowId, columnId }) => ({
      model: { ...model, selectedCell: Option.some({ rowId, columnId }) },
    }),
    ToggledSort: ({ columnId }) => ({
      model: { ...model, sorting: nextSorting(model.sorting, columnId) },
    }),
    StartedColumnResize: ({
      columnId,
      screenX,
      width,
      minimumWidth,
      maximumWidth,
    }) => ({
      model: {
        ...model,
        resizeState: ResizeState.Resizing({
          columnId,
          originX: screenX,
          originWidth: width,
          minimumWidth,
          maximumWidth,
        }),
      },
    }),
    MovedColumnResize: ({ screenX }) =>
      M.value(model.resizeState).pipe(
        M.withReturnType<UpdateReturn>(),
        M.tag("Resizing", (resize) => ({
          model: writeColumnWidth(
            model,
            resize.columnId,
            Math.min(
              resize.maximumWidth,
              Math.max(
                resize.minimumWidth,
                resize.originWidth + screenX - resize.originX,
              ),
            ),
          ),
        })),
        M.orElse(() => ({ model })),
      ),
    FinishedColumnResize: () => ({
      model: { ...model, resizeState: ResizeState.Idle() },
    }),
    ResetColumnSize: ({ columnId, width }) => ({
      model: writeColumnWidth(model, columnId, width),
    }),
  });
