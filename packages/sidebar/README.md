# `@foldworks/sidebar`

Composable application navigation for Foldkit and StyleX.

The package provides controlled expanded, icon-collapsed, off-canvas, and
mobile drawer states; grouped and nested navigation; header, content, and
footer regions; active items and badges; a resize-style rail trigger; and an
inset application shell. It uses the shadcn-compatible sidebar variables from
`@foldworks/ui`.

```ts
import { Sidebar } from "@foldworks/sidebar";

const model = Sidebar.init({ id: "application-sidebar" });

Sidebar.view({
  model,
  toParentMessage: (message) => AppMessage.GotSidebarMessage({ message }),
  brand: {
    title: "Acme",
    description: "Operations",
    href: "/",
    icon: Blocks,
  },
  groups: [{
    id: "workspace",
    label: "Workspace",
    items: [{ id: "home", label: "Home", href: "/", icon: House }],
  }],
  header: applicationHeader,
  content: applicationContent,
}, h);
```
