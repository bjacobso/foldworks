# Foldkit upstream log

A running list of changes we think belong in
[Foldkit](https://github.com/foldkit/foldkit) rather than in Foldworks. Add an
entry when Foldworks carries a patch against Foldkit, relies on Foldkit
internals, or works around a missing public API. Nothing here has been filed
upstream unless the entry says so. When Foldkit ships a fix, record the version
and remove the local workaround.

Status values: **carried** (we ship a local patch or workaround), **proposed**
(written up, not filed), **filed** (link to the issue or PR), **landed**
(Foldkit version).

## `Attribute<Message>` type-check blow-up

- Status: **carried** as `patches/foldkit@0.156.0.patch` (bjacobso/foldworks#40).
  Not filed.
- Affects: every generic `view<Message>(config, h)` component and helper. In
  practice that is `@foldworks/ui`, and any package built the same way.

`foldkit/html` types `Attribute<Message>` as a 310-variant `Data.TaggedEnum`.
Only 65 of those variants mention `Message`, but each instantiation
`Attribute<M>` still creates 310 fresh member types. To infer a generic helper's
`Message` from `ReadonlyArray<Attribute<M> | ChildAttribute>`, TypeScript
compares the two unions member by member (`inferFromMatchingTypes` →
`isTypeIdenticalTo`). That is about 310² identity-cache entries per caller/helper
pair, and they are never reused.

The `| ChildAttribute` flattens the union, so the type-alias fast path never
applies. A variance annotation can't help either, because TypeScript rejects
`out` on a union alias (TS2637).

On foldkit@0.156.0, `@foldworks/ui` reached 15,955,484 identity entries against
V8's 16,777,216 `Map` limit. Adding a few components crashed TS 6 with
`RangeError: Map maximum size exceeded`. TS 7 with `--checkers 1` reported
thousands of `TS2859 Excessive complexity` errors, then ran out of memory.

Proposed change: keep the precise union as `AttributeVariant<Message>`, which
the renderer still switches on, and make the public `Attribute<Message>` one
covariant interface that every variant is assignable to:

```ts
export interface Attribute<out Message> {
  readonly _tag: AttributeTag;
  readonly key?: string;
  readonly value?: unknown;
  readonly text?: string;
  readonly name?: string;
  readonly message?: Message;
  readonly options?: ClickOptions;
  readonly f?: (
    ...args: never
  ) =>
    | Message
    | Option.Option<Message>
    | Option.Option<Readonly<{ focusSelector: string; message: Message }>>;
  readonly action?: MountAction<Message, any>;
}
```

Only the declaration file changes; the emitted JS is identical. The `h.*`
constructors keep their precise return types.

Measured on `@foldworks/ui` with the patch:

|                     |     before |   after |
| ------------------- | ---------: | ------: |
| TS 6 identity cache | 15,955,484 |   3,149 |
| TS 6 check time     |      122 s |   2.6 s |
| TS 6 memory         |    2.36 GB | 0.45 GB |
| TS 7 `--checkers 1` |       51 s |   0.7 s |

What the change keeps and what it gives up:

- Still rejected: wrong-universe handlers, `Attribute<B>` in an
  `HtmlBuilder<A>` element, and mismatched generic-helper inference.
- Still checked on hand-written literals: the tag, excess fields, and `Message`.
- Unchanged: covariance, including `Attribute<never>` and `inertHtml`.
- Looser: a hand-written literal's payload is no longer checked per variant, so
  `{ _tag: "Id", value: 5 }` compiles.
- Breaking: narrowing a public `Attribute` by `_tag` no longer exposes that
  variant's payload. Code that needs it can use `AttributeVariant`.

Neither of those last two patterns appears in Foldworks. With the change,
Foldkit's own 51 workspace projects still type-check and its tests still pass.

Alternatives we measured:

- **Split into static and message variants.** A non-generic `StaticAttribute`
  (245 variants) plus a generic `MessageAttribute<M>` (65) is strictly
  non-breaking. It only gets 6× (2.7M entries, 59 s).
- **Fully opaque, branded `Attribute`.** Same speed as the proposal and
  stricter, but it breaks the two hand-written literals described in the next
  two entries. It also changes every constructor's return type. Revisit it once
  those two entries land.

Reproduction: `node scripts/attribute-repro.mjs <enum|split|structural|opaque|explicit>`.

When Foldkit ships an equivalent fix, delete the patch and the
`patchedDependencies` entry in `pnpm-workspace.yaml`.

## Public constructor for DOM properties (`h.Prop`)

- Status: **proposed**.
- Affects: `packages/code-editor/src/native/view.ts`, where the textarea
  carries `{ _tag: "Prop", key: "foldkitNative", value: model }`.

The native code editor needs a per-render channel from the view to its mounted
element. Every patch writes `input.foldkitNative = model`, and a setter that the
mount installs reconciles the textarea. Foldkit has a `Prop` attribute variant
internally: `html/index.ts` exports its constructor, and `foldkit/customElement`
uses it for property factories. But `h` has no public constructor for it, so we
hand-write the variant's internal shape.

Mount args are not a substitute. They are fixed when the element mounts, and
the textarea is not a custom element.

Ask: expose `h.Prop(key, value)`, or document an equivalent per-render property
channel for plain elements.

## Public custom-event listener on plain elements

- Status: **proposed**.
- Affects: `packages/editor/src/browser.ts` (`contentView`), where the editor host
  carries `{ _tag: "OnCustomEvent", name, f: (event) => event.detail }`.

The editor surface reduces each native edit locally, then re-dispatches the
Message as a DOM `CustomEvent` on the host. Foldkit's `OnCustomEvent` handler
dispatches it synchronously inside the listener, and `Surface.send` relies on
that. A Mount stream is not a drop-in replacement, because it delivers through a
queue and a fiber.

`foldkit/customElement` generates `On…` factories only for elements registered
through its `define` API, not for a plain `div`.

This literal already breaks on upstream `main`. Foldkit #913 changed the
variant to `f: (event: CustomEvent<unknown>) => Option<Message>`, with the detail
decoded against a Schema, so the next Foldkit upgrade must touch this code
anyway.

Ask: a public `h.OnCustomEvent(name, detailSchema, toMessage)` (or similar) for
plain elements, with synchronous dispatch.
