# Animation in Foldworks

Foldworks uses Foldkit's animation model for enter and leave timing. The styled
`Stateful.Animation` adapter adds reusable fade, slide, and collapse views. It
uses the package's duration and easing tokens and stops movement when the user
prefers reduced motion.

| Effect                                            | Use                                                      |
| ------------------------------------------------- | -------------------------------------------------------- |
| `fade`                                            | Feedback or small floating content                       |
| `collapse`                                        | Conditional form sections or details with unknown height |
| `slideUp`, `slideDown`, `slideLeft`, `slideRight` | Panels entering from an edge; each also fades            |

The effect names describe the direction of travel _into_ view. `collapse` uses
`grid-template-rows: 0fr → 1fr`, so content can grow to its natural height
without a measured pixel value. Collapsed content remains mounted but is inert
and hidden from accessibility APIs. Other effects unmount after the leave
transition settles. Keep the submodel itself mounted while hidden.

## Conditional field

Add `Stateful.Animation.Model` to the parent model:

```ts
followUp: Stateful.Animation.init({ id: "follow-up-field" }),
```

Forward `Stateful.Animation.Message` with `Update.foldChild`, using
`Stateful.Animation.update`. The styled update starts the standard leave wait
automatically; its only out message is `TransitionedOut` after removal. When a
previous answer changes, send `Message.Showed()` or `Message.Hid()` through the
same parent message route. Then render the child:

```ts
h.submodel({
  slotId: model.followUp.id,
  model: model.followUp,
  view: Stateful.Animation.view,
  viewInputs: {
    effect: "collapse",
    content: h.div(
      [],
      [
        Field.view(
          {
            id: "explanation",
            label: "Please explain",
            children: [
              Input.view(
                {
                  id: "explanation",
                  value: model.explanation,
                  onInput: (value) => Message.ChangedExplanation({ value }),
                },
                h,
              ),
            ],
          },
          h,
        ),
      ],
    ),
  },
  toParentMessage: (message) => Message.GotFollowUpMessage({ message }),
});
```

The field value, validation, and whether to clear it on hide belong to the
parent form. If using native form submission, disable the hidden control so
its value is not submitted while collapsed.

## Overlays

`Stateful.Dialog`, `Sheet`, `Drawer`, and `AlertDialog` retain Foldkit's modal
focus, Escape, scroll lock, and close lifecycle. With `isAnimated: true`, the
backdrop fades and the panel fades and slides according to its placement.
Use those components for modal behavior instead of composing a modal from
`Animation.view`. A standalone `Animation.view` has no focus trap or modal
semantics.

## Why these primitives

The React ecosystem provides useful design precedents:

- [Motion for React](https://motion.dev/docs/react-animate-presence) keeps
  removed nodes mounted through exit and can [animate intrinsic height](https://motion.dev/docs/react-animation).
- [React Spring](https://www.react-spring.dev/docs/utilities/use-resize) is useful
  when spring physics or live element measurements drive an interaction.
- [React Transition Group](https://reactcommunity.org/react-transition-group/transition-group/)
  separates mount lifecycle from the CSS or JavaScript animation itself.
- [React Aria](https://react-spectrum.adobe.com/react-aria/Modal.html) keeps
  overlays present until their exit CSS completes while preserving modal
  behavior.
- [Radix Primitives](https://www.radix-ui.com/primitives/docs/guides/animation)
  exposes open and closed state for CSS or JavaScript animation.

Foldworks is a Foldkit package, so adding a React animation dependency would
duplicate its rendering and lifecycle systems. The useful shared contract is
presence, an exit completion signal, effect recipes, and reduced-motion rules.
The [CSS `interpolate-size` option](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size)
is still unavailable in some major browsers, so collapse uses the grid method.

The current scope is discrete enter and leave transitions. Drag gestures,
springs, shared-element transitions, and animated list reordering need separate
interaction and layout APIs when real product views require them.
