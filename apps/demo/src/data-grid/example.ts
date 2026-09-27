import { Schema as S } from "effect";

export const DataGridExample = S.Literals(["Worksheet", "Coverage"]);
export type DataGridExample = typeof DataGridExample.Type;
