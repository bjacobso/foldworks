---
"@foldworks/ui": minor
---

Add `@foldworks/ui/vite` with `foldworksLayers`, which ranks the Foldworks reset
below StyleX in `vite dev` through `useCSSLayers: { before: foldworksLayers }`,
and `foldworksStylexTest()`, a Vitest plugin that renders StyleX views without
the compiler through the new `@foldworks/ui/testing/stylex` runtime. Add
`@foldworks/ui/layers.css` for setups that declare the layer order themselves,
and document cascade layers, control typography under the reset, and adopting
the tokens in application StyleX.
