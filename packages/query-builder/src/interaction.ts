import { DragAndDrop } from "@foldkit/ui";

import { moveRule, type QueryGroup, type RuleLocation } from "./query";

export const DEFAULT_ACTIVATION_THRESHOLD = 8;
export const RULE_ITEM_PREFIX = "query-rule:";
export const RULE_TARGET_PREFIX = "query-target:";

const decodeSegment = (value: string): string | undefined => {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.length > 0 ? decoded : undefined;
  } catch {
    return undefined;
  }
};

export const ruleItemId = (ruleId: string): string =>
  `${RULE_ITEM_PREFIX}${encodeURIComponent(ruleId)}`;

export const ruleIdFromItemId = (itemId: string): string | undefined =>
  itemId.startsWith(RULE_ITEM_PREFIX)
    ? decodeSegment(itemId.slice(RULE_ITEM_PREFIX.length))
    : undefined;

export const ruleTargetId = (location: RuleLocation): string =>
  `${RULE_TARGET_PREFIX}${encodeURIComponent(location.groupId)}:${String(location.index)}`;

export const ruleLocationFromTargetId = (targetId: string): RuleLocation | undefined => {
  if (!targetId.startsWith(RULE_TARGET_PREFIX)) return undefined;
  const encoded = targetId.slice(RULE_TARGET_PREFIX.length);
  const separator = encoded.lastIndexOf(":");
  if (separator <= 0) return undefined;
  const groupId = decodeSegment(encoded.slice(0, separator));
  const rawIndex = encoded.slice(separator + 1);
  if (groupId === undefined || !/^\d+$/.test(rawIndex)) return undefined;
  const index = Number(rawIndex);
  return Number.isSafeInteger(index) ? { groupId, index } : undefined;
};

export type ApplyRuleReorderConfig = Readonly<{
  query: QueryGroup;
  reordered: Extract<DragAndDrop.OutMessage, { readonly _tag: "Reordered" }>;
}>;

export const applyRuleReorder = (
  config: ApplyRuleReorderConfig,
): QueryGroup | undefined => {
  const ruleId = ruleIdFromItemId(config.reordered.itemId);
  const location = ruleLocationFromTargetId(config.reordered.toContainerId);
  return ruleId === undefined || location === undefined
    ? undefined
    : moveRule(config.query, ruleId, location);
};
