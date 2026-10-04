import { Schema as S } from "effect";
import { Outliner } from "@foldworks/outliner";

import { OUTLINE_ID, sampleOutline } from "./sample";

export const Model = S.Struct({
  outline: Outliner.Model,
  showCheckboxes: S.Boolean,
  platform: S.Literals(["mac", "other"]),
});
export type Model = typeof Model.Type;

const detectPlatform = (): Model["platform"] =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? "mac"
    : "other";

export const initialModel = (): Model => ({
  outline: Outliner.init({ id: OUTLINE_ID, items: sampleOutline }),
  showCheckboxes: false,
  platform: detectPlatform(),
});
