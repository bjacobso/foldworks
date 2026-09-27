import { Schema as S } from "effect";

/** A rectangle in PDF points. The coordinate space is set by the API using it. */
export const PdfRect = S.Struct({
  x: S.Number,
  y: S.Number,
  width: S.Number,
  height: S.Number,
});
export type PdfRect = typeof PdfRect.Type;
