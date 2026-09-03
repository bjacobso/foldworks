# Foldkit form builder

Section-first form document and drag-and-drop primitives for Foldkit applications.

Documents contain an ordered list of sections. Each section references an actor
and owns pages, while pages own application-defined fields. This permits journeys
such as Employee → Authorized representative → Employer or Employee → Employer
→ Employee without grouping content under actors.

The package provides immutable insert, move, update, and delete operations;
stable typed drop locations; a field-type registry contract; and a Foldkit UI
drag-and-drop facade. Applications own their document schema, registered field
renderers, editor presentation, persisted answers, and activity events.

`paletteItemId` and `paletteTypeFromId` own palette identifiers. Pass a
`FormBuilder.OutMessage.Reordered` to `applyReorder` with the document
operations and an application-owned `createFromPalette` callback to turn a
drop into an immutable document update. `FormBuilder.init` defaults to a
vertical interaction, an 8px activation threshold, and the exported
`FormBuilder.DEFAULT_ID`; each option can be overridden.
