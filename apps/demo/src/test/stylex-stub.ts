export type StyleXStyles = string | false | null | undefined;

export const create = <Styles extends Record<string, unknown>>(
  styles: Styles,
): { [Key in keyof Styles]: string } =>
  Object.fromEntries(Object.keys(styles).map((key) => [key, key])) as {
    [Key in keyof Styles]: string;
  };

export const props = (...styles: ReadonlyArray<StyleXStyles>) => ({
  className: styles.filter((style): style is string => typeof style === "string").join(" "),
});

export const viewTransitionClass = () => "workflow-node-transition";
