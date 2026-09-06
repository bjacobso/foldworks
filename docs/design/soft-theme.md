# Soft theme exploration

Reference: [Beautiful UI](https://www.beautifului.dev/) and the seven supplied
screenshots of recommendations, context cards, records, filters, navigation,
workflow nodes, and insights.

## Direction

The strongest common feature is surface hierarchy: a cool gray workspace,
white content, pale inset regions, and soft elevation. Dark gray type does
most of the work; blue marks actions and selection, while pastel chips carry
status. Corners are generous on cards and compact on tags. Navigation recedes
so the content feels like the focus of the workspace.

Foldworks already separates semantic tokens from feature behavior. An opt-in
Soft theme makes this direction reviewable on the real UI kit and reference
applications before choosing whether to change the default.

## First pass

- Cool gray canvas, white cards, muted navigation, and darker gray body text.
- Larger shared radii, pill buttons, and rounded rectangular status badges.
- Layered card and panel shadows, plus white outlined actions.
- Blue actions and selection; green, amber, cyan, and red semantic statuses.
- Matching dark appearance and persistent selection through the existing theme menu.

The reference's light status text is interpreted with darker foregrounds for
readability at Foldworks' compact text sizes. The theme keeps the existing
font stack and component density. No external fonts or raster assets are needed.

## Review

Run `pnpm dev`, open `/ui-kit`, and choose **Soft** and **Light** in the toolbar.
Switch between Neutral and Soft to compare the same content. Check cards,
buttons, badges, forms, and focus indicators, then try Dark. Visit `/workbench`,
`/data-grid`, `/query-builder`, and `/workflow` to judge the theme in denser views.

## Next design decisions

1. **Density:** try 14–15px body text and 40px controls in conversational and
   review surfaces. Keep table and editor density independently configurable.
2. **Navigation:** evaluate sentence-case group labels, slightly larger links,
   and more spacing between groups.
3. **Tables:** evaluate white headers, lighter dividers, and 40–44px rows with
   compact category chips. Embedded tables need their own surface treatment.
4. **Workflow:** explore rounded node shells, pastel type markers, and more
   breathing room around conditions. Node geometry must be measured alongside
   layout and drag targets; a global radius change cannot cover this reliably.
5. **Compositions:** use the existing operational components for recommendation
   and evidence cards; evaluate spacing and source chips against the screenshots.

These are follow-up directions, not implemented changes in this first pass.
