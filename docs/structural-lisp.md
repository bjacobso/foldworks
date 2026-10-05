# Structural Lisp: the outline is the program

This exploration asks what a Lisp environment looks like if the outliner is
the editor, not a view bolted onto a text file. It lives at `/lisp` in the demo
app, under [`apps/demo/src/lisp`](../apps/demo/src/lisp). It is a prototype,
not a package. The reusable pieces it needed went into
[`@foldworks/outliner`](../packages/outliner) as generic host hooks.

The idea is that an outline and an S-expression are the same object. A Lisp
form is a head followed by arguments, and an outline row is a line of text
followed by children. If every row is a form, the tree becomes the primary
editing surface. Parenthesized text is just one way to view it.
Structure stays visible, every row has an identity, and a person and an
assistant can edit the same program objects instead of line ranges.

## Try it

1. Open `/lisp`. Every row shows what it evaluated to. The `round` row inside
   `invoice-total` shows `1299 ×4`: rows inside functions show their most
   recent call.
2. Two workflow steps carry warnings: they read `:identity` before any step
   writes it. The last check, `before? onboarding verify-identity collect-i9`,
   is false.
3. Click `background-check`, press Esc, then ⇧↓ to select it and
   `collect-i9`. Choose the first suggestion: “Run these concurrently, but
   don't start the I-9 until identity verification succeeds.” The panel shows
   a structural diff with added, moved, and removed rows. It also reports what
   the change would do: one warning cleared, a check that turns true, and the
   warning that remains.
4. Accept it, then choose “Verify identity first”. The second proposal moves
   the step, removes the now-trivial `sequence`, and clears the last warning.
5. Press ⌘L (Ctrl+L elsewhere) to see the same program with parentheses, in
   `@foldworks/code-editor`. The outline's analysis highlights it, explains it
   on hover, and suggests names, and the line for the row with the caret is
   highlighted. Edits to the source are read back into the outline as you
   type; text that does not parse is marked where reading stopped and leaves
   the outline unchanged.

Undo covers all of it: typing, refactorings, accepted proposals, and source
edits, which coalesce into one step.

## How rows become Lisp

The encoding follows indentation-sensitive Lisp in the style of SRFI 119
("wisp"):

| Outline                             | Lisp                                    |
| ----------------------------------- | --------------------------------------- |
| `defn total [x]` with child `* x 2` | `(defn total [x] (* x 2))`              |
| `total 21` (no children)            | `(total 21)`                            |
| `total` (no children)               | `total`: one element is that element    |
| `(now)`                             | `(now)`: a call with no arguments       |
| `; note` with children              | a comment; it comments out its children |
| empty text with children            | a list whose head is its first child    |

A row's text holds the leading elements of its list, and its children hold the
rest. Inline parentheses, vectors, and maps work anywhere in a row's text.

The source view prints the outline line for line. Reading source back
keeps the same structure: the elements on a list's opening line become the
row's text, and the rest become children. Both directions keep the author's
layout, so switching views never reformats the program. Rows at the same
position keep their ids and folding when source is edited.

## Notation is a dial

The same outline renders two ways. **Outline** shows bullets and rows; it is
the friendlier reading for people who think in steps, not syntax.
**Brackets** turns each list row's bullet into `(` and paints its `)` after
the last row the list contains, so the outline reads as Lisp source. A folded
list shows `(section "Onboarding steps" …)`. The bracket that opens the row
with the caret and the one that closes it are highlighted. The brackets are
painted, not typed: they can never be unbalanced, and editing still happens
one row at a time.

Neither is the "real" program; the tree is. More notations fit the same
model: a plain-language reading for people who never see code, or
form-specific renderings, such as a workflow drawn as a diagram, while the
rest of the program stays as rows.

## What is live

- **Values.** The whole program is evaluated after every change. Each row
  records the last value or error of its expression. An error appears on the
  row that raised it. Top-level forms and the forms in a `section` are
  evaluated independently, so one failure does not hide the results after it.
- **Semantic highlighting.** Special forms, definitions, references to
  definitions, workflow steps, built-ins, and locals each get their own style.
  The highlighting comes from the same analysis as evaluation.
- **Hover and problems.** Resting the pointer on a token, or pressing
  Ctrl+Shift+Space, describes it: what it is, how to call it, its
  documentation, and the value it last had. Errors are underlined on the
  expression that raised them and warnings on the step they concern, and
  their messages lead the hover.
- **Completion.** Typing a name suggests the locals in scope, definitions,
  special forms, and built-ins, each with its usage; after `:` it suggests data
  keys and the step that writes them. Ctrl+Space asks at any point.
- **Slots.** Forms describe their parts, and a row offers the ones it is
  missing as placeholder rows: `+ body` under a function without one, `+ then`
  and `+ else` under an `if`, and `+ step` at the end of every flow. Typing
  into `+ step` suggests the steps and flows that fit there.
- **Effects.** `defstep` declares a step's system and the keys it reads and
  writes. `workflow`, `sequence`, `parallel`, and `branch` build a flow. A
  happens-before analysis warns when a step can run before the step that
  writes what it reads. `before?` asks the same question as a value, so checks
  sit in the program and stay true or false as it changes.
- **Inspector.** For the row with the caret, the inspector shows what the row
  is, its documentation, value, warnings, and the step's system and data. It
  also shows where the name is defined, which rows use it, and the row's
  Lisp. References jump to the row and reveal it.
- **Zoom.** Hoisting (⌘.) zooms into any form, and the level buttons fold the
  program to a depth. Sections read like chapters at level one and like code
  at level three.

## Structural edits, not patches

Refactorings act on rows, which are expressions:

- wrap the selection in `parallel`, `sequence`, or `do`
- unwrap, which splices a form's children into its parent
- raise a form over its parent
- join a form onto one line, or break its arguments onto rows
- extract a form into a function; its free locals become parameters
- rename a definition and every reference to it

Untouched rows keep their ids, so every change can be shown as a tree diff and
undone as one step.

The **Ask** panel turns a request about the selection into a proposal: a new
tree, a diff, and the consequences found by analyzing the proposed program. The
diff is `@foldworks/ui`'s `TreeDiff` inside a `ChangeSetPreview`; the `/agent`
demo shows the same diff in a permission checkpoint. It
is honest about what it is. It is a local intent matcher that understands a
handful of phrasings, labeled "Local · no model", and it never edits text.
Accepting a proposal applies it as one undoable step.

A model would fill the same contract. It would receive the selected rows, the
row with the caret, the Lisp for that region, and the analysis facts: values,
warnings, definitions, and steps. It would return a structural edit script,
such as wrap these ids, insert a step before that id, move, rename, or
extract, and never a line-range patch. The host would apply the script, re-run
the analysis, and show the diff and consequences before anything changes.
[`@foldworks/generative-ui`](../packages/generative-ui) already shows the
pattern for schema-decoded structured output through Effect's `LanguageModel`;
an edit-script schema would slot in the same way, and
[`@foldworks/agent`](../packages/agent)'s permission checkpoint is the natural
confirmation step.

## What moved into the outliner

The Lisp workbench needed four things from the outliner. Each is generic and
has a use outside Lisp:

- `decorations`: styled spans painted beneath the editable text, plus a row
  tone. Tags, mentions, dates, and validation could use them too.
- `rowAccessory`: trailing content per row, built in the host's boundary. It
  suits computed values, statuses, counts, and assignees.
- `Replace` and `Reveal`: undoable host edits that leave focus alone, and
  "go to this item".
- `spellcheck`, plus exports for the tree helpers the host needs.

## Limits

- The interpreter is a teaching-sized Clojure dialect, with no macros, tail
  calls, or laziness, and a step budget. It re-evaluates the whole program on
  every change, which is fine for hundreds of rows, not thousands.
- Evaluation is in-process and pure. Steps describe effects; they do not
  perform them.
- Ids follow position when source is edited, so inserting a form above others
  shifts which rows keep their folding.
- A commented-out subtree prints as comment lines and reads back flat.
- The assistant understands fixed phrasings only.
- Nothing is persisted.

## Next

1. **A model behind the contract.** Define the edit-script schema, generate
   it with structured output, and confirm it with a permission checkpoint.
   The local matcher becomes a fallback and a test fixture.
2. **Slots for user-defined forms.** Built-in forms describe their parts in a
   table today. Let `defn` and user-defined forms declare theirs, so their rows
   offer the same placeholders.
3. **Path queries that drive the view.** "Which paths reach `activate`
   without `:i9`?" could answer by expanding and selecting exactly those
   rows, using `Reveal` and row selection.
4. **Richer values.** Vectors of maps could show as a data grid, and nested
   values as a collapsible tree. That would also serve the structured-payload
   gap in [WorldVM developer tools](./worldvm-devtools.md#gaps).
5. **Diffs for every document.** Workflow and form documents are trees with
   stable ids too, so `TreeDiff` can review their changes the same way.
