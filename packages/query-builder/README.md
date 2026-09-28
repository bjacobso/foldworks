# @foldworks/query-builder

A configurable, validated query builder for Foldkit applications.

The package owns the recursive query document, editing submodel, built-in
operator semantics, validation, an editable view, and a compact read-only
render. Applications provide the available attributes and keep ownership of
executing or persisting the resulting query.

```ts
import { QueryBuilder, defineAttributes, validate } from "@foldworks/query-builder";

const attributes = defineAttributes([
  { id: "name", label: "Name", kind: "Text" },
  { id: "headcount", label: "Headcount", kind: "Number" },
  {
    id: "status",
    label: "Status",
    kind: "Select",
    options: [
      { value: "active", label: "Active" },
      { value: "paused", label: "Paused" },
    ],
  },
]);

const model = QueryBuilder.init({ id: "customer-query" });
const result = validate(model.query, { attributes });
```

Render `QueryBuilder.view` through a Foldkit submodel boundary and fold its
messages with `QueryBuilder.update`. Use `QueryBuilder.readOnlyView` when the
same query needs a non-interactive summary: it leads with a plain-language
sentence and keeps the structured AND/OR logic behind a native disclosure
(`isLogicOpen` controls the initial state). Both views accept a
`summaryPrefix`, for example `"This policy applies when"`, and
`summaryText(query, attributes, prefix)` returns the same sentence as a string.

The default StyleX presentation is intentionally dense: each group is a rail
with an AND/OR selector and a description of how its conditions combine, and
each rule is a single row of native controls. It uses the shared
`@foldworks/ui` semantic tokens for every color, radius, and motion value.
New groups and rules enter with a short keyed transition, and all
non-essential animation is disabled when the user prefers reduced motion.

Rules and nested groups can be reordered within or between groups using the
drag handle that appears on hover or focus. A group cannot be dropped inside
itself, and drop targets that would nest groups past `maxDepth` are disabled.
Pointer dragging uses an 8px activation threshold, and keyboard users can pick
up a rule or group with Space or Enter, move between the visible insertion
targets with Tab or Shift+Tab, and drop with Space or Enter. Use
`applyNodeReorder` or `moveNode` when committing moves outside the bundled
update.

Custom operator labels can be supplied per attribute. An operator with
`requiresValue: false` skips value validation and omits the value editor.
A top-level `validateValue(attribute, value)` callback adds domain validation
after the built-in kind checks. Keeping the callback at the top of
`viewInputs` lets Foldkit scope it across the submodel boundary; attribute
definitions remain serializable data.
