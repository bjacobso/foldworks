---
"@foldworks/agent": patch
"@foldworks/code-editor": patch
"@foldworks/data-grid": patch
"@foldworks/diagram": patch
"@foldworks/editor": patch
"@foldworks/generative-ui": patch
"@foldworks/pdf-annotator": patch
"@foldworks/pdf-viewer": patch
"@foldworks/query-builder": patch
"@foldworks/sidebar": patch
"@foldworks/ui": patch
---

Emit declarations with TypeScript 7. The JavaScript is unchanged, and the
public types are equivalent. The declaration files are laid out differently:
local helpers are declared once and referenced with `typeof`, named aliases are
reused, and union members may be ordered differently. The field records of
`defineMessageUnion` schemas (`Message.X.fields`) no longer print `readonly` on
some keys; the Message types themselves are identical.
