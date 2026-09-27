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

Sidebar.view(
  {
    model,
    toParentMessage: (message) => AppMessage.GotSidebarMessage({ message }),
    brand: {
      title: "Acme",
      description: "Operations",
      href: "/",
      icon: Blocks,
    },
    groups: [
      {
        id: "workspace",
        label: "Workspace",
        items: [{ id: "home", label: "Home", href: "/", icon: House }],
      },
    ],
    header: applicationHeader,
    content: applicationContent,
  },
  h,
);
```

Items and sub-items accept an `href`, an `onClick` message, or both, so
applications without a router can navigate with messages. Either kind of
activation also closes the mobile drawer. `count` adds a trailing number (hidden
while the sidebar is icon-collapsed), and `countLabel` replaces it for
assistive technology:

```ts
Sidebar.view(
  {
    model,
    toParentMessage: (message) => AppMessage.GotSidebarMessage({ message }),
    brand,
    groups: [
      {
        id: "pages",
        label: "Pages",
        items: pages.map((page) => ({
          id: page.id,
          label: page.title,
          icon: FileText,
          onClick: AppMessage.SelectedPage({ pageId: page.id }),
          isActive: page.id === model.pageId,
          count: page.hiddenFieldCount,
          countLabel: `${page.hiddenFieldCount} hidden fields`,
        })),
      },
    ],
    header: applicationHeader,
    content: applicationContent,
  },
  h,
);
```
