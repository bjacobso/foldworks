import { Schema as S } from "effect";

import type { Spec } from "./model";

export type ObjectSchema = S.Codec<unknown, unknown, never, never>;

export type ComponentDefinition<Props extends ObjectSchema = ObjectSchema> = Readonly<{
  description: string;
  props: Props;
  children?: "none" | "optional" | "required";
  events?: ReadonlyArray<string>;
}>;

export type ActionDefinition<Params extends ObjectSchema = ObjectSchema> = Readonly<{
  description: string;
  params: Params;
}>;

export type ComponentDefinitions = Readonly<Record<string, ComponentDefinition>>;
export type ActionDefinitions = Readonly<Record<string, ActionDefinition>>;

export type Catalog<
  Components extends ComponentDefinitions = ComponentDefinitions,
  Actions extends ActionDefinitions = ActionDefinitions,
> = Readonly<{
  name: string;
  description?: string;
  components: Components;
  actions: Actions;
  schema: S.Codec<Spec, Spec, never, never>;
}>;

const union = (members: ReadonlyArray<S.Top>): S.Top => {
  if (members.length === 0) return S.Never;
  if (members.length === 1) return members[0]!;
  return S.Union(members);
};

const actionBindingSchema = (actions: ActionDefinitions): S.Top =>
  union(
    Object.entries(actions).map(([name, definition]) =>
      S.Struct({
        action: S.Literal(name),
        params: definition.params,
      }),
    ),
  );

const elementSchema = (components: ComponentDefinitions, actions: ActionDefinitions): S.Top => {
  const binding = actionBindingSchema(actions);
  return union(
    Object.entries(components).map(([name, definition]) =>
      S.Struct({
        type: S.Literal(name),
        props: definition.props,
        children: S.Array(S.String),
        on: S.optional(S.Record(S.String, binding)),
      }),
    ),
  );
};

export const defineCatalog = <
  const Components extends ComponentDefinitions,
  const Actions extends ActionDefinitions,
>(
  config: Readonly<{
    name: string;
    description?: string;
    components: Components;
    actions: Actions;
  }>,
): Catalog<Components, Actions> => {
  const schema = S.Struct({
    version: S.Literal("1"),
    root: S.String,
    elements: S.Record(S.String, elementSchema(config.components, config.actions)),
  }) as unknown as S.Codec<Spec, Spec, never, never>;
  return { ...config, schema };
};

const jsonSchemaFor = (schema: S.Top): unknown => {
  const document = S.toJsonSchemaDocument(schema);
  return Object.keys(document.definitions).length === 0
    ? document.schema
    : { ...document.schema, $defs: document.definitions };
};

/** Model instructions derived from the exact schemas used at the runtime boundary. */
export const catalogPrompt = (catalog: Catalog): string => {
  const components = Object.entries(catalog.components)
    .map(([name, definition]) =>
      JSON.stringify({
        name,
        description: definition.description,
        children: definition.children ?? "optional",
        events: definition.events ?? [],
        props: jsonSchemaFor(definition.props),
      }),
    )
    .join("\n");
  const actions = Object.entries(catalog.actions)
    .map(([name, definition]) =>
      JSON.stringify({
        name,
        description: definition.description,
        params: jsonSchemaFor(definition.params),
      }),
    )
    .join("\n");
  return [
    `Generate a ${catalog.name} interface as JSON.`,
    catalog.description ?? "",
    "Return one object matching the supplied schema. Use only the listed components and actions.",
    "The root and every child reference must name an element in the elements map.",
    "The element graph must be connected and acyclic. Leaf elements use an empty children array.",
    "Bind interactions through an element's on map. Never emit code, HTML, CSS, URLs, or event-handler source.",
    "Components (one JSON object per line):",
    components,
    "Actions (one JSON object per line):",
    actions || "(none)",
  ]
    .filter(Boolean)
    .join("\n");
};
