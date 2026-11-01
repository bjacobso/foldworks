# foldworks

The UI standard library for Foldkit and StyleX, from design tokens to complete
workbenches. Foldworks is pre-1.0; APIs are evolving.

**[Explore Foldworks](https://foldworks.dev)**

One package holds every module. Each module has its own import path, such as
`foldworks/ui` or `foldworks/data-grid`, and applications bundle only the
modules they import.

## Install

```sh
pnpm add foldworks effect foldkit @foldkit/ui @stylexjs/stylex
pnpm add -D @stylexjs/unplugin
```

Effect, Foldkit, `@foldkit/ui`, and StyleX are peer dependencies shared with
your application. Configure the StyleX transform, cascade layers, and themes as
described in the [`foldworks/ui` setup](./src/ui/README.md#setup).

Three integrations are optional peers. Install one only when you import a
module that needs it:

| Install                          | Needed by                                                          |
| -------------------------------- | ------------------------------------------------------------------ |
| `pdfjs-dist`                     | `foldworks/pdf`, `foldworks/pdf-viewer`, `foldworks/pdf-annotator` |
| `pdf-lib`                        | `foldworks/pdf-annotator`                                          |
| `@modelcontextprotocol/ext-apps` | `foldworks/generative-ui/mcp-app`                                  |

## Modules

- **Workbenches:** [`agent`](./src/agent/README.md), [`generative-ui`](./src/generative-ui/README.md).
- **Application primitives:** [`editor`](./src/editor/README.md), [`code-editor`](./src/code-editor/README.md), [`outliner`](./src/outliner/README.md), [`data-table`](./src/data-table/README.md), [`data-grid`](./src/data-grid/README.md), [`query-builder`](./src/query-builder/README.md), [`form-builder`](./src/form-builder/README.md), [`workflow`](./src/workflow/README.md), [`diff-viewer`](./src/diff-viewer/README.md), [`review`](./src/review/README.md), [`pdf-viewer`](./src/pdf-viewer/README.md), [`pdf-annotator`](./src/pdf-annotator/README.md).
- **Behaviors:** [`keyboard`](./src/keyboard/README.md), [`history`](./src/history/README.md), [`text-intelligence`](./src/text-intelligence/README.md), [`diagram`](./src/diagram/README.md), [`pdf`](./src/pdf/README.md).
- **Components and tokens:** [`ui`](./src/ui/README.md), [`sidebar`](./src/sidebar/README.md).

Modules with styles export a stylesheet beside their code, such as
`foldworks/data-grid/styles.css`. The [documentation site](https://foldworks.dev/docs)
lists every entry point, source file, and model/message contract.

## Migrating from `@foldworks/*`

Foldworks was previously published as separate `@foldworks/<name>` packages.
Replace each dependency with `foldworks` and change imports from
`@foldworks/<name>` to `foldworks/<name>`:

```ts
// Before
import { Button } from "@foldworks/ui";
import "@foldworks/data-grid/styles.css";

// After
import { Button } from "foldworks/ui";
import "foldworks/data-grid/styles.css";
```

`foldworks/generative-ui` no longer re-exports the MCP Apps iframe bridge;
import `connectMcpApp` and related helpers from `foldworks/generative-ui/mcp-app`.
