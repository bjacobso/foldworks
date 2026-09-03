import { Brackets, GripVertical, ListFilter, Plus, Trash2 } from "@lucide/icons";
import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import { DragAndDrop } from "@foldkit/ui";

import { Button, Icon, sxAttrs } from "@foldworks/ui";

import { Message } from "./message";
import type { Model } from "./model";
import {
  ruleIdFromItemId,
  ruleItemId,
  ruleTargetId,
} from "./interaction";
import {
  defaultValueForAttribute,
  findNode,
  operatorsForAttribute,
  type AttributeDefinition,
  type Configuration,
  type QueryGroup,
  type QueryNode,
  type QueryRule,
} from "./query";
import { styles } from "./styles";
import { issuesForNode, validate, type ValidationResult } from "./validation";

export type ViewInputs = Configuration & Readonly<{
  label?: string;
  showValidation?: boolean;
}>;

const toInteractionMessage = (message: DragAndDrop.Message): Message =>
  Message.GotInteractionMessage({ message });

const ruleDropTarget = (
  model: Model,
  groupId: string,
  index: number,
  h: HtmlBuilder<Message>,
): Html => {
  const targetId = ruleTargetId({ groupId, index });
  const isDragging = DragAndDrop.isDragging(model.interaction);
  const isActive = Option.exists(
    DragAndDrop.maybeDropTarget(model.interaction),
    (target) => target.containerId === targetId,
  );
  return h.div([
    ...sxAttrs(
      h,
      styles.dropTarget,
      isDragging && styles.dropTargetAvailable,
      isActive && styles.dropTargetActive,
    ),
    ...DragAndDrop.droppable(targetId, `Move condition to position ${String(index + 1)}`),
    h.DataAttribute("query-drop-target", targetId),
    h.DataAttribute("query-drop-active", isActive ? "true" : "false"),
  ]);
};

const select = (
  value: string,
  label: string,
  options: ReadonlyArray<Readonly<{ value: string; label: string }>>,
  onChange: (value: string) => Message,
  h: HtmlBuilder<Message>,
  extraStyle?: Parameters<typeof sxAttrs<Message>>[1],
): Html => h.select(
  [
    ...sxAttrs(h, styles.select, extraStyle),
    h.Value(value),
    h.AriaLabel(label),
    h.OnChange(onChange),
  ],
  options.map((option) => h.option(
    [h.Value(option.value), h.Selected(option.value === value)],
    [option.label],
  )),
);

const combinatorControl = (
  group: QueryGroup,
  h: HtmlBuilder<Message>,
): Html => h.div([
  ...sxAttrs(h, styles.combinatorControl),
  h.Role("group"),
  h.AriaLabel("Condition matching"),
], (["All", "Any"] as const).map((combinator) => h.button([
  ...sxAttrs(
    h,
    styles.combinatorButton,
    group.combinator === combinator && styles.combinatorActive,
  ),
  h.Type("button"),
  h.AriaPressed(group.combinator === combinator ? "true" : "false"),
  h.OnClick(Message.ChangedCombinator({ groupId: group.id, combinator })),
], [combinator])));

const valueControl = (
  rule: QueryRule,
  attribute: AttributeDefinition,
  isInvalid: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const operator = operatorsForAttribute(attribute).find((candidate) => candidate.id === rule.operatorId);
  if (operator?.requiresValue === false) {
    return h.span(sxAttrs(h, styles.hiddenValue), ["No value needed"]);
  }
  if (attribute.kind === "Boolean") {
    return select(
      rule.value,
      `${attribute.label} value`,
      [{ value: "true", label: "True" }, { value: "false", label: "False" }],
      (value) => Message.ChangedValue({ ruleId: rule.id, value }),
      h,
    );
  }
  if (attribute.kind === "Select") {
    return select(
      rule.value,
      `${attribute.label} value`,
      attribute.options ?? [],
      (value) => Message.ChangedValue({ ruleId: rule.id, value }),
      h,
    );
  }
  return h.input([
    ...sxAttrs(h, styles.value, isInvalid && styles.invalidValue),
    h.Type(attribute.kind === "Number" ? "number" : attribute.kind === "Date" ? "date" : "text"),
    h.Value(rule.value),
    h.Placeholder(attribute.placeholder ?? "Enter a value"),
    h.AriaLabel(`${attribute.label} value`),
    h.AriaInvalid(isInvalid),
    h.OnInput((value) => Message.ChangedValue({ ruleId: rule.id, value })),
  ]);
};

const ruleView = (
  model: Model,
  rule: QueryRule,
  groupId: string,
  index: number,
  configuration: Configuration,
  validation: ValidationResult,
  h: HtmlBuilder<Message>,
): Html => {
  const attribute = configuration.attributes.find((candidate) => candidate.id === rule.attributeId) ??
    configuration.attributes[0];
  const issues = issuesForNode(validation, rule.id);
  if (attribute === undefined) {
    return h.div(sxAttrs(h, styles.rule, styles.ruleInvalid), [
      h.span([
        ...sxAttrs(h, styles.dragHandle),
        ...DragAndDrop.draggable({
          model: model.interaction,
          toParentMessage: toInteractionMessage,
          itemId: ruleItemId(rule.id),
          containerId: ruleTargetId({ groupId, index }),
          index: 0,
        }, h),
        h.AriaLabel("Move condition"),
      ], [Icon.view({ icon: GripVertical, size: 15 }, h)]),
      h.p(sxAttrs(h, styles.issue), [issues[0]?.message ?? "Configure an attribute to edit this rule."]),
      Button.view({
        icon: Trash2,
        ariaLabel: "Remove condition",
        variant: "ghost",
        size: "icon",
        style: [styles.removeButton, styles.ruleRemoveButton],
        onClick: Message.RemovedNode({ nodeId: rule.id }),
      }, h),
    ]);
  }
  const operators = operatorsForAttribute(attribute);
  return h.keyed("div")(
    rule.id,
    [
      ...sxAttrs(h, styles.rule, styles.responsiveRule, issues.length > 0 && styles.ruleInvalid),
      ...(ruleIdFromItemId(Option.getOrUndefined(DragAndDrop.maybeDraggedItemId(model.interaction)) ?? "") === rule.id
        ? sxAttrs(h, styles.draggingRule)
        : []),
      h.DataAttribute("query-rule", rule.id),
    ],
    [
      h.span([
        ...sxAttrs(h, styles.dragHandle),
        ...DragAndDrop.draggable({
          model: model.interaction,
          toParentMessage: toInteractionMessage,
          itemId: ruleItemId(rule.id),
          containerId: ruleTargetId({ groupId, index }),
          index: 0,
        }, h),
        h.AriaLabel(`Move ${attribute.label} condition`),
      ], [Icon.view({ icon: GripVertical, size: 15 }, h)]),
      select(
        attribute.id,
        "Attribute",
        configuration.attributes.map((candidate) => ({ value: candidate.id, label: candidate.label })),
        (attributeId) => {
          const next = configuration.attributes.find((candidate) => candidate.id === attributeId) ?? attribute;
          return Message.ChangedAttribute({
            ruleId: rule.id,
            attributeId: next.id,
            operatorId: operatorsForAttribute(next)[0]?.id ?? "equals",
            value: defaultValueForAttribute(next),
          });
        },
        h,
      ),
      select(
        rule.operatorId,
        "Operator",
        operators.map((operator) => ({ value: operator.id, label: operator.label })),
        (operatorId) => Message.ChangedOperator({ ruleId: rule.id, operatorId }),
        h,
      ),
      valueControl(rule, attribute, issues.length > 0, h),
      Button.view({
        icon: Trash2,
        ariaLabel: `Remove ${attribute.label} condition`,
        variant: "ghost",
        size: "icon",
        style: [styles.removeButton, styles.ruleRemoveButton],
        onClick: Message.RemovedNode({ nodeId: rule.id }),
      }, h),
      ...(issues[0] === undefined
        ? []
        : [h.p(sxAttrs(h, styles.issue), [issues[0].message])]),
    ],
  );
};

const groupView = (
  model: Model,
  group: QueryGroup,
  configuration: Configuration,
  validation: ValidationResult,
  depth: number,
  isRoot: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const firstAttribute = configuration.attributes[0];
  const groupIssues = issuesForNode(validation, group.id);
  return h.keyed("section")(
    group.id,
    [
      ...sxAttrs(h, styles.group, !isRoot && styles.nestedGroup),
      h.AriaLabel(isRoot ? "Query" : "Condition group"),
      h.DataAttribute("query-group", group.id),
    ],
    [
      h.div(sxAttrs(h, styles.groupHeader), [
        h.div(sxAttrs(h, styles.groupLead), [
          h.span(sxAttrs(h, styles.groupIcon), [
            Icon.view({ icon: isRoot ? ListFilter : Brackets, size: 15, strokeWidth: 2.1 }, h),
          ]),
          h.span(sxAttrs(h, styles.groupLabel), [isRoot ? "Match" : "Nested group"]),
          combinatorControl(group, h),
          h.span(sxAttrs(h, styles.groupLabel), ["of the following"]),
        ]),
        h.div(sxAttrs(h, styles.groupActions), [
          ...(firstAttribute === undefined
            ? []
            : [Button.view({
                icon: Plus,
                label: "Condition",
                variant: "outline",
                size: "sm",
                onClick: Message.AddedRule({
                  groupId: group.id,
                  attributeId: firstAttribute.id,
                  operatorId: operatorsForAttribute(firstAttribute)[0]?.id ?? "equals",
                  value: defaultValueForAttribute(firstAttribute),
                }),
              }, h)]),
          ...(depth >= (configuration.maxDepth ?? 4)
            ? []
            : [Button.view({
                icon: Plus,
                label: "Group",
                variant: "ghost",
                size: "sm",
                onClick: Message.AddedGroup({ groupId: group.id }),
              }, h)]),
          ...(isRoot
            ? []
            : [Button.view({
                icon: Trash2,
                ariaLabel: "Remove group",
                variant: "ghost",
                size: "icon",
                style: styles.removeButton,
                onClick: Message.RemovedNode({ nodeId: group.id }),
              }, h)]),
        ]),
      ]),
      ...(isRoot ? [] : [h.span([h.AriaHidden(true), ...sxAttrs(h, styles.nestedRail)])]),
      h.div(sxAttrs(h, styles.children), [
        ...group.children.flatMap((child, index) => [
          ruleDropTarget(model, group.id, index, h),
          child._tag === "Rule"
            ? ruleView(model, child, group.id, index, configuration, validation, h)
            : groupView(model, child, configuration, validation, depth + 1, false, h),
        ]),
        ruleDropTarget(model, group.id, group.children.length, h),
        ...(group.children.length === 0
          ? [h.div(sxAttrs(h, styles.empty), [
              firstAttribute === undefined
                ? "Configure at least one attribute."
                : "Add a condition or nested group.",
            ])]
          : []),
      ]),
      ...(groupIssues[0] === undefined || group.children.length === 0
        ? []
        : [h.p(sxAttrs(h, styles.issue), [groupIssues[0].message])]),
    ],
  );
};

const ghostView = (
  model: Model,
  configuration: Configuration,
  h: HtmlBuilder<Message>,
): Html => Option.match(DragAndDrop.ghostStyle(model.interaction), {
  onNone: () => h.empty,
  onSome: (ghostStyle) => {
    const itemId = Option.getOrUndefined(DragAndDrop.maybeDraggedItemId(model.interaction));
    const ruleId = itemId === undefined ? undefined : ruleIdFromItemId(itemId);
    const rule = ruleId === undefined ? undefined : findNode(model.query, ruleId);
    if (rule?._tag !== "Rule") return h.empty;
    const attribute = configuration.attributes.find((candidate) => candidate.id === rule.attributeId);
    const operator = attribute === undefined
      ? undefined
      : operatorsForAttribute(attribute).find((candidate) => candidate.id === rule.operatorId);
    return h.div(
      [
        h.Style(ghostStyle),
        ...sxAttrs(h, styles.ghostPosition),
        h.AriaHidden(true),
        h.DataAttribute("query-drag-ghost", "true"),
      ],
      [h.div(sxAttrs(h, styles.ghost), [
        Icon.view({ icon: GripVertical, size: 15 }, h),
        h.span(sxAttrs(h, styles.ghostAttribute), [attribute?.label ?? rule.attributeId]),
        h.span(sxAttrs(h, styles.ghostOperator), [operator?.label ?? rule.operatorId]),
        ...(operator?.requiresValue === false
          ? []
          : [h.span(sxAttrs(h, styles.ghostValue), [rule.value || "No value"])]),
      ])],
    );
  },
});

export const view = defineView<Model, Message, ViewInputs>((model, inputs, h) => {
  const validation = validate(model.query, inputs);
  return h.div(
    [
      ...sxAttrs(h, styles.editor),
      h.AriaLabel(inputs.label ?? "Query builder"),
      h.DataAttribute("query-builder", model.id),
    ],
    [
      groupView(model, model.query, inputs, validation, 0, true, h),
      ...(inputs.showValidation === false
        ? []
        : [h.div(sxAttrs(
            h,
            styles.summary,
            validation.isValid ? styles.summaryValid : styles.summaryInvalid,
          ), [
            h.span(sxAttrs(h, validation.isValid ? styles.validDot : styles.invalidDot)),
            validation.isValid
              ? "Query is valid"
              : `${validation.issues.length} ${validation.issues.length === 1 ? "issue" : "issues"} to resolve`,
          ])]),
      ghostView(model, inputs, h),
    ],
  );
});

const displayValue = (rule: QueryRule, attribute: AttributeDefinition): string => {
  if (attribute.kind === "Boolean") return rule.value === "true" ? "true" : "false";
  if (attribute.kind === "Select") {
    return attribute.options?.find((option) => option.value === rule.value)?.label ?? rule.value;
  }
  return rule.value;
};

const readonlyNode = <Message>(
  node: QueryNode,
  configuration: Configuration,
  nested: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  if (node._tag === "Rule") {
    const attribute = configuration.attributes.find((candidate) => candidate.id === node.attributeId);
    const operator = attribute === undefined
      ? undefined
      : operatorsForAttribute(attribute).find((candidate) => candidate.id === node.operatorId);
    return h.span(sxAttrs(h, styles.readonlyRule), [
      h.span(sxAttrs(h, styles.readonlyAttribute), [attribute?.label ?? node.attributeId]),
      h.span(sxAttrs(h, styles.readonlyOperator), [operator?.label ?? node.operatorId]),
      ...(operator?.requiresValue === false
        ? []
        : [h.span(sxAttrs(h, styles.readonlyValue), [
            attribute === undefined ? node.value : displayValue(node, attribute),
          ])]),
    ]);
  }
  const conjunction = node.combinator === "All" ? "and" : "or";
  const children = node.children.flatMap((child, index) => [
    ...(index === 0
      ? []
      : [h.span(sxAttrs(h, styles.readonlyCombinator), [conjunction])]),
    readonlyNode(child, configuration, true, h),
  ]);
  return h.span(sxAttrs(h, styles.readonlyGroup, nested && styles.readonlyNested), children);
};

export const readOnlyView = <Message>(
  config: Readonly<{
    query: QueryGroup;
    attributes: ReadonlyArray<AttributeDefinition>;
    label?: string;
  }>,
  h: HtmlBuilder<Message>,
): Html => h.keyed("div")(
  JSON.stringify(config.query),
  [
    ...sxAttrs(h, styles.readonly),
    h.AriaLabel(config.label ?? "Query summary"),
    h.DataAttribute("query-readonly", "true"),
  ],
  config.query.children.length === 0
    ? [h.span(sxAttrs(h, styles.readonlyOperator), ["No conditions"])]
    : [readonlyNode(config.query, { attributes: config.attributes }, false, h)],
);
