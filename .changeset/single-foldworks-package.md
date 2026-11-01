---
"foldworks": minor
---

Publish Foldworks as one `foldworks` package. The former `@foldworks/<name>`
packages are now modules imported from `foldworks/<name>`, such as
`foldworks/ui` and `foldworks/data-grid/styles.css`, and share one version.
`pdfjs-dist`, `pdf-lib`, and `@modelcontextprotocol/ext-apps` are optional peer
dependencies, needed only by the PDF modules and
`foldworks/generative-ui/mcp-app`. `foldworks/generative-ui` no longer
re-exports the MCP Apps iframe bridge; import it from
`foldworks/generative-ui/mcp-app`.
