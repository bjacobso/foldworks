import type { LucideIconData } from "@lucide/icons";
import {
  ArrowRight,
  Blocks,
  Bot,
  Braces,
  CheckCircle2,
  FileText,
  History,
  Layers3,
  ListChecks,
  ListFilter,
  PanelLeft,
  Table2,
  Workflow,
} from "@lucide/icons";
import { Avatar, Badge, Card, Chart, Icon, Progress } from "@foldworks/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import {
  agentRouter,
  codeEditorRouter,
  dataGridRouter,
  formBuilderPath,
  pdfAnnotatorRouter,
  queryBuilderRouter,
  uiKitRouter,
  workbenchRouter,
  workflowPath,
} from "../app/route";
import { className, styles } from "./styles";

type Package = Readonly<{
  name: string;
  category: "Foundation" | "Application primitive";
  description: string;
  href: string;
  icon: LucideIconData;
}>;

const packages: ReadonlyArray<Package> = [
  {
    name: "@foldworks/ui",
    category: "Foundation",
    description: "Themeable, accessible interface components for product surfaces.",
    href: uiKitRouter(),
    icon: Blocks,
  },
  {
    name: "@foldworks/sidebar",
    category: "Foundation",
    description: "Responsive application chrome with controlled navigation state.",
    href: "/",
    icon: PanelLeft,
  },
  {
    name: "@foldworks/agent",
    category: "Application primitive",
    description: "Streaming conversations, tool states, approvals, cancellation, and retry.",
    href: agentRouter(),
    icon: Bot,
  },
  {
    name: "@foldworks/code-editor",
    category: "Application primitive",
    description: "Code editing, syntax highlighting, and live diagnostics in a versioned document.",
    href: codeEditorRouter(),
    icon: Braces,
  },
  {
    name: "@foldworks/data-grid",
    category: "Application primitive",
    description: "Sorting, selection, virtualization, and keyboard navigation.",
    href: dataGridRouter(),
    icon: Table2,
  },
  {
    name: "@foldworks/query-builder",
    category: "Application primitive",
    description: "Recursive conditions with validation and structured drag and drop.",
    href: queryBuilderRouter(),
    icon: ListFilter,
  },
  {
    name: "@foldworks/form-builder",
    category: "Application primitive",
    description: "Multi-page, multi-actor forms with editable and runnable modes.",
    href: formBuilderPath("Handoff", "Editor"),
    icon: ListChecks,
  },
  {
    name: "@foldworks/workflow",
    category: "Application primitive",
    description: "Structured workflows with branches, layout, history, and inspectors.",
    href: workflowPath("Vertical"),
    icon: Workflow,
  },
  {
    name: "@foldworks/pdf-annotator",
    category: "Application primitive",
    description: "Place, resize, remove, and export annotations on real PDF documents.",
    href: pdfAnnotatorRouter(),
    icon: FileText,
  },
  {
    name: "@foldworks/history",
    category: "Foundation",
    description: "Reusable undo, redo, and bounded document history for controlled models.",
    href: workflowPath("Vertical"),
    icon: History,
  },
];

const link = <Message>(
  label: string,
  href: string,
  kind: "primary" | "secondary",
  h: HtmlBuilder<Message>,
): Html => h.a([
  h.Class(className(kind === "primary" ? styles.primaryLink : styles.secondaryLink)),
  h.Href(href),
], [label, Icon.view({ icon: ArrowRight, size: 15 }, h)]);

const person = <Message>(
  name: string,
  role: string,
  fallback: string,
  status: string,
  h: HtmlBuilder<Message>,
): Html => h.div([h.Class(className(styles.teamRow))], [
  Avatar.view({ alt: name, fallback, size: "sm" }, h),
  h.div([h.Class(className(styles.teamCopy))], [
    h.span([h.Class(className(styles.teamName))], [name]),
    h.span([h.Class(className(styles.teamRole))], [role]),
  ]),
  Badge.view({ label: status, tone: status === "Ready" ? "success" : "neutral", dot: true }, h),
]);

const componentPreview = <Message>(h: HtmlBuilder<Message>): Html =>
  h.div([h.Class(className(styles.preview))], [
    h.div([h.Class(className(styles.previewHeader))], [
      h.span([h.Class(className(styles.previewTitle))], ["Release overview"]),
      Badge.view({ label: "Live components", tone: "info", dot: true }, h),
    ]),
    h.div([h.Class(className(styles.previewGrid))], [
      Card.view({
        title: "Launch readiness",
        description: "Across product, legal, and operations",
        style: styles.previewCard,
        children: [
          h.div([h.Class(className(styles.metric))], ["82%"]),
          Progress.view({ value: 82, ariaLabel: "Launch readiness" }, h),
          h.div([h.Class(className(styles.metricMeta))], [
            h.span([], ["14 of 17 checks"]),
            h.span([], ["On track"]),
          ]),
        ],
      }, h),
      Card.view({
        title: "Owners",
        description: "Current handoff",
        style: styles.previewCard,
        children: [h.div([h.Class(className(styles.teamList))], [
          person("Maya Chen", "Product", "MC", "Ready", h),
          person("Alex Morgan", "Legal", "AM", "Review", h),
          person("Inez Silva", "Operations", "IS", "Ready", h),
        ])],
      }, h),
      Card.view({
        title: "Workflow volume",
        description: "Runs completed over the last seven days",
        style: styles.chartCard,
        action: [Badge.view({ label: "+18%", tone: "success" }, h)],
        children: [Chart.view({
          ariaLabel: "Workflow volume for the last seven days",
          values: [42, 65, 52, 79, 68, 83, 91],
        }, h)],
      }, h),
    ]),
  ]);

const sectionIntro = <Message>(
  label: string,
  title: string,
  description: string,
  h: HtmlBuilder<Message>,
): Html => h.div([h.Class(className(styles.sectionIntro))], [
  h.div([h.Class(className(styles.sectionLabel))], [label]),
  h.h2([h.Class(className(styles.sectionTitle))], [title]),
  h.p([h.Class(className(styles.sectionDescription))], [description]),
]);

const comparison = <Message>(h: HtmlBuilder<Message>): Html =>
  h.div([h.Class(className(styles.comparison))], [
    h.article([h.Class(className(styles.comparisonColumn))], [
      h.h3([h.Class(className(styles.comparisonHeading))], [
        Icon.view({ icon: Blocks, size: 18 }, h),
        "UI components",
      ]),
      h.p([h.Class(className(styles.comparisonText))], [
        "Focused building blocks that own presentation and a small interaction contract. Compose them to create a consistent interface.",
      ]),
      h.div([h.Class(className(styles.chips))], ["Button", "Dialog", "Select", "Table", "Tooltip"].map((name) =>
        h.span([h.Class(className(styles.chip))], [name])
      )),
    ]),
    h.article([h.Class(className(styles.comparisonColumn, styles.comparisonApplication))], [
      h.h3([h.Class(className(styles.comparisonHeading))], [
        Icon.view({ icon: Layers3, size: 18 }, h),
        "Application primitives",
      ]),
      h.p([h.Class(className(styles.comparisonText))], [
        "Complete product capabilities with domain models, messages, updates, accessibility, and composition points—not just a styled surface.",
      ]),
      h.div([h.Class(className(styles.chips))], ["DataGrid", "QueryBuilder", "FormBuilder", "Workflow", "PdfAnnotator"].map((name) =>
        h.span([h.Class(className(styles.chip))], [name])
      )),
    ]),
  ]);

const packageCard = <Message>(item: Package, h: HtmlBuilder<Message>): Html =>
  h.a([
    h.Class(className(styles.packageCard)),
    h.Href(item.href),
    h.AriaLabel(`${item.name}: ${item.description}`),
  ], [
    h.span([h.Class(className(styles.packageIcon))], [Icon.view({ icon: item.icon, size: 17 }, h)]),
    h.span([h.Class(className(styles.packageCategory))], [item.category]),
    h.span([h.Class(className(styles.packageName))], [
      item.name,
      Icon.view({ icon: ArrowRight, size: 14 }, h),
    ]),
    h.p([h.Class(className(styles.packageDescription))], [item.description]),
  ]);

const principle = <Message>(
  icon: LucideIconData,
  title: string,
  description: string,
  h: HtmlBuilder<Message>,
): Html => h.article([h.Class(className(styles.principle))], [
  h.span([h.Class(className(styles.packageIcon))], [Icon.view({ icon, size: 17 }, h)]),
  h.h3([h.Class(className(styles.principleHeading))], [title]),
  h.p([h.Class(className(styles.principleText))], [description]),
]);

export const view = <Message>(h: HtmlBuilder<Message>): Html =>
  h.div([h.Class(className(styles.viewport)), h.DataAttribute("home-page", "true")], [
    h.div([h.Class(className(styles.content))], [
      h.section([h.Class(className(styles.hero)), h.AriaLabel("Foldworks overview")], [
        h.div([h.Class(className(styles.heroCopy))], [
          h.div([h.Class(className(styles.eyebrow))], [
            Icon.view({ icon: Blocks, size: 15 }, h),
            "Foldkit + StyleX",
          ]),
          h.h2([h.Class(className(styles.title))], ["Application primitives for product teams."]),
          h.p([h.Class(className(styles.lead))], [
            "Foldworks is a collection of polished, controlled building blocks for ambitious web applications—from interface components to complete editors and structured workflows.",
          ]),
          h.div([h.Class(className(styles.actions))], [
            link("Open the Workers workbench", workbenchRouter(), "primary", h),
            link("Try the agent playground", agentRouter(), "secondary", h),
            link("Explore the UI system", uiKitRouter(), "secondary", h),
          ]),
          h.div([h.Class(className(styles.heroMeta))], [
            h.span([h.Class(className(styles.metaItem))], [Icon.view({ icon: CheckCircle2, size: 14 }, h), "Accessible by default"]),
            h.span([h.Class(className(styles.metaItem))], [Icon.view({ icon: Braces, size: 14 }, h), "Controlled state"]),
            h.span([h.Class(className(styles.metaItem))], [Icon.view({ icon: Layers3, size: 14 }, h), "Themeable CSS variables"]),
          ]),
        ]),
        componentPreview(h),
      ]),

      h.section([h.Class(className(styles.section)), h.AriaLabelledBy("primitives-title")], [
        h.div([h.Class(className(styles.sectionIntro))], [
          h.div([h.Class(className(styles.sectionLabel))], ["A useful boundary"]),
          h.h2([h.Class(className(styles.sectionTitle)), h.Id("primitives-title")], ["Components compose the interface. Primitives run the application."]),
          h.p([h.Class(className(styles.sectionDescription))], [
            "Foldworks keeps low-level UI flexible while packaging the difficult behavior that every serious product eventually has to build.",
          ]),
        ]),
        comparison(h),
      ]),

      h.section([h.Class(className(styles.section)), h.AriaLabelledBy("packages-title")], [
        h.div([h.Class(className(styles.sectionIntro))], [
          h.div([h.Class(className(styles.sectionLabel))], ["The collection"]),
          h.h2([h.Class(className(styles.sectionTitle)), h.Id("packages-title")], ["Start small. Compose upward."]),
          h.p([h.Class(className(styles.sectionDescription))], [
            "Each package stands on its own and shares the same state, accessibility, styling, and composition philosophy.",
          ]),
        ]),
        h.div([h.Class(className(styles.packageGrid))], packages.map((item) => packageCard(item, h))),
      ]),

      h.section([h.Class(className(styles.section)), h.AriaLabel("Built from first principles")], [
        sectionIntro(
          "Built from first principles",
          "Predictable behavior without giving up design control.",
          "Foldworks separates state, behavior, and styling so the same primitives can fit your product instead of dictating it.",
          h,
        ),
        h.div([h.Class(className(styles.principles))], [
          principle(Braces, "Foldkit behavior", "Models and messages make every state transition explicit, testable, and controlled by the host application.", h),
          principle(Layers3, "StyleX styling", "Static styles and semantic CSS variables provide strong defaults with shadcn-like theme portability.", h),
          principle(CheckCircle2, "Product-ready details", "Keyboard interaction, focus management, validation, history, and responsive behavior ship together.", h),
        ]),
      ]),
    ]),
  ]);
