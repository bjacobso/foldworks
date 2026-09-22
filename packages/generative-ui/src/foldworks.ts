import { Alert, Badge, Button, Card, Heading, Layout, Table, Text } from "@foldworks/ui";
import { Schema as S } from "effect";

import type { ActionDefinitions, Catalog } from "./catalog";
import { defineCatalog } from "./catalog";
import type { Registry, RenderContext } from "./renderer";

const Gap = S.Literals(["none", "xs", "sm", "md", "lg", "xl"]);
const Align = S.Literals(["stretch", "start", "center", "end", "baseline"]);
const Justify = S.Literals(["start", "center", "end", "between", "around", "evenly"]);
const Tone = S.Literals(["default", "muted", "success", "warning", "danger"]);

export const foldworksComponents = {
  Stack: {
    description: "Vertical layout for related content.",
    props: S.Struct({
      gap: S.optional(Gap),
      align: S.optional(Align),
      justify: S.optional(Justify),
    }),
    children: "required",
  },
  Row: {
    description: "Horizontal, wrapping layout for compact controls or values.",
    props: S.Struct({
      gap: S.optional(Gap),
      align: S.optional(Align),
      justify: S.optional(Justify),
      wrap: S.optional(S.Boolean),
    }),
    children: "required",
  },
  Grid: {
    description: "Responsive grid for cards or comparable items.",
    props: S.Struct({
      columns: S.optional(S.Int.check(S.isBetween({ minimum: 1, maximum: 12 }))),
      gap: S.optional(Gap),
      minColumnWidth: S.optional(S.String),
    }),
    children: "required",
  },
  Card: {
    description: "Grouped content with an optional title and description.",
    props: S.Struct({ title: S.optional(S.String), description: S.optional(S.String) }),
    children: "required",
  },
  Heading: {
    description: "Semantic section heading.",
    props: S.Struct({
      text: S.String,
      level: S.optional(S.Literals([1, 2, 3, 4, 5, 6])),
      size: S.optional(S.Literals(["sm", "md", "lg", "xl"])),
      tone: S.optional(Tone),
    }),
    children: "none",
  },
  Text: {
    description: "Short paragraph or inline text.",
    props: S.Struct({
      text: S.String,
      size: S.optional(S.Literals(["xs", "sm", "md", "lg", "xl"])),
      tone: S.optional(Tone),
      weight: S.optional(S.Literals(["regular", "medium", "semibold", "bold"])),
    }),
    children: "none",
  },
  Badge: {
    description: "Compact status or category label.",
    props: S.Struct({
      label: S.String,
      tone: S.optional(S.Literals(["neutral", "success", "warning", "danger", "info"])),
      dot: S.optional(S.Boolean),
    }),
    children: "none",
  },
  Alert: {
    description: "Prominent status with a title and optional explanation.",
    props: S.Struct({
      title: S.String,
      description: S.optional(S.String),
      tone: S.optional(S.Literals(["default", "danger"])),
    }),
    children: "optional",
  },
  Button: {
    description: "A user-triggered action. Bind the press event to a declared action.",
    props: S.Struct({
      label: S.String,
      variant: S.optional(S.Literals(["primary", "secondary", "outline", "ghost", "danger"])),
      size: S.optional(S.Literals(["xs", "sm", "md", "lg"])),
      disabled: S.optional(S.Boolean),
    }),
    children: "none",
    events: ["press"],
  },
  Table: {
    description: "Small read-only data table. Prefer fewer than ten rows.",
    props: S.Struct({
      caption: S.optional(S.String),
      columns: S.Array(S.String),
      rows: S.Array(S.Array(S.String)),
    }),
    children: "none",
  },
} as const;

export const createFoldworksCatalog = <const Actions extends ActionDefinitions>(
  actions: Actions,
): Catalog<typeof foldworksComponents, Actions> =>
  defineCatalog({
    name: "Foldworks",
    description: "A restrained application UI composed from accessible Foldworks primitives.",
    components: foldworksComponents,
    actions,
  });

type Props<Name extends keyof typeof foldworksComponents> =
  (typeof foldworksComponents)[Name]["props"]["Type"];
const props = <Name extends keyof typeof foldworksComponents>(
  _name: Name,
  context: RenderContext<unknown>,
): Props<Name> => context.props as Props<Name>;
const optional = <Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): {} | { [K in Key]: Value } =>
  value === undefined ? {} : ({ [key]: value } as { [K in Key]: Value });

/** The renderer is framework-native: JSON selects Foldworks components, never DOM tags. */
export const foldworksRegistry = <Message>(): Registry<Message> => ({
  Stack: (context, h) => {
    const value = props("Stack", context);
    return Layout.Stack.view<Message>(
      {
        children: context.children,
        attributes: [h.Key(context.id)],
        ...optional("gap", value.gap),
        ...optional("align", value.align),
        ...optional("justify", value.justify),
      },
      h,
    );
  },
  Row: (context, h) => {
    const value = props("Row", context);
    return Layout.Row.view<Message>(
      {
        children: context.children,
        attributes: [h.Key(context.id)],
        ...optional("gap", value.gap),
        ...optional("align", value.align),
        ...optional("justify", value.justify),
        ...optional("wrap", value.wrap),
      },
      h,
    );
  },
  Grid: (context, h) => {
    const value = props("Grid", context);
    return Layout.Grid.view<Message>(
      {
        children: context.children,
        attributes: [h.Key(context.id)],
        ...optional("columns", value.columns),
        ...optional("gap", value.gap),
        ...optional("minColumnWidth", value.minColumnWidth),
      },
      h,
    );
  },
  Card: (context, h) => {
    const value = props("Card", context);
    return Card.view<Message>(
      {
        children: context.children,
        attributes: [h.Key(context.id)],
        ...optional("title", value.title),
        ...optional("description", value.description),
      },
      h,
    );
  },
  Heading: (context, h) => {
    const value = props("Heading", context);
    return Heading.view<Message>(
      {
        children: [value.text],
        attributes: [h.Key(context.id)],
        ...optional("level", value.level),
        ...optional("size", value.size),
        ...optional("tone", value.tone),
      },
      h,
    );
  },
  Text: (context, h) => {
    const value = props("Text", context);
    return Text.view<Message>(
      {
        children: [value.text],
        attributes: [h.Key(context.id)],
        ...optional("size", value.size),
        ...optional("tone", value.tone),
        ...optional("weight", value.weight),
      },
      h,
    );
  },
  Badge: (context, h) => {
    const value = props("Badge", context);
    return Badge.view<Message>(
      {
        label: value.label,
        attributes: [h.Key(context.id)],
        ...optional("tone", value.tone),
        ...optional("dot", value.dot),
      },
      h,
    );
  },
  Alert: (context, h) => {
    const value = props("Alert", context);
    return Alert.view<Message>(
      {
        title: value.title,
        children: context.children,
        attributes: [h.Key(context.id)],
        ...optional("description", value.description),
        ...optional("tone", value.tone),
      },
      h,
    );
  },
  Button: (context, h) => {
    const onClick = context.emit("press");
    const value = props("Button", context);
    return Button.view<Message>(
      {
        label: value.label,
        attributes: [h.Key(context.id)],
        ...optional("variant", value.variant),
        ...optional("size", value.size),
        ...optional("isDisabled", value.disabled),
        ...(onClick === undefined ? {} : { onClick: onClick as Message }),
      },
      h,
    );
  },
  Table: (context, h) => {
    const value = props("Table", context);
    return Table.view<Message>(
      {
        columns: value.columns,
        rows: value.rows,
        attributes: [h.Key(context.id)],
        ...optional("caption", value.caption),
      },
      h,
    );
  },
});
