# @foldworks/keyboard

## 0.3.0

### Minor Changes

- 7b60eb4: Require the tested Effect 4.1.1 and Foldkit 0.170.0 shared runtime peers,
  including @foldkit/ui 0.170.0. Remove the previous Effect peer exceptions.
- cec341d: Require the tested Effect 4.0.3 and Foldkit 0.168.0 shared runtime peers.
  Migrate renamed Foldkit APIs, textarea values, custom-event messages, and Effect
  AI imports. Update the re-exported headless UI APIs to @foldkit/ui 0.168.0.
  Preserve description linkage and supply the calendar format data required by
  the new headless APIs.

## 0.2.0

### Minor Changes

- 61cf008: Add typed scoped keyboard commands and shared trigger metadata, reusable box
  measurement and overflow composition, controlled inline editing, token entry,
  panel stacks, nested/context menus, stateful modal variants, and a styled
  single-date picker with typed date input. Reuse Foldkit lifecycle and selection
  engines, retain host-owned data/actions, and document integration boundaries.

### Patch Changes

- 05217a5: Allow applications to supply compatible Effect, Foldkit, and StyleX versions
  through peer dependencies while keeping exact workspace build versions.
