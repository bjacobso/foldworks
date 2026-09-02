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
