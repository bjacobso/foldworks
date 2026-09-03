import type { Dimensions } from "./layout";

export type PaletteDefinition = Readonly<{
  label: string;
  description: string;
  symbol?: string;
}>;

export type NodeTypeDefinition<Node, Render = unknown> = Readonly<{
  create: (id: string) => Node;
  size: (node: Node) => Dimensions;
  palette?: PaletteDefinition;
  movable: boolean;
  deletable: boolean;
  render: Render;
}>;

export type NodeTypeDefinitionInput<Node, Render = unknown> =
  & Omit<NodeTypeDefinition<Node, Render>, "movable" | "deletable">
  & Readonly<{ movable?: boolean; deletable?: boolean }>;

export type NodeTypeRegistry<Node> = Readonly<Record<
  string,
  Readonly<{ movable?: boolean; deletable?: boolean }>
>>;

export const defineNodeTypes = <
  const Definitions extends Readonly<Record<
    string,
    & Readonly<{ movable?: boolean; deletable?: boolean }>
    & Readonly<Record<string, unknown>>
  >>,
>(definitions: Definitions): {
  readonly [Key in keyof Definitions]: Definitions[Key] & Readonly<{
    movable: boolean;
    deletable: boolean;
  }>;
} => Object.fromEntries(
  Object.entries(definitions).map(([key, definition]) => [
    key,
    { movable: true, deletable: true, ...definition },
  ]),
) as {
  readonly [Key in keyof Definitions]: Definitions[Key] & Readonly<{
    movable: boolean;
    deletable: boolean;
  }>;
};

const PALETTE_PREFIX = "palette:";

export const paletteItemId = (type: string): string =>
  `${PALETTE_PREFIX}${encodeURIComponent(type)}`;

export const paletteTypeFromId = (id: string): string | undefined => {
  if (!id.startsWith(PALETTE_PREFIX)) return undefined;
  const encodedType = id.slice(PALETTE_PREFIX.length);
  if (encodedType.length === 0) return undefined;
  try {
    return decodeURIComponent(encodedType);
  } catch {
    return undefined;
  }
};
