# Mobile inputs

A candidate application form built to feel native on a phone, and a benchmark
that compares it with the same form written in React. The demo lives at
`/mobile-form`. A standalone build of only the form is at `/apply.html`.

## What the form does

The form has five steps: about you, address, availability, a few more
questions, and phone verification. It uses stateless controls from `apps/demo/src/mobile-form/inputs.ts`. Each
control is a single view function that takes callbacks for its Messages, so a
parent adds a field with one call and owns the value. Only the state picker
uses a Submodel, which wraps the headless Foldkit Dialog.

| Concern            | Behavior                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Zoom and targets   | Inputs use 17px text, so iOS Safari never zooms on focus. Controls are at least 52px tall and chips at least 44px. Taps give press feedback through `:active` on touch devices only.                                                                                                                         |
| Keyboards          | Each field sets `inputmode`, `type`, `autocapitalize`, and `spellcheck` to suit its content. Email turns off autocorrect, and numeric fields open the keypad.                                                                                                                                                |
| Enter key          | `enterkeyhint="next"` moves focus synchronously inside the key event, so the iOS keyboard stays open. The last field of a step shows "done" and submits through the form.                                                                                                                                    |
| Autofill           | Every field has an `autocomplete` token. The state sheet keeps a hidden, focusable `<select autocomplete="address-level1">`, so one tap of browser autofill fills the whole address.                                                                                                                         |
| Masks              | Phone, date of birth, ZIP, and the code are formatted as you type. A capture-phase Mount reformats the value before Foldkit reads it and keeps the caret after the same digit. Deleting a separator deletes the digit before it. Autofilled values such as `+1 (555) 123-4567` and ZIP+4 are normalized.     |
| One-time code      | A single real input with `autocomplete="one-time-code"` is drawn as six cells, so SMS autofill and paste work. A complete code submits itself.                                                                                                                                                               |
| Validation         | Errors appear after a field is left, then update while typing until the field is valid. Continue reveals every error on the step, focuses the first one, and announces how many fields need attention.                                                                                                       |
| Keyboard overlap   | The action bar is sticky and offset by `--keyboard-inset`, which comes from `visualViewport`, so it stays above the keyboard in Safari. The standalone page sets `interactive-widget=resizes-content` for Chrome on Android, and `viewport-fit=cover` with safe-area padding.                                |
| Drafts             | The draft is saved to `localStorage` whenever a field is left, the step changes, or a discrete choice is made. Switching to Messages to read the code blurs the field, so nothing typed is lost.                                                                                                             |
| Choices            | Employment type uses native radios styled as cards. Shifts are checkbox chips, and the alerts toggle is a checkbox with Safari's `switch` attribute. Hours use a stepper with 56px buttons that counts every rapid tap.                                                                                      |
| Conditional fields | `yesNo` draws a required question as two native radios styled as large buttons. `reveal` shows the follow-up fields beneath it. Reveals nest: a license reveals the CDL question, which reveals the CDL class. Follow-ups are indented under a rule so each branch reads as one group.                       |
| Reveal animation   | Pure CSS: `grid-template-rows` goes from `0fr` to `1fr` with a fade and a small slide, over 260ms, both opening and closing. The Model stores only the answer, and there is no animation state. Collapsed content stays mounted but is `inert` and `aria-hidden`. With reduced motion the change is instant. |
| Hidden answers     | `isShown` in `validation.ts` decides which fields exist. Hidden fields keep their values, so answering "Yes" again restores them, but they are never validated or required.                                                                                                                                  |
| State picker       | A bottom sheet with a grab handle and a fixed height, so it does not jump while you filter. Search is focused on open and matches by name, word prefix, or postal code. Enter picks the first match, and focus returns to the trigger.                                                                       |

## Benchmark

`apps/demo/bench/mobile-form.mjs` runs one scripted application against any
build that uses the same element ids and button text. It types every field,
uses the state sheet, taps the step-three controls, answers "Yes" to every
conditional question (so each follow-up animates open), and enters the code. For
comparison, a React 19 version of the same form was written from the same spec.
Its `react-effect` variant decodes each step with Effect Schema, which is
closer to a production React and Effect stack. The React baselines are not
checked in.

Method: Chrome emulates a Pixel 7 with a 4x CPU slowdown, the Lighthouse mobile
default. The first load uses Slow 4G (150ms RTT, 1.6 Mbps). Files are served
with Brotli. Each target runs five times, and the table shows medians or pooled
percentiles. "Key → paint" and "Tap → paint" run from the event's timestamp to
the frame after it is painted. INP is the slowest interaction measured with the
Event Timing API, grouped by `interactionId`.

| Target       | Transfer | FCP     | Form ready | Key → paint p50 / p95 / max | Tap → paint p50 / p95 | INP    | Interactions ≥ 50ms | Script time | JS heap |
| ------------ | -------- | ------- | ---------- | --------------------------- | --------------------- | ------ | ------------------- | ----------- | ------- |
| foldkit      | 107.0 KB | 1136 ms | 1069 ms    | 10.1 / 20.9 / 29.9 ms       | 37.6 / 76.5 ms        | 80 ms  | 5                   | 658 ms      | 8.1 MB  |
| react        | 59.3 KB  | 780 ms  | 729 ms     | 8.0 / 14.9 / 19.9 ms        | 33.4 / 49.0 ms        | 272 ms | 5                   | 449 ms      | 5.2 MB  |
| react-effect | 80.2 KB  | 940 ms  | 889 ms     | 8.9 / 16.3 / 23.0 ms        | 33.2 / 52.2 ms        | 272 ms | 7                   | 560 ms      | 6.5 MB  |

Results from one sandbox run on 2026-10-20 (Chrome, Linux x86_64). Absolute
numbers depend on the host. Compare the targets with each other, not with field
data.

React's 272ms INP comes from a single kind of interaction: the first keystrokes
typed into a field that was just revealed on the conditional step. Those
keydowns spend almost no time in handlers, and no long animation frame is
recorded. The browser is late to present the next frame. The stall disappears
when the field is scrolled to the center and left to settle before typing, so
it depends on layout and scroll position, not on React. Without it, React's
slowest interaction is about 56ms and Foldkit's is about 80ms, the same as a
four-step run without conditional fields.

### Bundle

Minified JavaScript for each production build:

| Build                             | Raw    | Gzip   |
| --------------------------------- | ------ | ------ |
| Foldkit + Effect, standalone form | 370 KB | 119 KB |
| React 19, plain validation        | 218 KB | 68 KB  |
| React 19 + Effect Schema          | 292 KB | 92 KB  |

Raw contents of the Foldkit bundle: `foldkit` 145 KB, `effect` 140 KB, the
headless Dialog from `@foldkit/ui` 13 KB, and the form itself about 50 KB.
Within `foldkit`, the `h` builder is 44 KB and cannot be tree-shaken, and
hydration and the crash UI add about 20 KB. Neither is used by this form.

Importing from the `@foldworks/ui` barrel more than doubled the bundle to
217 KB gzip, because its top-level Schema and Message definitions keep all of
`@foldkit/ui` alive. The form imports `@foldworks/ui/icon` and
`@foldkit/ui/dialog` directly instead.

### Reading the results

- Typing is fast in every build. Each Foldkit keystroke costs about 2ms of View
  and 1ms of Patch at a 4x slowdown, and key-to-paint stays within about one
  frame. In the browser, the live timings panel on `/mobile-form` shows the
  same phases for the whole demo application.
- React is faster on taps that change a lot of DOM: step changes and opening
  the state sheet. Revealing conditional fields is not one of the slow taps in
  either build, because the animation is a CSS transition. Foldkit handles the event in about 5ms. Most of the time
  then goes to the frame that renders the new step or sheet and to the Dialog's
  modal setup. All builds stay well under the 200ms "good" INP threshold.
- Foldkit with Effect is about 26 KB gzip heavier than React with Effect
  Schema, and about 50 KB heavier than React alone. Dropping React does not
  reduce the payload unless the Foldkit runtime becomes tree-shakeable.

## Running it

```sh
pnpm --filter @foldworks/demo bench:mobile-form
# Compare other builds that implement the same ids and button text:
node apps/demo/bench/mobile-form.mjs --runs 5 --cpu 4 \
  foldkit=apps/demo/.bench/foldkit/apply.html \
  react=path/to/react-build/index.html
```

## Limits

- The verification code and submission are simulated. Any six digits pass.
- The state sheet cannot be dragged to dismiss. Use the backdrop, Escape, or a
  selection.
- Masks are US-only: phone numbers are national, and dates are MM/DD/YYYY.
- `--keyboard-inset` depends on `visualViewport`, and the benchmark does not
  emulate an on-screen keyboard. Check keyboard overlap on real devices.
