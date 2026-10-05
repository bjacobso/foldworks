import { Schema as S } from "effect";
import type { TextEdit } from "./document";
import { validOffset } from "./document";

/**
 * A short label shown after the line where a range ends, such as an evaluation
 * result. The editor maps annotations through later edits and marks them stale
 * when an edit touches their range, so a result never silently describes code
 * that has since changed.
 */
export const Annotation = S.Struct({
  from: S.Number,
  to: S.Number,
  label: S.String,
  tone: S.Literals(["value", "error", "muted"]),
  stale: S.Boolean,
});
export type Annotation = typeof Annotation.Type;
export const SourcedAnnotation = S.Struct({ source: S.String, ...Annotation.fields });
export type SourcedAnnotation = typeof SourcedAnnotation.Type;
export const AnnotationBatch = S.Struct({
  uri: S.String,
  session: S.Number,
  revision: S.Number,
  source: S.String,
  annotations: S.Array(Annotation),
});
export type AnnotationBatch = typeof AnnotationBatch.Type;

export const validAnnotations = (text: string, annotations: readonly Annotation[]): boolean =>
  annotations.every(
    (item) => validOffset(text, item.from) && validOffset(text, item.to) && item.from <= item.to,
  );

const map = (offset: number, edits: readonly TextEdit[], after: boolean): number => {
  let shift = 0;
  for (const edit of edits) {
    if (offset < edit.from || (offset === edit.from && !after)) break;
    if (offset < edit.to || (offset === edit.to && edit.from === edit.to))
      return edit.from + shift + (after ? edit.insert.length : 0);
    shift += edit.insert.length - (edit.to - edit.from);
  }
  return offset + shift;
};

/** Insertions at either boundary stay outside the range; anything inside or replacing it marks it stale. */
export const mapAnnotations = <A extends Annotation>(
  annotations: readonly A[],
  edits: readonly TextEdit[],
): readonly A[] =>
  edits.length === 0
    ? annotations
    : annotations.map((item) => {
        const touched = edits.some((edit) =>
          edit.from === edit.to
            ? edit.from > item.from && edit.from < item.to
            : edit.from < item.to && edit.to > item.from,
        );
        const from = map(item.from, edits, true);
        const to = Math.max(from, map(item.to, edits, false));
        return { ...item, from, to, stale: item.stale || touched };
      });
