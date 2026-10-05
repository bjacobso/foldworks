---
"@foldworks/code-editor": minor
---

Add Lisp structural editing and evaluation results. Lisp language IDs (`clojure`, `clojurescript`, `edn`, `lisp`, `scheme`) get a tolerant form reader, highlighting, balanced delimiter typing and deletion, Clojure-style indentation and reindenting, paredit-style commands (expand/contract selection, move by form, slurp, barf, raise, splice, wrap), a tinted form at the cursor, and reader diagnostics. A new `@foldworks/code-editor/lisp` entry exports the reader and edit plans. Cmd/Ctrl + Enter emits `RequestedEvaluation` for the form at the cursor, and hosts can answer with the new `SetAnnotations` operation. The editor shows those inline results, maps them through edits, and marks them stale when their form changes.
