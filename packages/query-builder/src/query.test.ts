import { inertHtml as h } from "foldkit/html";
import { Scene } from "foldkit/test";
import { describe, expect, it } from "vitest";

import { Message } from "./message";
import { init } from "./model";
import {
  appendNode,
  defineAttributes,
  findNode,
  removeNode,
  type QueryGroup,
} from "./query";
import { update } from "./update";
import { validate } from "./validation";
import { readOnlyView } from "./view";

const attributes = defineAttributes([
  { id: "name", label: "Name", kind: "Text" },
  { id: "headcount", label: "Headcount", kind: "Number" },
  { id: "active", label: "Active", kind: "Boolean" },
  { id: "created", label: "Created", kind: "Date" },
  {
    id: "status",
    label: "Status",
    kind: "Select",
    options: [
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
    ],
  },
] as const);

const validQuery: QueryGroup = {
  _tag: "Group",
  id: "root",
  combinator: "All",
  children: [
    { _tag: "Rule", id: "rule-a", attributeId: "name", operatorId: "contains", value: "Acme" },
    {
      _tag: "Group",
      id: "group-a",
      combinator: "Any",
      children: [
        { _tag: "Rule", id: "rule-b", attributeId: "headcount", operatorId: "greater_than", value: "50" },
        { _tag: "Rule", id: "rule-c", attributeId: "status", operatorId: "is", value: "active" },
      ],
    },
  ],
};

describe("query operations", () => {
  it("appends and removes nodes without mutating unrelated branches", () => {
    const nested = validQuery.children[1];
    if (nested?._tag !== "Group") throw new Error("Expected nested group");
    const appended = appendNode(validQuery, nested.id, {
      _tag: "Rule",
      id: "rule-d",
      attributeId: "active",
      operatorId: "is",
      value: "true",
    });

    expect(appended).toBeDefined();
    expect(findNode(appended!, "rule-d")).toMatchObject({ value: "true" });
    expect(appended!.children[0]).toBe(validQuery.children[0]);
    expect(removeNode(appended!, "group-a")?.children).toHaveLength(1);
    expect(removeNode(validQuery, "root")).toBeUndefined();
  });

  it("rejects duplicate ids and unknown parent groups", () => {
    expect(appendNode(validQuery, "root", validQuery.children[0]!)).toBeUndefined();
    expect(appendNode(validQuery, "missing", {
      _tag: "Rule",
      id: "new",
      attributeId: "name",
      operatorId: "equals",
      value: "x",
    })).toBeUndefined();
  });
});

describe("query validation", () => {
  it("accepts configured nested conditions", () => {
    expect(validate(validQuery, { attributes })).toEqual({ isValid: true, issues: [] });
  });

  it("reports actionable attribute, operator, value, option, and depth issues", () => {
    const invalid: QueryGroup = {
      _tag: "Group",
      id: "root",
      combinator: "Any",
      children: [
        { _tag: "Rule", id: "duplicate", attributeId: "missing", operatorId: "equals", value: "x" },
        { _tag: "Rule", id: "duplicate", attributeId: "headcount", operatorId: "greater_than", value: "many" },
        { _tag: "Rule", id: "bad-option", attributeId: "status", operatorId: "is", value: "archived" },
        {
          _tag: "Group",
          id: "too-deep",
          combinator: "All",
          children: [{ _tag: "Rule", id: "missing-value", attributeId: "name", operatorId: "contains", value: "" }],
        },
      ],
    };

    const codes = validate(invalid, { attributes, maxDepth: 0 }).issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining([
      "UnknownAttribute",
      "DuplicateId",
      "InvalidNumber",
      "InvalidOption",
      "MaxDepthExceeded",
      "MissingValue",
    ]));
  });

  it("validates calendar dates rather than only their string shape", () => {
    const query: QueryGroup = {
      _tag: "Group",
      id: "root",
      combinator: "All",
      children: [{ _tag: "Rule", id: "date", attributeId: "created", operatorId: "on", value: "2025-02-29" }],
    };
    expect(validate(query, { attributes }).issues[0]?.code).toBe("InvalidDate");
  });

  it("runs consumer validation after built-in kind validation", () => {
    const query: QueryGroup = {
      _tag: "Group",
      id: "root",
      combinator: "All",
      children: [{ _tag: "Rule", id: "salary", attributeId: "headcount", operatorId: "equals", value: "-1" }],
    };
    const result = validate(query, {
      attributes,
      validateValue: (attribute, value) =>
        attribute.id === "headcount" && Number(value) < 0
          ? "Headcount cannot be negative."
          : undefined,
    });

    expect(result.issues).toEqual([expect.objectContaining({
      code: "CustomValue",
      message: "Headcount cannot be negative.",
    })]);
  });
});

describe("QueryBuilder submodel", () => {
  it("adds, edits, and removes rules through messages", () => {
    const initial = init({ id: "builder" });
    const added = update(initial, Message.AddedRule({
      groupId: initial.query.id,
      attributeId: "name",
      operatorId: "equals",
      value: "Maya",
    })).model;
    const rule = added.query.children[0];
    if (rule?._tag !== "Rule") throw new Error("Expected a rule");
    const changed = update(added, Message.ChangedValue({ ruleId: rule.id, value: "Noah" })).model;
    const changedRule = findNode(changed.query, rule.id);

    expect(changedRule?._tag === "Rule" ? changedRule.value : undefined).toBe("Noah");
    expect(update(changed, Message.RemovedNode({ nodeId: rule.id })).model.query.children).toEqual([]);
  });

  it("ignores messages that target unknown nodes", () => {
    const model = init({ id: "builder", query: validQuery });
    expect(update(model, Message.ChangedValue({ ruleId: "missing", value: "x" })).model).toBe(model);
    expect(update(model, Message.AddedGroup({ groupId: "missing" })).model).toBe(model);
  });

  it("renders a dense readable summary without editor controls", () => {
    const html = readOnlyView({ query: validQuery, attributes }, h);
    if (html === null) throw new Error("Expected query summary");

    expect(Scene.textContent(html)).toContain("NamecontainsAcmeandHeadcount>50orStatusisActive");
    expect(Scene.findAll(html, "input")).toHaveLength(0);
    expect(Scene.findAll(html, "button")).toHaveLength(0);
  });
});
