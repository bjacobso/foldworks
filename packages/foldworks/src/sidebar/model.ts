import { Schema as S } from "effect";

export const Model = S.Struct({
  id: S.String,
  isCollapsed: S.Boolean,
  isMobileOpen: S.Boolean,
  announcement: S.String,
});
export type Model = typeof Model.Type;

export type InitConfig = Readonly<{
  id: string;
  defaultCollapsed?: boolean;
}>;

export const init = (config: InitConfig): Model => ({
  id: config.id,
  isCollapsed: config.defaultCollapsed ?? false,
  isMobileOpen: false,
  announcement: "Navigation ready.",
});
