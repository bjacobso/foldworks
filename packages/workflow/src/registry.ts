import type { Dimensions } from "./layout";

export type PaletteDefinition = Readonly<{
  label: string;
  description: string;
  symbol: string;
}>;

export type NodeTypeDefinition<Node, Render = unknown> = Readonly<{
  create: (id: string) => Node;
  size: (node: Node) => Dimensions;
  palette?: PaletteDefinition;
  render: Render;
}>;

export const defineNodeTypes = <const Definitions>(definitions: Definitions): Definitions =>
  definitions;
