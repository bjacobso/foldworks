import { Schema as S } from "effect";

export type Model<Value> = Readonly<{
  past: ReadonlyArray<Value>;
  future: ReadonlyArray<Value>;
  coalescingKey: string | null;
}>;

export type RecordOptions = Readonly<{
  coalescingKey?: string;
  limit?: number;
}>;

export type Restore<Value> = Readonly<{
  history: Model<Value>;
  value: Value;
}>;

const DEFAULT_LIMIT = 100;

export const Schema = <Value>(Value: S.Schema<Value>) => S.Struct({
  past: S.Array(Value),
  future: S.Array(Value),
  coalescingKey: S.NullOr(S.String),
});

export const init = <Value>(): Model<Value> => ({
  past: [],
  future: [],
  coalescingKey: null,
});

export const canUndo = <Value>(model: Model<Value>): boolean => model.past.length > 0;
export const canRedo = <Value>(model: Model<Value>): boolean => model.future.length > 0;

export const record = <Value>(
  model: Model<Value>,
  previous: Value,
  options: RecordOptions = {},
): Model<Value> => {
  const coalescingKey = options.coalescingKey ?? null;
  if (coalescingKey !== null && coalescingKey === model.coalescingKey) {
    return { ...model, future: [], coalescingKey };
  }
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  return {
    past: [...model.past, previous].slice(-limit),
    future: [],
    coalescingKey,
  };
};

export const breakCoalescing = <Value>(model: Model<Value>): Model<Value> =>
  model.coalescingKey === null ? model : { ...model, coalescingKey: null };

export const undo = <Value>(model: Model<Value>, current: Value): Restore<Value> | undefined => {
  const value = model.past.at(-1);
  if (value === undefined) return undefined;
  return {
    value,
    history: {
      past: model.past.slice(0, -1),
      future: [current, ...model.future],
      coalescingKey: null,
    },
  };
};

export const redo = <Value>(model: Model<Value>, current: Value): Restore<Value> | undefined => {
  const [value, ...future] = model.future;
  if (value === undefined) return undefined;
  return {
    value,
    history: {
      past: [...model.past, current],
      future,
      coalescingKey: null,
    },
  };
};
