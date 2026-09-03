# @foldworks/query-builder

A configurable, validated query builder for Foldkit applications.

The package owns the recursive query document, editing submodel, built-in
operator semantics, validation, an editable view, and a compact read-only
render. Applications provide the available attributes and keep ownership of
executing or persisting the resulting query.

```ts
import {
  QueryBuilder,
  defineAttributes,
  validate,
} from "@foldworks/query-builder";

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
same query needs a compact, non-interactive summary.

The default StyleX presentation uses the shared `@foldworks/ui`
semantic tokens for every color, shadow, radius, and motion value. New groups
and rules enter with keyed spring transitions; rows expose hover, pressed, and
focus-within feedback; validation changes animate without moving surrounding
content. All non-essential animation is disabled when the user prefers reduced
motion.

Rules can be reordered within or between groups using the drag handle. Pointer
dragging uses an 8px activation threshold, and keyboard users can pick up a rule
with Space or Enter, move between the visible insertion targets with Tab or
Shift+Tab, and drop with Space or Enter.

Custom operator labels can be supplied per attribute. An operator with
`requiresValue: false` skips value validation and omits the value editor.
A top-level `validateValue(attribute, value)` callback adds domain validation
after the built-in kind checks. Keeping the callback at the top of
`viewInputs` lets Foldkit scope it across the submodel boundary; attribute
definitions remain serializable data.
