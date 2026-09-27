// A runtime stand-in for `@stylexjs/stylex` in tests that run without the
// StyleX compiler. Alias `@stylexjs/stylex` to this module (the
// `foldworksStylexTest` plugin from `@foldworks/ui/vite` does this) so views
// that call `stylex.create` can render under Vitest.
//
// Each style key becomes a readable class name equal to the key, so tests can
// assert which styles a view applied: `stylex.create({ root: {...} }).root`
// is `"root"`. Dynamic styles keep their key as the class name and expose
// their primitive property values as inline styles. The stub does not produce
// real CSS; use browser tests for visual behavior.

type StyleValue = string | number | null | undefined;

type DynamicStyle = {
  readonly className: string;
  readonly style: Readonly<Record<string, string | number>>;
};

export type StyleXStyles =
  | string
  | DynamicStyle
  | false
  | null
  | undefined
  | ReadonlyArray<StyleXStyles>;

const dynamicStyle = Symbol("foldworks-stylex-test-dynamic");

const isDynamicStyle = (value: unknown): value is DynamicStyle & { [dynamicStyle]: true } =>
  typeof value === "object" && value !== null && dynamicStyle in value;

const inlineValues = (declarations: unknown): Record<string, string | number> => {
  if (typeof declarations !== "object" || declarations === null) return {};
  const values: Record<string, string | number> = {};
  for (const [property, value] of Object.entries(declarations as Record<string, unknown>)) {
    if (typeof value === "string" || typeof value === "number") values[property] = value;
  }
  return values;
};

type CreatedStyles<Styles> = {
  readonly [Key in keyof Styles]: Styles[Key] extends (...args: infer Args) => unknown
    ? (...args: Args) => DynamicStyle
    : string;
};

export const create = <const Styles extends Record<string, unknown>>(
  styles: Styles,
): CreatedStyles<Styles> =>
  Object.fromEntries(
    Object.entries(styles).map(([key, value]) => [
      key,
      typeof value === "function"
        ? (...args: ReadonlyArray<unknown>) => ({
            [dynamicStyle]: true,
            className: key,
            style: inlineValues((value as (...values: ReadonlyArray<unknown>) => unknown)(...args)),
          })
        : key,
    ]),
  ) as CreatedStyles<Styles>;

const collect = (
  styles: ReadonlyArray<unknown>,
  classNames: Array<string>,
  style: Record<string, string | number>,
): void => {
  for (const entry of styles) {
    if (typeof entry === "string") {
      if (entry !== "") classNames.push(entry);
    } else if (Array.isArray(entry)) {
      collect(entry, classNames, style);
    } else if (isDynamicStyle(entry)) {
      classNames.push(entry.className);
      Object.assign(style, entry.style);
    }
  }
};

export const props = (
  ...styles: ReadonlyArray<StyleXStyles>
): { className: string; style?: Record<string, string | number> } => {
  const classNames: Array<string> = [];
  const style: Record<string, string | number> = {};
  collect(styles, classNames, style);
  return Object.keys(style).length > 0
    ? { className: classNames.join(" "), style }
    : { className: classNames.join(" ") };
};

export const attrs = (
  ...styles: ReadonlyArray<StyleXStyles>
): { class?: string; style?: string } => {
  const { className, style } = props(...styles);
  const attributes: { class?: string; style?: string } = {};
  if (className !== "") attributes.class = className;
  if (style !== undefined) {
    attributes.style = Object.entries(style)
      .map(([property, value]) => `${property}:${value}`)
      .join(";");
  }
  return attributes;
};

export const defineConsts = <const Values extends Record<string, StyleValue>>(
  values: Values,
): Values => values;

// Variables resolve to `var(--<key>)` so snapshots stay readable.
export const defineVars = <const Values extends Record<string, unknown>>(
  values: Values,
): { readonly [Key in keyof Values]: string } =>
  Object.fromEntries(Object.keys(values).map((key) => [key, `var(--${key})`])) as {
    readonly [Key in keyof Values]: string;
  };

export const createTheme = (_variables: unknown, _overrides: unknown): string =>
  "stylex-test-theme";

export const keyframes = (_frames: unknown): string => "stylex-test-keyframes";

export const positionTry = (_position: unknown): string => "stylex-test-position-try";

export const viewTransitionClass = (_transition: unknown): string => "stylex-test-view-transition";

export const firstThatWorks = <const Value extends string | number>(
  ...values: ReadonlyArray<Value>
): Value | undefined => values[0];

export const defineMarker = (): string => "stylex-test-marker";

export const defaultMarker = (): string => "stylex-test-default-marker";

const pseudo = (pseudoClass: string, _marker?: unknown): string => pseudoClass;

export const when = {
  ancestor: pseudo,
  anySibling: pseudo,
  descendant: pseudo,
  siblingAfter: pseudo,
  siblingBefore: pseudo,
} as const;

export const env: Readonly<Record<string, never>> = Object.freeze({});

const identity = <Value>(value: Value): Value => value;

export const types = {
  angle: identity,
  color: identity,
  image: identity,
  integer: identity,
  length: identity,
  lengthPercentage: identity,
  number: identity,
  percentage: identity,
  resolution: identity,
  time: identity,
  transformFunction: identity,
  transformList: identity,
  url: identity,
} as const;
