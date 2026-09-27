#!/usr/bin/env node
// Synthetic reproduction of the identity-cache blow-up caused by
// `foldkit/html`'s `Attribute<Message>` (a 310-variant `Data.TaggedEnum`).
//
// Usage:
//   node scripts/attribute-repro.mjs <variant> [views] [outDir]
//   variant: enum | split | split-intersect | structural | opaque | explicit
//
// It writes a tiny project to `outDir` (default `.context/repro/<variant>`) and
// prints the command to type-check it with `--extendedDiagnostics`.
//
//   enum      Attribute is one Effect-style TaggedEnum over every variant (as
//             shipped in foldkit@0.156.0).
//   split     Attribute = StaticAttribute | MessageAttribute<M>, where
//             StaticAttribute is a non-generic union and only the variants
//             that mention M are generic.
//   split-intersect  `split`, with the generic variants left as intersections.
//   structural  Attribute is one covariant interface every variant is
//             assignable to (the patch in patches/foldkit@0.156.0.patch).
//   opaque    Attribute is a single branded interface (for comparison).
//   explicit  Same as `enum`, but every helper call passes `<M>` explicitly.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [variant = "enum", viewsArg = "20", outArg] = process.argv.slice(2);
const views = Number(viewsArg);
const STATIC = 245;
const GENERIC = 65;
const outDir = resolve(outArg ?? join(".context/repro", `${variant}-${views}`));

// Effect 4's TaggedEnum, verbatim in shape (distributive conditional + Simplify).
const prelude = `
type Simplify<A> = { [K in keyof A]: A[K] } extends infer B ? B : never;
type TaggedEnum<A extends Record<string, Record<string, any>>> = keyof A extends infer Tag
  ? Tag extends keyof A
    ? Simplify<{ readonly _tag: Tag } & { readonly [K in keyof A[Tag]]: A[Tag][K] }>
    : never
  : never;
type Option<A> = { readonly _tag: "None" } | { readonly _tag: "Some"; readonly value: A };
`;

const staticFields = Array.from(
  { length: STATIC },
  (_, i) => `  S${i}: { readonly value: ${["string", "number", "boolean"][i % 3]} };`,
).join("\n");
const genericFields = Array.from({ length: GENERIC }, (_, i) =>
  i % 3 === 0
    ? `  G${i}: { readonly message: M };`
    : i % 3 === 1
      ? `  G${i}: { readonly f: (value: string) => M };`
      : `  G${i}: { readonly f: (key: string, n: number) => Option<M> };`,
).join("\n");

const attributeDecl = {
  enum: `export type Attr<M> = TaggedEnum<{\n${genericFields}\n${staticFields}\n}>;`,
  explicit: `export type Attr<M> = TaggedEnum<{\n${genericFields}\n${staticFields}\n}>;`,
  split: `export type StaticAttr = TaggedEnum<{\n${staticFields}\n}>;
export type MessageAttr<M> = TaggedEnum<{\n${genericFields}\n}>;
export type Attr<M> = StaticAttr | MessageAttr<M>;`,
  "split-intersect": `export type StaticAttr = TaggedEnum<{\n${staticFields}\n}>;
type Tagged<A> = keyof A extends infer Tag ? Tag extends keyof A ? { readonly _tag: Tag } & A[Tag] : never : never;
export type MessageAttr<M> = Tagged<{\n${genericFields}\n}>;
export type Attr<M> = StaticAttr | MessageAttr<M>;`,
  structural: `export interface Attr<out M> {
  readonly _tag: \`S\${number}\` | \`G\${number}\`;
  readonly value?: unknown;
  readonly message?: M;
  readonly f?: (...args: never) => M | Option<M>;
}`,
  opaque: `declare const AttrTypeId: unique symbol;
export interface Attr<out M> { readonly [AttrTypeId]: (_: never) => M; readonly _tag: string }`,
}[variant];
if (attributeDecl === undefined) throw new Error(`unknown variant ${variant}`);

const lib = `${prelude}
${attributeDecl}
export type Child = { readonly _tag: "Child"; readonly value: number };
declare const universe: unique symbol;
export type Builder<M> = Readonly<{ [universe]: (m: M) => M }> & {
  div(attrs: ReadonlyArray<Attr<M> | Child>, children?: ReadonlyArray<string>): string;
  Id(v: string): Attr<M>;
  Class(v: string): Attr<M>;
  OnClick(m: M): Attr<M>;
};
export type SlotProps<M> = Readonly<{ attributes?: ReadonlyArray<Attr<M> | Child>; sx?: string }>;
export declare const sx: <M>(h: Builder<M>, ...styles: ReadonlyArray<string | undefined>) => ReadonlyArray<Attr<M>>;
export const slotAttrs = <M>(
  slot: SlotProps<M> | undefined,
  h: Builder<M>,
  ...styles: ReadonlyArray<string>
): ReadonlyArray<Attr<M> | Child> => [...(slot?.attributes ?? []), ...sx(h, ...styles, slot?.sx)];
`;

const typeArg = variant === "explicit" ? "<M>" : "";
const viewFile = (i) => `import { slotAttrs, sx, type Builder, type SlotProps } from "./lib";
export type Config${i}<M> = Readonly<{ label?: SlotProps<M>; root?: SlotProps<M>; onPress?: M }>;
export const view${i} = <M>(config: Config${i}<M>, h: Builder<M>): string =>
  h.div([
    ...slotAttrs${typeArg}(config.root, h, "root"),
    h.Id("v${i}"),
    ...(config.onPress === undefined ? [] : [h.OnClick(config.onPress)]),
    ...sx${typeArg}(h, "x"),
  ], [h.div(slotAttrs${typeArg}(config.label, h, "label"))]);
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "lib.ts"), lib);
for (let i = 0; i < views; i++) writeFileSync(join(outDir, `view${i}.ts`), viewFile(i));
writeFileSync(
  join(outDir, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        strict: true,
        noEmit: true,
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        exactOptionalPropertyTypes: true,
        skipLibCheck: true,
        types: [],
      },
      include: ["*.ts"],
    },
    null,
    2,
  ),
);
console.log(`wrote ${outDir}\n  tsc -p ${outDir} --extendedDiagnostics`);
