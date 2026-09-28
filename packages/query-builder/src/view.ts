import { ChevronDown, GripVertical, Plus, Trash2 } from "@lucide/icons";
import * as stylex from "@stylexjs/stylex";
import { Effect, Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { Mount } from "foldkit";
import { defineView } from "foldkit/submodel";
import { DragAndDrop } from "@foldkit/ui";
import { portalToContainingRoot } from "@foldkit/ui/anchor";

import { Button, Icon, sxAttrs } from "@foldworks/ui";

import { Message } from "./message";
import type { Model } from "./model";
import { groupItemId, nodeIdFromItemId, ruleItemId, ruleTargetId } from "./interaction";
import {
  defaultValueForAttribute,
  findNode,
  groupHeight,
  operatorsForAttribute,
  type AttributeDefinition,
  type Combinator,
  type Configuration,
  type QueryGroup,
  type QueryNode,
  type QueryRule,
} from "./query";
import { styles } from "./styles";
import {
  DEFAULT_SUMMARY_PREFIX,
  combinatorDescription,
  combinatorLabel,
  displayValue,
  summarizeQuery,
} from "./summary";
import { issuesForNode, validate, type ValidationResult } from "./validation";

export type ViewInputs = Configuration &
  Readonly<{
    label?: string;
    showValidation?: boolean;
    /** Renders the plain-language description below the editor. Defaults to true. */
    showSummary?: boolean;
    /** Leads the plain-language description, for example "This policy applies when". */
    summaryPrefix?: string;
  }>;

const toInteractionMessage = (message: DragAndDrop.Message): Message =>
  Message.GotInteractionMessage({ message });

const draggedNode = (model: Model): QueryNode | undefined => {
  const itemId = Option.getOrUndefined(DragAndDrop.maybeDraggedItemId(model.interaction));
  const nodeId = itemId === undefined ? undefined : nodeIdFromItemId(itemId);
  return nodeId === undefined ? undefined : findNode(model.query, nodeId);
};

const ruleDropTarget = (
  model: Model,
  groupId: string,
  index: number,
  isAllowed: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const targetId = ruleTargetId({ groupId, index });
  if (!isAllowed) {
    return h.div([
      ...sxAttrs(h, styles.dropTarget),
      h.DataAttribute("query-drop-disabled", targetId),
    ]);
  }
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
): Html =>
  h.select(
    [
      ...sxAttrs(h, styles.select, extraStyle),
      h.Value(value),
      h.AriaLabel(label),
      h.OnChange(onChange),
    ],
    options.map((option) =>
      h.option([h.Value(option.value), h.Selected(option.value === value)], [option.label]),
    ),
  );

const combinatorControl = (group: QueryGroup, h: HtmlBuilder<Message>): Html =>
  h.span(sxAttrs(h, styles.combinatorControl), [
    h.select(
      [
        ...sxAttrs(h, styles.combinatorSelect),
        h.Value(group.combinator),
        h.AriaLabel("Condition matching"),
        h.OnChange((combinator) =>
          Message.ChangedCombinator({
            groupId: group.id,
            combinator: combinator === "Any" ? "Any" : "All",
          }),
        ),
      ],
      (["All", "Any"] as const satisfies ReadonlyArray<Combinator>).map((combinator) =>
        h.option(
          [h.Value(combinator), h.Selected(group.combinator === combinator)],
          [combinatorLabel(combinator)],
        ),
      ),
    ),
    h.span(
      [h.AriaHidden(true), ...sxAttrs(h, styles.combinatorChevron)],
      [Icon.view({ icon: ChevronDown, size: 12, strokeWidth: 2.2 }, h)],
    ),
  ]);

const valueControl = (
  rule: QueryRule,
  attribute: AttributeDefinition,
  isInvalid: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const operator = operatorsForAttribute(attribute).find(
    (candidate) => candidate.id === rule.operatorId,
  );
  if (operator?.requiresValue === false) {
    return h.span(sxAttrs(h, styles.hiddenValue), ["No value needed"]);
  }
  if (attribute.kind === "Boolean") {
    return select(
      rule.value,
      `${attribute.label} value`,
      [
        { value: "true", label: "True" },
        { value: "false", label: "False" },
      ],
      (value) => Message.ChangedValue({ ruleId: rule.id, value }),
      h,
      styles.valueSlot,
    );
  }
  if (attribute.kind === "Select") {
    return select(
      rule.value,
      `${attribute.label} value`,
      attribute.options ?? [],
      (value) => Message.ChangedValue({ ruleId: rule.id, value }),
      h,
      styles.valueSlot,
    );
  }
  return h.input([
    ...sxAttrs(h, styles.value, styles.valueSlot, isInvalid && styles.invalidValue),
    h.Type(attribute.kind === "Number" ? "number" : attribute.kind === "Date" ? "date" : "text"),
    h.Value(rule.value),
    h.Placeholder(attribute.placeholder ?? "Enter a value"),
    h.AriaLabel(`${attribute.label} value`),
    h.AriaInvalid(isInvalid),
    h.OnInput((value) => Message.ChangedValue({ ruleId: rule.id, value })),
  ]);
};

const dragHandle = (
  model: Model,
  node: QueryNode,
  groupId: string,
  index: number,
  label: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.span(
    [
      ...sxAttrs(h, styles.dragHandle, node._tag === "Group" && styles.groupDragHandle),
      ...DragAndDrop.draggable(
        {
          model: model.interaction,
          toParentMessage: toInteractionMessage,
          itemId: node._tag === "Rule" ? ruleItemId(node.id) : groupItemId(node.id),
          containerId: ruleTargetId({ groupId, index }),
          index: 0,
        },
        h,
      ),
      h.AriaLabel(label),
    ],
    [Icon.view({ icon: GripVertical, size: 14 }, h)],
  );

const ruleView = (
  model: Model,
  rule: QueryRule,
  groupId: string,
  index: number,
  configuration: Configuration,
  validation: ValidationResult,
  h: HtmlBuilder<Message>,
): Html => {
  const attribute =
    configuration.attributes.find((candidate) => candidate.id === rule.attributeId) ??
    configuration.attributes[0];
  const issues = issuesForNode(validation, rule.id);
  if (attribute === undefined) {
    return h.div(sxAttrs(h, styles.rule, stylex.defaultMarker()), [
      dragHandle(model, rule, groupId, index, "Move condition", h),
      h.p(sxAttrs(h, styles.issue), [
        issues[0]?.message ?? "Configure an attribute to edit this rule.",
      ]),
      Button.view(
        {
          icon: Trash2,
          ariaLabel: "Remove condition",
          variant: "ghost",
          size: "icon",
          sx: [styles.removeButton, styles.ruleRemoveButton],
          onClick: Message.RemovedNode({ nodeId: rule.id }),
        },
        h,
      ),
    ]);
  }
  const operators = operatorsForAttribute(attribute);
  return h.keyed("div")(
    rule.id,
    [
      ...sxAttrs(
        h,
        styles.rule,
        stylex.defaultMarker(),
        draggedNode(model)?.id === rule.id && styles.draggingRule,
      ),
      h.DataAttribute("query-rule", rule.id),
    ],
    [
      dragHandle(model, rule, groupId, index, `Move ${attribute.label} condition`, h),
      select(
        attribute.id,
        "Attribute",
        configuration.attributes.map((candidate) => ({
          value: candidate.id,
          label: candidate.label,
        })),
        (attributeId) => {
          const next =
            configuration.attributes.find((candidate) => candidate.id === attributeId) ?? attribute;
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
      Button.view(
        {
          icon: Trash2,
          ariaLabel: `Remove ${attribute.label} condition`,
          variant: "ghost",
          size: "icon",
          sx: [styles.removeButton, styles.ruleRemoveButton],
          onClick: Message.RemovedNode({ nodeId: rule.id }),
        },
        h,
      ),
      ...(issues[0] === undefined ? [] : [h.p(sxAttrs(h, styles.issue), [issues[0].message])]),
    ],
  );
};

type GroupPlacement = Readonly<{
  parentId: string;
  index: number;
}>;

const groupView = (
  model: Model,
  group: QueryGroup,
  configuration: Configuration,
  validation: ValidationResult,
  depth: number,
  placement: GroupPlacement | undefined,
  isInsideDragged: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const firstAttribute = configuration.attributes[0];
  const groupIssues = issuesForNode(validation, group.id);
  const maxDepth = configuration.maxDepth ?? 4;
  const dragged = draggedNode(model);
  const isDragged = dragged?.id === group.id;
  const containsDragged = isInsideDragged || isDragged;
  // A dragged group cannot land inside itself or push its descendants past maxDepth.
  const acceptsDrop =
    dragged === undefined || (!containsDragged && depth + groupHeight(dragged) <= maxDepth);
  const label = `${combinatorLabel(group.combinator)} group`;
  return h.keyed("section")(
    group.id,
    [
      ...sxAttrs(
        h,
        styles.group,
        placement !== undefined && styles.nestedGroup,
        isDragged && styles.draggingRule,
      ),
      h.AriaLabel(placement === undefined ? "Query" : "Condition group"),
      h.DataAttribute("query-group", group.id),
    ],
    [
      h.div(sxAttrs(h, styles.groupHeader), [
        ...(placement === undefined
          ? []
          : [dragHandle(model, group, placement.parentId, placement.index, `Move ${label}`, h)]),
        combinatorControl(group, h),
        h.span(sxAttrs(h, styles.groupDescription), [combinatorDescription(group.combinator)]),
        ...(placement === undefined
          ? []
          : [
              Button.view(
                {
                  icon: Trash2,
                  ariaLabel: `Remove ${label}`,
                  variant: "ghost",
                  size: "icon",
                  sx: [styles.removeButton, styles.groupRemoveButton],
                  onClick: Message.RemovedNode({ nodeId: group.id }),
                },
                h,
              ),
            ]),
      ]),
      h.div(sxAttrs(h, styles.children), [
        ...group.children.flatMap((child, index) => [
          ruleDropTarget(model, group.id, index, acceptsDrop, h),
          child._tag === "Rule"
            ? ruleView(model, child, group.id, index, configuration, validation, h)
            : groupView(
                model,
                child,
                configuration,
                validation,
                depth + 1,
                { parentId: group.id, index },
                containsDragged,
                h,
              ),
        ]),
        ruleDropTarget(model, group.id, group.children.length, acceptsDrop, h),
        ...(group.children.length === 0
          ? [
              h.div(sxAttrs(h, styles.empty), [
                firstAttribute === undefined
                  ? "Configure at least one attribute."
                  : "No conditions yet.",
              ]),
            ]
          : []),
      ]),
      ...(groupIssues[0] === undefined || group.children.length === 0
        ? []
        : [h.p(sxAttrs(h, styles.issue), [groupIssues[0].message])]),
      h.div(sxAttrs(h, styles.groupActions), [
        ...(firstAttribute === undefined
          ? []
          : [
              Button.view(
                {
                  icon: Plus,
                  label: "Add condition",
                  variant: "ghost",
                  size: "sm",
                  sx: styles.addButton,
                  onClick: Message.AddedRule({
                    groupId: group.id,
                    attributeId: firstAttribute.id,
                    operatorId: operatorsForAttribute(firstAttribute)[0]?.id ?? "equals",
                    value: defaultValueForAttribute(firstAttribute),
                  }),
                },
                h,
              ),
            ]),
        ...(depth >= maxDepth
          ? []
          : [
              Button.view(
                {
                  icon: Plus,
                  label: "Add group",
                  variant: "ghost",
                  size: "sm",
                  sx: styles.addButton,
                  onClick: Message.AddedGroup({ groupId: group.id }),
                },
                h,
              ),
            ]),
      ]),
    ],
  );
};

const countRules = (group: QueryGroup): number =>
  group.children.reduce(
    (count, child) => count + (child._tag === "Rule" ? 1 : countRules(child)),
    0,
  );

const ghostContent = (
  node: QueryNode,
  configuration: Configuration,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  if (node._tag === "Group") {
    const rules = countRules(node);
    return [
      h.span(sxAttrs(h, styles.ghostCombinator), [combinatorLabel(node.combinator)]),
      h.span(sxAttrs(h, styles.ghostOperator), [combinatorDescription(node.combinator)]),
      h.span(sxAttrs(h, styles.ghostValue), [
        `${rules} ${rules === 1 ? "condition" : "conditions"}`,
      ]),
    ];
  }
  const attribute = configuration.attributes.find((candidate) => candidate.id === node.attributeId);
  const operator =
    attribute === undefined
      ? undefined
      : operatorsForAttribute(attribute).find((candidate) => candidate.id === node.operatorId);
  return [
    h.span(sxAttrs(h, styles.ghostAttribute), [attribute?.label ?? node.attributeId]),
    h.span(sxAttrs(h, styles.ghostOperator), [operator?.label ?? node.operatorId]),
    ...(operator?.requiresValue === false
      ? []
      : [h.span(sxAttrs(h, styles.ghostValue), [node.value || "No value"])]),
  ];
};

// Fixed coordinates from DragAndDrop are viewport-relative. A transformed
// editor ancestor changes the containing block for fixed descendants, so
// render the preview in the containing document's overlay root.
const PortalGhost = Mount.define("QueryBuilderGhostPortal", {
  messages: [Message.CompletedGhostPortal],
  execute: ({ element }) =>
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => portalToContainingRoot(element)),
        (cleanup) => Effect.sync(cleanup),
      );
      return Message.CompletedGhostPortal();
    }),
});

const ghostView = (model: Model, configuration: Configuration, h: HtmlBuilder<Message>): Html =>
  Option.match(DragAndDrop.ghostStyle(model.interaction), {
    onNone: () => h.empty,
    onSome: (ghostStyle) => {
      const node = draggedNode(model);
      if (node === undefined) return h.empty;
      return h.div(
        [
          h.Style(ghostStyle),
          ...sxAttrs(h, styles.ghostPosition),
          h.OnMount(PortalGhost()),
          h.AriaHidden(true),
          h.DataAttribute("query-drag-ghost", "true"),
        ],
        [
          h.div(sxAttrs(h, styles.ghost), [
            Icon.view({ icon: GripVertical, size: 15 }, h),
            ...ghostContent(node, configuration, h),
          ]),
        ],
      );
    },
  });

const sentence = <Message>(
  query: QueryGroup,
  attributes: ReadonlyArray<AttributeDefinition>,
  prefix: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.p(
    [...sxAttrs(h, styles.sentence), h.DataAttribute("query-summary", "true")],
    [
      `${prefix} `,
      ...summarizeQuery(query, attributes).map((segment) => {
        switch (segment.kind) {
          case "Attribute":
            return h.strong(sxAttrs(h, styles.sentenceAttribute), [segment.text]);
          case "Value":
            return h.span(sxAttrs(h, styles.sentenceValue), [segment.text]);
          case "Text":
            return segment.text;
        }
      }),
      ".",
    ],
  );

export const view = defineView<Model, Message, ViewInputs>((model, inputs, h) => {
  const validation = validate(model.query, inputs);
  const showSummary = inputs.showSummary !== false && model.query.children.length > 0;
  const showIssues = inputs.showValidation !== false && !validation.isValid;
  return h.div(
    [
      ...sxAttrs(h, styles.editor),
      h.AriaLabel(inputs.label ?? "Query builder"),
      h.DataAttribute("query-builder", model.id),
    ],
    [
      h.div(sxAttrs(h, styles.editorBody), [
        groupView(model, model.query, inputs, validation, 0, undefined, false, h),
      ]),
      ...(showSummary || showIssues
        ? [
            h.div(sxAttrs(h, styles.footer), [
              ...(showSummary
                ? [
                    sentence(
                      model.query,
                      inputs.attributes,
                      inputs.summaryPrefix ?? DEFAULT_SUMMARY_PREFIX,
                      h,
                    ),
                  ]
                : []),
              ...(showIssues
                ? [
                    h.span(
                      [...sxAttrs(h, styles.issueCount), h.AriaLive("polite")],
                      [
                        h.span([h.AriaHidden(true), ...sxAttrs(h, styles.invalidDot)]),
                        `${validation.issues.length} ${validation.issues.length === 1 ? "issue" : "issues"} to resolve`,
                      ],
                    ),
                  ]
                : []),
            ]),
          ]
        : []),
      ghostView(model, inputs, h),
    ],
  );
});

const readonlyRule = <Message>(
  rule: QueryRule,
  configuration: Configuration,
  h: HtmlBuilder<Message>,
): Html => {
  const attribute = configuration.attributes.find((candidate) => candidate.id === rule.attributeId);
  const operator =
    attribute === undefined
      ? undefined
      : operatorsForAttribute(attribute).find((candidate) => candidate.id === rule.operatorId);
  return h.div(sxAttrs(h, styles.readonlyRule), [
    h.span(sxAttrs(h, styles.readonlyAttribute), [attribute?.label ?? rule.attributeId]),
    h.span(sxAttrs(h, styles.readonlyOperator), [operator?.label ?? rule.operatorId]),
    ...(operator?.requiresValue === false
      ? []
      : [
          h.code(sxAttrs(h, styles.readonlyValue), [
            attribute === undefined ? rule.value : displayValue(rule, attribute),
          ]),
        ]),
  ]);
};

const readonlyGroup = <Message>(
  group: QueryGroup,
  configuration: Configuration,
  isNested: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(sxAttrs(h, styles.readonlyGroup, isNested && styles.readonlyNested), [
    h.div(sxAttrs(h, styles.readonlyHeader), [
      h.span(sxAttrs(h, styles.readonlyCombinator), [combinatorLabel(group.combinator)]),
      h.span(sxAttrs(h, styles.groupDescription), [combinatorDescription(group.combinator)]),
    ]),
    ...group.children.map((child: QueryNode) =>
      child._tag === "Rule"
        ? readonlyRule(child, configuration, h)
        : readonlyGroup(child, configuration, true, h),
    ),
  ]);

export const readOnlyView = <Message>(
  config: Readonly<{
    query: QueryGroup;
    attributes: ReadonlyArray<AttributeDefinition>;
    label?: string;
    /** Leads the plain-language description, for example "This policy applies when". */
    summaryPrefix?: string;
    /** Whether the structured logic starts expanded. Defaults to true. */
    isLogicOpen?: boolean;
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed("div")(
    JSON.stringify(config.query),
    [
      ...sxAttrs(h, styles.readonly),
      h.AriaLabel(config.label ?? "Query summary"),
      h.DataAttribute("query-readonly", "true"),
    ],
    config.query.children.length === 0
      ? [h.p(sxAttrs(h, styles.sentence), ["No conditions"])]
      : [
          sentence(
            config.query,
            config.attributes,
            config.summaryPrefix ?? DEFAULT_SUMMARY_PREFIX,
            h,
          ),
          h.details(
            [
              ...sxAttrs(h, styles.logic, stylex.defaultMarker()),
              h.Open(config.isLogicOpen !== false),
            ],
            [
              h.summary(sxAttrs(h, styles.logicToggle), [
                h.span(
                  [h.AriaHidden(true), ...sxAttrs(h, styles.logicChevron)],
                  [Icon.view({ icon: ChevronDown, size: 14 }, h)],
                ),
                h.span(sxAttrs(h, styles.logicShowLabel), ["Show logic"]),
                h.span(sxAttrs(h, styles.logicHideLabel), ["Hide logic"]),
              ]),
              readonlyGroup(config.query, { attributes: config.attributes }, false, h),
            ],
          ),
        ],
  );
