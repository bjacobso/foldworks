import {
  defineAttributes,
  type AttributeDefinition,
  type QueryGroup,
} from "@foldworks/query-builder";

export const attributes = defineAttributes([
  {
    id: "employee.name",
    label: "Employee name",
    kind: "Text",
    placeholder: "e.g. Maya",
  },
  {
    id: "employee.department",
    label: "Department",
    kind: "Select",
    options: [
      { value: "engineering", label: "Engineering" },
      { value: "operations", label: "Operations" },
      { value: "people", label: "People" },
      { value: "finance", label: "Finance" },
    ],
  },
  {
    id: "employee.salary",
    label: "Annual salary",
    kind: "Number",
    placeholder: "e.g. 100000",
  },
  {
    id: "employee.startDate",
    label: "Start date",
    kind: "Date",
  },
  {
    id: "employee.isManager",
    label: "Is a manager",
    kind: "Boolean",
  },
  {
    id: "employee.email",
    label: "Work email",
    kind: "Text",
    operators: [
      { id: "ends_with", label: "ends with" },
      { id: "equals", label: "is" },
      { id: "is_empty", label: "is empty", requiresValue: false },
    ],
    placeholder: "e.g. @example.com",
  },
] as const);

export const validateValue = (
  attribute: AttributeDefinition,
  value: string,
): string | undefined =>
  attribute.id === "employee.salary" && Number(value) < 0
    ? "Annual salary cannot be negative."
    : undefined;

export const initialQuery: QueryGroup = {
  _tag: "Group",
  id: "employee-filter-root",
  combinator: "All",
  children: [
    {
      _tag: "Rule",
      id: "rule-1",
      attributeId: "employee.department",
      operatorId: "is",
      value: "engineering",
    },
    {
      _tag: "Group",
      id: "group-2",
      combinator: "Any",
      children: [
        {
          _tag: "Rule",
          id: "rule-3",
          attributeId: "employee.salary",
          operatorId: "greater_than_or_equal",
          value: "150000",
        },
        {
          _tag: "Rule",
          id: "rule-4",
          attributeId: "employee.isManager",
          operatorId: "is",
          value: "true",
        },
      ],
    },
    {
      _tag: "Rule",
      id: "rule-5",
      attributeId: "employee.email",
      operatorId: "ends_with",
      value: "@example.com",
    },
  ],
};
