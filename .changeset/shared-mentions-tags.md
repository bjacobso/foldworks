---
"@foldworks/text-intelligence": minor
"@foldworks/editor": minor
"@foldworks/outliner": patch
---

Add reusable plain-text mention/tag recognition, host entity lookup, configurable syntax exclusions, completions, diagnostics and shared hover presentation. Normalize completion matching to NFC and retain exact-prefix suggestions when a replacement still has a suffix.

Add generic synchronous inline text-intelligence hooks to the native editor, using the existing shared popups and editor-owned transactions, selection, composition, and history. Preserve explicitly escaped Markdown markers with an additive literal run mark; consumers decoding the previous mark union need to recognize literal marks when reading documents with escapes.

Suspend outliner completion and hover during native composition, and commit the finished text before offering suggestions.
