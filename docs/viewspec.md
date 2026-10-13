# ViewSpec in Foldworks

This carries forward a selective slice of the Open Ontology ViewSpec exploration
using `@foldworks/generative-ui`. It is not a compatibility implementation of the
legacy protocol. The source reference is
[open-ontology-legacy at 7c2ff8a](https://github.com/bjacobso/open-ontology-legacy/tree/7c2ff8a614b9f06a6e530aa80d0c7311dc81a323),
inspected from the sibling checkout at that exact commit without changing it.

The inspection covered `specs/compiler/ui/viewspec.md`, the `view-protocol`
implementation and structural/conformance tests, `preludes/ui.lisp`,
`viewspec.lisp`, `viewspec-protocol.lisp`, `viewspec-compiler.lisp`, the web
`ViewRenderer.tsx`, `component-registry.ts`, `view-expressions.ts`, and the
hardcoded `routes/viewspec.tsx` playground. The playground is the feature
inventory, not evidence that every legacy feature was safe, portable, or
complete. In particular, its renderer combines generic presentation with
ontology reads, domain commands, and asynchronous action chains.

## Feature and ownership map

| Legacy feature                                                                         | Decision                                  | Foldworks / host boundary                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reusable JSON UI documents                                                             | Adopt existing Foldworks contract         | Keep the version-1 flat keyed graph, static props, and child references. No second envelope or nested legacy node union.                                                                                                     |
| Component catalog and validation                                                       | Adopt and extend                          | Effect Schema remains the source for component props, actions, generation, and decoding. Keep strict excess-property, graph, event, and budget checks. Do not port legacy normalization that silently repairs invalid input. |
| React/Tailwind registry and theme/style props                                          | Adapt                                     | Allowlisted Foldkit views backed by Foldworks/StyleX primitives and semantic themes. Host code can define a catalog/registry; documents cannot register code or set arbitrary styles.                                        |
| Local inputs and interaction                                                           | Adapt; first slice implemented            | Controlled `TextInput` emits `{ value }` event data. Foldkit host models store drafts and rebuild concrete documents. Typed intent decoding is generic Foldworks functionality.                                              |
| Input, row, item, index, state scopes; pipes and operators                             | Defer                                     | A future bounded binding design belongs in Foldworks. For now, pure host presentation adapters filter data, format values, and materialize rows. No expression evaluator or property-path mutation.                          |
| `for-each`, conditions, empty/loading states                                           | Adapt partly; defer protocol control flow | Hosts compose concrete graphs and existing Alert/Badge/Text primitives. This demo exercises filtering and empty results. Dynamic loops and conditions are not document semantics.                                            |
| `defs/use`, runtime slots, nested views                                                | Defer reusable document API               | Existing graph composition and host functions suffice for this slice. Parameterized fragments, instance IDs, scope isolation, host view resolution, and runtime replacement need a separate design.                          |
| Form widgets, tabs, dialogs, popovers, charts, trees, interactive tables               | Defer catalog coverage                    | Foldworks already has many underlying primitives. They need deliberate schema/event/state adapters; their availability as primitives does not imply support in generative-ui.                                                |
| `setState` / `patchState`, navigation, toast, submit                                   | Adapt to typed host messages              | No action lists, lifecycle handlers, callback chains, or general workflow executor. Hosts handle local reducers, navigation, feedback, and commands.                                                                         |
| `fetch`, tool calls, query dependencies, refresh, `onSuccess/onError/onFinally`        | Leave execution with host                 | Transport, scheduling, errors, authorization, and domain execution stay outside the renderer. Future UI loading/error props can be generic.                                                                                  |
| Entity browser/picker/forms, query console, entity/action refs, namespace-backed views | Leave in WorldVM                          | WorldVM owns view definitions, entity/query adapters, authorized reads, domain policies, and command dispatch. Foldworks receives presentation data and emits inert requests.                                                |
| Raw HTML/CSS/JS                                                                        | Omit from this contract                   | No renderer escape hatch for document-supplied executable content. Trusted custom views belong in the host registry.                                                                                                         |
| Lisp compiler hooks and generated protocol                                             | Defer authoring adapters                  | A future Forma lowering adapter may target the Foldworks catalog. It must produce validated documents and preserve host boundaries; it is not required to render this slice.                                                 |
| Shareable fixture playground                                                           | Adopt                                     | `/viewspec` opens directly with deterministic local fixtures, no ontology preload or runtime connection. Draft edits are local to the session, not encoded into the URL.                                                     |

This follows [the WorldVM developer-tools boundary](./worldvm-devtools.md):
generic UI documents, catalogs, validation, interaction primitives, composition,
and rendering belong in Foldworks. World-specific view definitions and adapters
belong in WorldVM. Neither the package nor the demo imports WorldVM, Triplex, or
the legacy runtime.

## Implemented interaction

Run `pnpm dev` and open `/viewspec` (also linked from the sidebar and generative-ui
package card). Filter crew by name or role, select a person, enter an assignment
note, and request an assignment. The local fixture host accepts an available
person and refuses Marvin, who is off duty. Changing records clears the draft;
empty results do not discard the selected record. Reset restores the fixtures.

The document is a normal generative-ui spec. A presentation function composes
fixture rows and model values into concrete elements and action params. The
view validates it before rendering. Text changes carry user data separately
from the binding's static params; the host decodes each intent into a
schema-derived action union. The request button is disabled for an empty note,
and the host independently checks availability and that the request matches
the current draft. The displayed receipt and JSON expose the application
boundary. This is a local fixture demonstration, not a production integration.

The package README documents the event-data API, compatibility, and limits.
Tests cover strict field/binding/intent validation, typed payloads, controlled
input updates, disabled/unbound fields, complete-spec MCP decoding, filtered
and empty graphs, host refusal, and reset. Browser scenarios exercise the
complete interaction and keyboard navigation on a narrow dark viewport.

## Mock prompt generation

The same `/viewspec` route now accepts a user prompt and a response cassette.
Click **Generate mock UI** to see loading, validation, and the resulting UI.
The prompt goes through the package's actual `generate(catalog, { prompt })`
function. A local Effect `LanguageModel` service supplies a fixed text response;
Effect's structured output decoder applies the catalog schema, and
`validateSpec` checks the graph before the result replaces the generated UI.
No provider credentials or network connection are needed.

These are authored mock responses, not recordings from a real model. The chosen
cassette determines the output; changing the prompt does not change that fixed
response. The UI shows the submitted prompt and the cassette that produced the
last successful document. Changing cassettes also loads an example prompt.

| Cassette          | Behavior                                                        |
| ----------------- | --------------------------------------------------------------- |
| Crew cards        | A card grid; buttons select records in the fixture host.        |
| Mission brief     | A summary, table, and assignment request the host accepts.      |
| Off-duty request  | A valid UI whose request the host refuses.                      |
| Invalid component | Catalog schema decoding fails.                                  |
| Broken reference  | Schema decoding succeeds; graph validation fails.               |
| Malformed JSON    | Structured output decoding fails.                               |
| Provider error    | A simulated provider failure; choose another cassette to retry. |

Add or edit cassettes in `apps/demo/src/viewspec/cassettes.ts`: each entry has a
label, description, example prompt, and raw response text or simulated error.
The mock provider adapter lives in `generation.ts`. The generated documents use
concrete props and static button params; controlled drafts remain in the fixture
host. Generated buttons emit typed intents, and the host checks the current
document binding and its own availability policy before accepting a request.

Failed generation preserves the last valid document. Request IDs prevent
obsolete responses from replacing it after cassette changes or reset. Unit
tests cover the real generation API with the mock service, every cassette,
failed-output preservation, stale completions, and generated-action policy.
Browser tests exercise prompting, cassette switching, generated interactions,
failure/retry, and reset alongside the original fixture interactions.

## Remaining gaps

There is no document-declared state, persistence, field-level error model,
submit grouping, number/select/checkbox adapters, binding language, repeat
scope, reusable fragment API, or host view-loader contract. The current demo
materializes complete graphs on every edit; it does not add patching or
streaming. There is no live AI provider, real MCP host draft round trip, remote
query, or Forma compiler. Mock prompt generation exercises the API boundary;
it does not evaluate model quality or demonstrate prompt-dependent output.

Intent validation checks action params and event-data shape, not element/event
identity, authorization, freshness, or execution. Component event payloads and
action data schemas are checked when an intent is received, not statically
matched during document validation. Existing graph/string budgets remain;
large event payloads, shared-graph expansion, and streaming will need further
resource budgeting. The browser coverage is a first accessibility check, not a
full assistive-technology audit.

The next coherent extension should be chosen from an actual adapter use case:
more controlled fields, or bounded document-local bindings and fragment
composition. Keep effectful operations as host commands and use Effect Schema
at every new boundary. Avoid importing the legacy action execution language.
