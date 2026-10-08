import type { LucideIconData } from "@lucide/icons";
import {
  ArrowRight,
  Blocks,
  Bot,
  Braces,
  CheckCircle2,
  FileText,
  History,
  Keyboard,
  Layers3,
  ListChecks,
  ListFilter,
  ListTree,
  Network,
  PanelLeft,
  Table2,
  Workflow,
  FolderGit2,
  FileDiff,
  Sparkles,
  TextCursorInput,
} from "@lucide/icons";
import { render } from "@foldworks/generative-ui/core";
import { foldworksRegistry } from "@foldworks/generative-ui/foldworks";
import { Avatar, Badge, Card, Chart, Icon, Progress } from "@foldworks/ui";
import type { Html, HtmlBuilder } from "foldkit/html";

import {
  editorRouter,
  agentRouter,
  codeEditorRouter,
  codebaseRouter,
  diffViewerRouter,
  dataTablePath,
  dataGridPath,
  formBuilderPath,
  outlinerRouter,
  pdfAnnotatorRouter,
  pdfViewerRouter,
  queryBuilderRouter,
  statechartRouter,
  uiKitRouter,
  workbenchRouter,
  workflowPath,
} from "../app/route";
import { Message } from "../app/message";
import { releaseSpec, releaseSpecPreview } from "../generative-ui/spec";
import { layers } from "../stack";
import { className, styles } from "./styles";

type Package = Readonly<{
  description: string;
  href: string;
  icon: LucideIconData;
}>;

const packages: Readonly<Record<string, Package>> = {
  ui: {
    description: "Semantic tokens, themes, and accessible components for product surfaces.",
    href: uiKitRouter(),
    icon: Blocks,
  },
  sidebar: {
    description: "Responsive application chrome with controlled navigation state.",
    href: "/",
    icon: PanelLeft,
  },
  keyboard: {
    description: "Typed scoped commands and platform-aware shortcuts with Foldkit lifecycles.",
    href: uiKitRouter(),
    icon: Keyboard,
  },
  history: {
    description: "Reusable undo, redo, and bounded document history for controlled models.",
    href: workflowPath("Vertical"),
    icon: History,
  },
  "text-intelligence": {
    description: "Hover, completion, highlighting, and diagnostics shared by text surfaces.",
    href: codeEditorRouter(),
    icon: TextCursorInput,
  },
  diagram: {
    description: "Compound graphs with cycles, notes, layered layout, and canvas interaction.",
    href: statechartRouter(),
    icon: Network,
  },
  pdf: {
    description: "PDF rendering, page geometry, and composable page surfaces.",
    href: pdfViewerRouter(),
    icon: FileText,
  },
  editor: {
    description: "Native rich-text editing, Markdown, and extensible document blocks.",
    href: editorRouter(),
    icon: FileText,
  },
  "code-editor": {
    description: "Code editing, syntax highlighting, and live diagnostics in a versioned document.",
    href: codeEditorRouter(),
    icon: Braces,
  },
  outliner: {
    description:
      "Keyboard-first outlines with natural indenting, folding, hoisting, and drag and drop.",
    href: outlinerRouter(),
    icon: ListTree,
  },
  "data-table": {
    description:
      "Resource-first CRUD tables with links, sorting, bulk selection, density, and pinned columns.",
    href: dataTablePath(),
    icon: Table2,
  },
  "data-grid": {
    description:
      "Pinned columns, virtualized rows, ordering, range selection, copy/paste, and editing.",
    href: dataGridPath(),
    icon: Table2,
  },
  "query-builder": {
    description: "Recursive conditions with validation and structured drag and drop.",
    href: queryBuilderRouter(),
    icon: ListFilter,
  },
  "form-builder": {
    description: "Multi-page, multi-actor forms with editable and runnable modes.",
    href: formBuilderPath("Handoff", "Editor"),
    icon: ListChecks,
  },
  workflow: {
    description: "Structured workflows with branches, layout, history, and inspectors.",
    href: workflowPath("Vertical"),
    icon: Workflow,
  },
  "diff-viewer": {
    description: "Review-grade unified and split diffs with line selection, threads, and progress.",
    href: diffViewerRouter(),
    icon: FileDiff,
  },
  "pdf-viewer": {
    description: "Read PDF pages with navigation, zoom, and overlay hotspots.",
    href: pdfViewerRouter(),
    icon: FileText,
  },
  "pdf-annotator": {
    description: "Annotate and export real PDF documents.",
    href: pdfAnnotatorRouter(),
    icon: FileText,
  },
  agent: {
    description:
      "Composable chat UI with streaming conversations, tool states, approvals, cancellation, and retry.",
    href: agentRouter(),
    icon: Bot,
  },
  "generative-ui": {
    description: "Schema-checked agent interfaces rendered through a closed component catalog.",
    href: "#generative-ui",
    icon: Sparkles,
  },
  codebase: {
    description: "A live repository workbench for documentation, source, history, and Git diffs.",
    href: codebaseRouter(),
    icon: FolderGit2,
  },
};

const packageCount = layers.reduce((count, layer) => count + layer.packageIds.length, 0);

const link = <Message>(
  label: string,
  href: string,
  kind: "primary" | "secondary",
  h: HtmlBuilder<Message>,
): Html =>
  h.a(
    [
      h.Class(className(kind === "primary" ? styles.primaryLink : styles.secondaryLink)),
      h.Href(href),
    ],
    [label, Icon.view({ icon: ArrowRight, size: 15 }, h)],
  );

const person = <Message>(
  name: string,
  role: string,
  fallback: string,
  status: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class(className(styles.teamRow))],
    [
      Avatar.view({ alt: name, fallback, size: "sm", sx: styles.teamAvatar }, h),
      h.span([h.Class(className(styles.teamName))], [name]),
      h.span([h.Class(className(styles.teamRole))], [role]),
      Badge.view(
        {
          label: status,
          tone: status === "Ready" ? "success" : "neutral",
          dot: true,
          sx: styles.teamStatus,
        },
        h,
      ),
    ],
  );

const componentPreview = <Message>(h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class(className(styles.preview))],
    [
      h.div(
        [h.Class(className(styles.previewHeader))],
        [
          h.span([h.Class(className(styles.previewTitle))], ["Release overview"]),
          Badge.view({ label: "Live components", tone: "info", dot: true }, h),
        ],
      ),
      h.div(
        [h.Class(className(styles.previewGrid))],
        [
          Card.view(
            {
              title: "Launch readiness",
              description: "Across product, legal, and operations",
              sx: styles.previewCard,
              children: [
                h.div([h.Class(className(styles.metric))], ["82%"]),
                Progress.view({ value: 82, ariaLabel: "Launch readiness" }, h),
                h.div(
                  [h.Class(className(styles.metricMeta))],
                  [h.span([], ["14 of 17 checks"]), h.span([], ["On track"])],
                ),
              ],
            },
            h,
          ),
          Card.view(
            {
              title: "Owners",
              description: "Current handoff",
              sx: styles.previewCard,
              children: [
                h.div(
                  [h.Class(className(styles.teamList))],
                  [
                    person("Maya Chen", "Product", "MC", "Ready", h),
                    person("Alex Morgan", "Legal", "AM", "Review", h),
                    person("Inez Silva", "Operations", "IS", "Ready", h),
                  ],
                ),
              ],
            },
            h,
          ),
          Card.view(
            {
              title: "Workflow volume",
              description: "Runs completed over the last seven days",
              sx: styles.chartCard,
              action: [Badge.view({ label: "+18%", tone: "success" }, h)],
              children: [
                Chart.view(
                  {
                    ariaLabel: "Workflow volume for the last seven days",
                    values: [42, 65, 52, 79, 68, 83, 91],
                  },
                  h,
                ),
              ],
            },
            h,
          ),
        ],
      ),
    ],
  );

const sectionIntro = <Message>(
  label: string,
  title: string,
  description: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class(className(styles.sectionIntro))],
    [
      h.div([h.Class(className(styles.sectionLabel))], [label]),
      h.h2([h.Class(className(styles.sectionTitle))], [title]),
      h.p([h.Class(className(styles.sectionDescription))], [description]),
    ],
  );

const stack = <Message>(h: HtmlBuilder<Message>): Html =>
  h.ol(
    [h.Class(className(styles.stack)), h.AriaLabel("The Foldworks stack, from top to bottom")],
    layers.map((layer) =>
      h.li(
        [
          h.Class(
            className(
              styles.stackLayer,
              layer.id === "Workbenches" && styles.stackLayerTop,
              layer.id === "Tokens" && styles.stackLayerBase,
            ),
          ),
        ],
        [
          h.span([h.Class(className(styles.stackIndex))], [layer.index]),
          h.div(
            [h.Class(className(styles.stackCopy))],
            [
              h.h3([h.Class(className(styles.stackName))], [layer.title]),
              h.p([h.Class(className(styles.stackSummary))], [layer.summary]),
            ],
          ),
          h.div(
            [h.Class(className(styles.stackChips))],
            layer.examples.map((name) => h.span([h.Class(className(styles.chip))], [name])),
          ),
        ],
      ),
    ),
  );

const packageCard = <Message>(id: string, item: Package, h: HtmlBuilder<Message>): Html =>
  h.a(
    [
      h.Class(className(styles.packageCard)),
      h.Href(item.href),
      h.AriaLabel(`@foldworks/${id}: ${item.description}`),
    ],
    [
      h.span(
        [h.Class(className(styles.packageIcon))],
        [Icon.view({ icon: item.icon, size: 17 }, h)],
      ),
      h.span(
        [h.Class(className(styles.packageName))],
        [`@foldworks/${id}`, Icon.view({ icon: ArrowRight, size: 14 }, h)],
      ),
      h.p([h.Class(className(styles.packageDescription))], [item.description]),
    ],
  );

const catalog = <Message>(h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class(className(styles.catalog))],
    layers
      .filter((layer) => layer.packageIds.length > 0)
      .map((layer) =>
        h.div(
          [h.Class(className(styles.catalogGroup))],
          [
            h.h3([h.Class(className(styles.catalogHeading))], [layer.title]),
            h.div(
              [h.Class(className(styles.packageGrid))],
              layer.packageIds.flatMap((id) => {
                const item = packages[id];
                return item === undefined ? [] : [packageCard(id, item, h)];
              }),
            ),
          ],
        ),
      ),
  );

const principle = <Message>(
  icon: LucideIconData,
  title: string,
  description: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.article(
    [h.Class(className(styles.principle))],
    [
      h.span([h.Class(className(styles.packageIcon))], [Icon.view({ icon, size: 17 }, h)]),
      h.h3([h.Class(className(styles.principleHeading))], [title]),
      h.p([h.Class(className(styles.principleText))], [description]),
    ],
  );

const generativeUiDemo = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class(className(styles.generativeDemo))],
    [
      h.div(
        [h.Class(className(styles.generativeSource))],
        [
          h.div(
            [h.Class(className(styles.generativePrompt))],
            [
              h.span([h.Class(className(styles.generativePromptLabel))], ["Agent request"]),
              h.p(
                [h.Class(className(styles.generativePromptText))],
                ["Show release readiness, the owner checks, and safe next actions."],
              ),
            ],
          ),
          h.div(
            [h.Class(className(styles.generativeContract))],
            [
              Badge.view({ label: "Effect Schema validated", tone: "success", dot: true }, h),
              h.span([], ["10 components · 2 actions · no generated code"]),
            ],
          ),
          h.pre(
            [h.Class(className(styles.generativeCode)), h.Tabindex(0)],
            [h.code([], [releaseSpecPreview])],
          ),
        ],
      ),
      h.div(
        [h.Class(className(styles.generativeResult))],
        [
          h.div(
            [h.Class(className(styles.generativeResultHeader))],
            [
              h.span([], ["Rendered result"]),
              Badge.view({ label: "Same MCP contract", tone: "info" }, h),
            ],
          ),
          h.div(
            [h.Class(className(styles.generativeCanvas))],
            [
              render(
                {
                  spec: releaseSpec,
                  registry: foldworksRegistry<Message>(),
                  toMessage: (intent) => Message.GotGenerativeUiAction({ intent }),
                },
                h,
              ),
            ],
          ),
        ],
      ),
    ],
  );

export const view = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class(className(styles.viewport)), h.DataAttribute("home-page", "true")],
    [
      h.div(
        [h.Class(className(styles.content))],
        [
          h.section(
            [h.Class(className(styles.hero)), h.AriaLabel("Foldworks overview")],
            [
              h.div(
                [h.Class(className(styles.heroCopy))],
                [
                  h.div(
                    [h.Class(className(styles.eyebrow))],
                    [
                      Icon.view({ icon: Layers3, size: 15 }, h),
                      "A standard library for Foldkit interfaces",
                    ],
                  ),
                  h.h2(
                    [h.Class(className(styles.title))],
                    ["The UI standard library, from tokens to workbenches."],
                  ),
                  h.p(
                    [h.Class(className(styles.lead))],
                    [
                      "Foldworks is a higher-order shadcn. It starts with the buttons, dialogs, and theme tokens you expect, then keeps going: grids, editors, outliners, diagrams, diff review, PDF annotation, and agent surfaces. Every layer shares one token contract, one state model, and the same accessibility bar.",
                    ],
                  ),
                  h.div(
                    [h.Class(className(styles.actions))],
                    [
                      link("Read the documentation", "/docs", "primary", h),
                      link("Explore the UI system", uiKitRouter(), "secondary", h),
                      link("Open the Workers workbench", workbenchRouter(), "secondary", h),
                      link("Try the agent playground", agentRouter(), "secondary", h),
                      link(
                        "View on GitHub",
                        "https://github.com/bjacobso/foldworks",
                        "secondary",
                        h,
                      ),
                    ],
                  ),
                  h.div(
                    [h.Class(className(styles.heroMeta))],
                    [
                      h.span(
                        [h.Class(className(styles.metaItem))],
                        [
                          Icon.view({ icon: Layers3, size: 14 }, h),
                          `${packageCount} packages, ${layers.length} layers`,
                        ],
                      ),
                      h.span(
                        [h.Class(className(styles.metaItem))],
                        [Icon.view({ icon: Braces, size: 14 }, h), "Controlled state throughout"],
                      ),
                      h.span(
                        [h.Class(className(styles.metaItem))],
                        [Icon.view({ icon: CheckCircle2, size: 14 }, h), "Accessible by default"],
                      ),
                    ],
                  ),
                ],
              ),
              componentPreview(h),
            ],
          ),

          h.section(
            [h.Class(className(styles.section)), h.AriaLabelledBy("stack-title")],
            [
              h.div(
                [h.Class(className(styles.sectionIntro))],
                [
                  h.div([h.Class(className(styles.sectionLabel))], ["Top to bottom"]),
                  h.h2(
                    [h.Class(className(styles.sectionTitle)), h.Id("stack-title")],
                    ["Component kits stop at the button. Foldworks keeps going."],
                  ),
                  h.p(
                    [h.Class(className(styles.sectionDescription))],
                    [
                      "Component kits give you the bottom of the stack and leave the hard parts to you. Foldworks covers the whole stack, and each layer is built only from the layers beneath it, so your theme and your state model reach the data grid as surely as they reach the button.",
                    ],
                  ),
                ],
              ),
              stack(h),
            ],
          ),

          h.section(
            [
              h.Class(className(styles.section)),
              h.Id("generative-ui"),
              h.AriaLabelledBy("generative-ui-title"),
            ],
            [
              h.div(
                [h.Class(className(styles.sectionIntro))],
                [
                  h.div([h.Class(className(styles.sectionLabel))], ["Generative UI"]),
                  h.h2(
                    [h.Class(className(styles.sectionTitle)), h.Id("generative-ui-title")],
                    ["Agents choose from the library. Your application keeps control."],
                  ),
                  h.p(
                    [h.Class(className(styles.sectionDescription))],
                    [
                      "Because every layer has a typed contract, an agent can compose them too. The model returns JSON, not markup or event code. Effect Schema validates it, Foldkit renders registered components, and interactions return typed intents to the host.",
                    ],
                  ),
                ],
              ),
              generativeUiDemo(h),
            ],
          ),

          h.section(
            [h.Class(className(styles.section)), h.AriaLabelledBy("packages-title")],
            [
              h.div(
                [h.Class(className(styles.sectionIntro))],
                [
                  h.div([h.Class(className(styles.sectionLabel))], ["The library"]),
                  h.h2(
                    [h.Class(className(styles.sectionTitle)), h.Id("packages-title")],
                    ["Take one layer, or the whole stack."],
                  ),
                  h.p(
                    [h.Class(className(styles.sectionDescription))],
                    [
                      "Every package installs on its own and follows the same state, accessibility, styling, and composition rules. Each one links to a live example.",
                    ],
                  ),
                ],
              ),
              catalog(h),
            ],
          ),

          h.section(
            [h.Class(className(styles.section)), h.AriaLabel("One contract at every layer")],
            [
              sectionIntro(
                "One contract at every layer",
                "Higher-order, without losing control.",
                "The shadcn bargain still holds: you own the theme and the state, and the library supplies the hard behavior. Foldworks applies that bargain to whole applications.",
                h,
              ),
              h.div(
                [h.Class(className(styles.principles))],
                [
                  principle(
                    Braces,
                    "Your state, every time",
                    "Every primitive is a Foldkit model, message, and update. A data grid is as controlled, testable, and replayable as a checkbox.",
                    h,
                  ),
                  principle(
                    Layers3,
                    "Your tokens, every surface",
                    "Semantic CSS variables and StyleX reach every layer. Switch from Shadcn to Polaris and the diff viewer, outliner, and PDF annotator change with the buttons.",
                    h,
                  ),
                  principle(
                    CheckCircle2,
                    "The details included",
                    "Keyboard commands, focus management, undo history, validation, and responsive behavior ship with each primitive.",
                    h,
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
