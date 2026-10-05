declare module "virtual:foldworks-docs" {
  const catalog: ReadonlyArray<import("./catalog").PackageDoc>;
  export default catalog;
}
