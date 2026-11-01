import { DragAndDrop } from "@foldkit/ui";

import { moveNode, type NodeLocation, type QueryGroup } from "./query";

export const DEFAULT_ACTIVATION_THRESHOLD = 8;
export const RULE_ITEM_PREFIX = "query-rule:";
export const GROUP_ITEM_PREFIX = "query-group:";
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

export const groupItemId = (groupId: string): string =>
  `${GROUP_ITEM_PREFIX}${encodeURIComponent(groupId)}`;

export const groupIdFromItemId = (itemId: string): string | undefined =>
  itemId.startsWith(GROUP_ITEM_PREFIX)
    ? decodeSegment(itemId.slice(GROUP_ITEM_PREFIX.length))
    : undefined;

/** Resolves a rule or group drag item back to its query node id. */
export const nodeIdFromItemId = (itemId: string): string | undefined =>
  ruleIdFromItemId(itemId) ?? groupIdFromItemId(itemId);

export const ruleTargetId = (location: NodeLocation): string =>
  `${RULE_TARGET_PREFIX}${encodeURIComponent(location.groupId)}:${String(location.index)}`;

export const ruleLocationFromTargetId = (targetId: string): NodeLocation | undefined => {
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

export type ApplyNodeReorderConfig = Readonly<{
  query: QueryGroup;
  reordered: Extract<DragAndDrop.OutMessage, { readonly _tag: "Reordered" }>;
}>;

/** @deprecated Use ApplyNodeReorderConfig. */
export type ApplyRuleReorderConfig = ApplyNodeReorderConfig;

/** Commits a completed rule or group drag, or returns `undefined` for invalid drops. */
export const applyNodeReorder = (config: ApplyNodeReorderConfig): QueryGroup | undefined => {
  const nodeId = nodeIdFromItemId(config.reordered.itemId);
  const location = ruleLocationFromTargetId(config.reordered.toContainerId);
  return nodeId === undefined || location === undefined
    ? undefined
    : moveNode(config.query, nodeId, location);
};

/** @deprecated Use applyNodeReorder, which also moves groups. */
export const applyRuleReorder = applyNodeReorder;
