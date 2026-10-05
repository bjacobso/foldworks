# Generated Foldworks documentation

Run `pnpm dev`, then open `/docs`. The website is part of the demo application
and its normal production build/deployment. Package and module links use
`/docs?package=sidebar&module=model` and support browser history and direct loads.

The site uses Foldworks Sidebar, Badge, Button, CodeBlock, Input, Select, and
Icon components, plus Foldworks Diagram documents, layout, and edge routing.
README content renders through `@foldkit/markdown`. Existing themes apply to
the entire site.

## Automatic reference

`generate.ts` discovers public `@foldworks/*` packages from `packages/`, reads
their export maps, and follows local re-exports (including namespace barrels).
Each reachable source module gets a page with exported declarations, JSDoc,
source lines, imports, and inline Model, Message, and OutMessage records.
Package pages include version, entrypoints, dependencies, and the existing
README. New exports and README edits require no second documentation registry.
The development plugin watches package sources and regenerates the catalog.
The same catalog is emitted as `/docs/manifest.json` in production.

The parser documents source declarations; it does not resolve inferred types
or expand third-party re-exports. Schema aliases and nonliteral schemas remain
visible as declarations instead of being expanded into field tables. The
`typescript-api` dependency pins the classic TypeScript compiler API separately
from the workspace's TypeScript 7 compiler.

## Reducer explorers

`src/docs/explorer.ts` has a generic `exploreReducer` adapter and two examples:
Sidebar and EditableText. An adapter supplies initialization, a named finite
state projection, concrete event samples, and the real reducer. Breadth-first
exploration generates the state graph by calling that reducer. Sending messages
replays it and displays the current model, emitted commands, outgoing messages,
and a trace. Commands are counted but never executed. A table includes every
sampled transition, including events that leave the projection unchanged.

To document another interaction, add an adapter to `explorers`. Choose a bounded
projection and representative payloads, and explain its assumptions in the
adapter description. The explorer rejects projections with more than 32 states.
Payload samples and projections are explicit: the graph is a view of that
scenario, not proof that arbitrary reducer states have been exhausted. Complex
reducers, policies, asynchronous commands, and unbounded documents need an
adapter rather than speculative transitions extracted from implementation text.

## Validation

`pnpm --filter @foldworks/demo test` covers source extraction, discovery,
re-export cycles, README serialization, real reducer transitions, validation,
outgoing messages, the state bound, and docs routing. Docs browser scenarios
live in `e2e/docs.scenarios.ts` and run with the existing demo interaction suite.
