import { decodeDocument, viewBlocks } from "@foldkit/markdown";
import {
  createFreeformLayout,
  smoothPathForPoints,
  type DiagramDocument,
} from "@foldworks/diagram";
import { Badge, Button, CodeBlock, Icon, Input, Select } from "@foldworks/ui";
import { ArrowRight, BookOpen, Boxes, GitBranch, Search } from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import catalog from "virtual:foldworks-docs";
import { docsPath, sourceUrl, type ModuleDoc, type PackageDoc } from "./catalog";
import { explorers, type Explorer } from "./explorer";
import { Message } from "./message";
import type { Model } from "./model";
import "./styles.css";

export { catalog };
const c = (h: HtmlBuilder<Message>, value: string) => [h.Class(`docs-${value}`)];
const link = (h: HtmlBuilder<Message>, label: string, href: string, style = "link") =>
  h.a([...c(h, style), h.Href(href)], [label]);
const paragraph = (h: HtmlBuilder<Message>, text: string) => h.p(c(h, "muted"), [text]);

const diagramDocuments = new Map(
  explorers.map((explorer) => {
    const grouped = new Map<string, { from: string; to: string; labels: string[] }>();
    for (const transition of explorer.transitions) {
      if (transition.from === transition.to) continue;
      const key = JSON.stringify([transition.from, transition.to]);
      const group = grouped.get(key) ?? { from: transition.from, to: transition.to, labels: [] };
      group.labels.push(transition.event);
      grouped.set(key, group);
    }
    const document: DiagramDocument<string, string> = {
      nodes: explorer.states.map((state) => ({ id: state, data: state })),
      annotations: [],
      edges: [...grouped.values()].map((group, index) => ({
        id: `edge-${index}`,
        source: { nodeId: group.from },
        target: { nodeId: group.to },
        data: group.labels.join(" / "),
      })),
    };
    const scene = createFreeformLayout<string, string, { text: string }>({
      nodeSize: () => ({ width: 240, height: 64 }),
      gap: 160,
      edgeRouting: "Curved",
      edgeSpacing: 42,
    })(document);
    return [explorer.id, { document, scene }] as const;
  }),
);

const diagram = (explorer: Explorer, state: string, h: HtmlBuilder<Message>): Html => {
  const { document, scene } = diagramDocuments.get(explorer.id)!;
  const pad = 60;
  const bounds = scene.bounds;
  return h.div(c(h, "diagram"), [
    h.svg(
      [
        h.ViewBox(
          `${bounds.x - pad} ${bounds.y - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`,
        ),
        h.Role("img"),
        h.AriaLabel(
          `${explorer.title} state machine; active state ${state}. Full transitions listed below.`,
        ),
      ],
      [
        h.defs(
          [],
          [
            h.marker(
              [
                h.Id("docs-arrow"),
                h.ViewBox("0 0 10 10"),
                h.RefX("9"),
                h.RefY("5"),
                h.MarkerWidth("6"),
                h.MarkerHeight("6"),
                h.Orient("auto-start-reverse"),
              ],
              [h.path([h.D("M 0 0 L 10 5 L 0 10 z"), h.Fill("var(--muted-foreground)")])],
            ),
          ],
        ),
        ...scene.edges.map((edge) => {
          const semantic = document.edges.find((item) => item.id === edge.id)!;
          return h.g(
            [],
            [
              h.path(
                [
                  h.D(smoothPathForPoints(edge.points)),
                  h.Fill("none"),
                  h.Stroke("var(--muted-foreground)"),
                  h.StrokeWidth("1.5"),
                  h.MarkerEnd("url(#docs-arrow)"),
                ],
                [h.title([], [semantic.data])],
              ),
              ...(edge.labelPosition
                ? [
                    h.text(
                      [
                        h.X(String(edge.labelPosition.x)),
                        h.Y(String(edge.labelPosition.y - 9)),
                        h.TextAnchor("middle"),
                        h.Class("docs-edge-label"),
                      ],
                      [
                        semantic.data.length > 34
                          ? semantic.data.slice(0, 31) + "…"
                          : semantic.data,
                      ],
                    ),
                  ]
                : []),
            ],
          );
        }),
        ...[...scene.nodes.values()].map((node) =>
          h.g(
            [],
            [
              h.rect([
                h.X(String(node.x)),
                h.Y(String(node.y)),
                h.Width(String(node.width)),
                h.Height(String(node.height)),
                h.Rx("10"),
                h.Fill(node.id === state ? "var(--primary)" : "var(--card)"),
                h.Stroke(node.id === state ? "var(--primary)" : "var(--border)"),
                h.StrokeWidth("1.5"),
              ]),
              h.text(
                [
                  h.X(String(node.x + node.width / 2)),
                  h.Y(String(node.y + 37)),
                  h.TextAnchor("middle"),
                  h.Fill(node.id === state ? "var(--primary-foreground)" : "var(--foreground)"),
                  h.Class("docs-node-label"),
                ],
                [node.id],
              ),
            ],
          ),
        ),
      ],
    ),
  ]);
};

const explorerView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const explorer = explorers.find((item) => item.id === model.explorer) ?? explorers[0]!;
  const snapshot = explorer.replay(model.events);
  return h.section(
    [...c(h, "section"), h.Id("state-machine")],
    [
      h.div(c(h, "section-heading"), [
        h.h2([], [Icon.view({ icon: GitBranch, size: 19 }, h), "State machine explorer"]),
        Badge.view({ label: "Real reducer", tone: "success", dot: true }, h),
      ]),
      h.div(c(h, "row"), [
        Select.control(
          {
            value: explorer.id,
            ariaLabel: "Reducer to explore",
            options: explorers.map((item) => ({ value: item.id, label: item.title })),
            onChange: (id) => Message.SelectedExplorer({ id }),
          },
          h,
        ),
        Badge.view({ label: `${explorer.states.length} states` }, h),
        Button.view(
          { label: "Reset", variant: "outline", size: "sm", onClick: Message.Reset() },
          h,
        ),
      ]),
      paragraph(h, explorer.description),
      diagram(explorer, snapshot.state, h),
      h.div(c(h, "explorer-panel"), [
        h.div(c(h, "events"), [
          h.h3([], ["Send a message"]),
          ...explorer.events.map((event) =>
            Button.view(
              {
                label: event,
                variant: "outline",
                size: "sm",
                onClick: Message.SentEvent({ event }),
              },
              h,
            ),
          ),
          h.p([h.Role("status"), h.AriaLive("polite")], [`Current state: ${snapshot.state}`]),
        ]),
        CodeBlock.view(
          {
            title: "Current model",
            language: "json",
            code: JSON.stringify(snapshot.model, null, 2),
            maxHeight: "260px",
          },
          h,
        ),
      ]),
      ...(snapshot.trace.length
        ? [
            h.div(c(h, "trace"), [
              h.h3([], ["Message trace"]),
              ...snapshot.trace
                .slice(-8)
                .map((item) =>
                  h.div(c(h, "trace-row"), [
                    h.code([], [item.event]),
                    h.span(
                      [],
                      [
                        `${item.from} → ${item.to}${item.commands ? ` · ${item.commands} command(s)` : ""}`,
                      ],
                    ),
                    ...(item.outMessage ? [h.code([], [item.outMessage])] : []),
                  ]),
                ),
            ]),
          ]
        : []),
      h.details(c(h, "details"), [
        h.summary([], ["All transitions, including unchanged states"]),
        h.div(c(h, "table-wrap"), [
          h.table(
            [],
            [
              h.thead(
                [],
                [
                  h.tr(
                    [],
                    ["From", "Message", "To", "Commands", "Out message"].map((label) =>
                      h.th([h.Scope("col")], [label]),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                explorer.transitions.map((item) =>
                  h.tr(
                    [],
                    [
                      item.from,
                      item.event,
                      item.to,
                      String(item.commands),
                      item.outMessage || "—",
                    ].map((value) => h.td([], [value])),
                  ),
                ),
              ),
            ],
          ),
        ]),
      ]),
    ],
  );
};

const moduleView = (module: ModuleDoc, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      h.div(c(h, "section-heading"), [
        h.h2([], [module.id]),
        link(h, "View source ↗", sourceUrl(module.path)),
      ]),
      paragraph(h, module.path),
      ...module.contracts.map((contract) =>
        h.section(c(h, "contract"), [
          h.h3(
            [],
            [
              contract.kind === "model"
                ? "Model schema"
                : contract.kind === "outMessages"
                  ? "Outgoing messages"
                  : "Messages",
            ],
          ),
          h.div(c(h, "table-wrap"), [
            h.table(
              [],
              [
                h.thead(
                  [],
                  [
                    h.tr(
                      [],
                      ["Name", contract.kind === "model" ? "Schema" : "Payload"].map((label) =>
                        h.th([h.Scope("col")], [label]),
                      ),
                    ),
                  ],
                ),
                h.tbody(
                  [],
                  contract.fields.map((field) =>
                    h.tr(
                      [],
                      [
                        h.td([], [h.code([], [field.name])]),
                        h.td(
                          [],
                          [
                            h.code([], [field.schema]),
                            ...(field.description ? [paragraph(h, field.description)] : []),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ]),
        ]),
      ),
      h.h3([], ["Exported API"]),
      ...module.symbols.map((symbol, index) =>
        h.article(
          [...c(h, "symbol"), h.Id(`symbol-${index}`)],
          [
            h.div(c(h, "section-heading"), [
              h.h3([], [symbol.name]),
              Badge.view({ label: symbol.kind }, h),
              link(h, `Line ${symbol.line} ↗`, sourceUrl(module.path, symbol.line)),
            ]),
            ...(symbol.description ? [paragraph(h, symbol.description)] : []),
            CodeBlock.view(
              { code: symbol.signature, language: "typescript", wrap: true, maxHeight: "360px" },
              h,
            ),
            ...(symbol.source !== symbol.signature
              ? [
                  h.details(c(h, "details"), [
                    h.summary([], ["Declaration source"]),
                    CodeBlock.view(
                      {
                        code: symbol.source,
                        language: "typescript",
                        maxHeight: "480px",
                        lineNumbers: true,
                      },
                      h,
                    ),
                  ]),
                ]
              : []),
          ],
        ),
      ),
      ...(module.imports.length
        ? [
            h.h3([], ["Imports & re-exports"]),
            h.div(
              c(h, "chips"),
              module.imports.map((item) => h.code([], [item])),
            ),
          ]
        : []),
    ],
  );

const readmeView = (pkg: PackageDoc, h: HtmlBuilder<Message>): Html =>
  h.div(
    c(h, "markdown"),
    viewBlocks(decodeDocument(pkg.readme), {
      views: {
        CodeBlock: (block) =>
          CodeBlock.view({ code: block.value, wrap: false, maxHeight: "500px" }, h),
        Link: (node, children) => {
          const href = /^(?:https?:|mailto:|#|\/)/.test(node.url)
            ? node.url
            : new URL(
                node.url,
                `https://github.com/bjacobso/foldworks/blob/main/packages/${pkg.id}/README.md`,
              ).href;
          return h.a([h.Href(href)], children);
        },
      },
    }),
  );

const packageView = (
  pkg: PackageDoc,
  moduleId: string,
  model: Model,
  h: HtmlBuilder<Message>,
): Html => {
  const module = pkg.modules.find((item) => item.id === moduleId);
  return h.div(c(h, "package-layout"), [
    h.nav(
      [...c(h, "module-nav"), h.AriaLabel("Module reference")],
      [
        h.div(c(h, "eyebrow"), ["IN THIS PACKAGE"]),
        link(
          h,
          "Overview & usage",
          docsPath(pkg.id),
          moduleId === "" ? "module-active" : "module-link",
        ),
        ...pkg.modules.map((item) =>
          link(
            h,
            item.id,
            docsPath(pkg.id, item.id),
            item.id === moduleId ? "module-active" : "module-link",
          ),
        ),
      ],
    ),
    h.article(c(h, "article"), [
      h.div(c(h, "eyebrow"), ["MODULE REFERENCE"]),
      h.div(c(h, "section-heading"), [
        h.h1([], [pkg.name]),
        Badge.view({ label: `v${pkg.version}` }, h),
      ]),
      paragraph(h, pkg.description),
      moduleId && !module
        ? h.div(c(h, "section"), [
            h.h2([], ["Module not found"]),
            link(h, "Back to package overview", docsPath(pkg.id)),
          ])
        : module
          ? moduleView(module, h)
          : h.div(
              [],
              [
                CodeBlock.view(
                  { title: "Install", code: `pnpm add ${pkg.name}`, language: "sh" },
                  h,
                ),
                h.div(c(h, "row"), [
                  Badge.view({ label: `${pkg.modules.length} public source modules` }, h),
                  link(h, "Package source ↗", sourceUrl(`packages/${pkg.id}`)),
                ]),
                ...(pkg.id === "sidebar" || pkg.id === "ui" ? [explorerView(model, h)] : []),
                readmeView(pkg, h),
                h.section(c(h, "section"), [
                  h.h2([], ["Package entrypoints"]),
                  h.div(
                    c(h, "chips"),
                    pkg.entrypoints.map((item) => h.code([], [item])),
                  ),
                ]),
                h.section(c(h, "section"), [
                  h.h2([], ["Dependencies"]),
                  h.div(
                    c(h, "chips"),
                    pkg.dependencies.map((item) =>
                      item.startsWith("@foldworks/")
                        ? link(h, item, docsPath(item.slice("@foldworks/".length)))
                        : h.code([], [item]),
                    ),
                  ),
                ]),
              ],
            ),
    ]),
  ]);
};

const overview = (model: Model, h: HtmlBuilder<Message>): Html => {
  const query = model.query.toLowerCase().trim();
  const matches = catalog.filter((pkg) =>
    `${pkg.name} ${pkg.description} ${pkg.modules.map((module) => `${module.id} ${module.symbols.map((symbol) => symbol.name).join(" ")}`).join(" ")}`
      .toLowerCase()
      .includes(query),
  );
  return h.div(c(h, "overview"), [
    h.div(c(h, "eyebrow"), [Icon.view({ icon: BookOpen, size: 14 }, h), "FOLDWORKS DOCUMENTATION"]),
    h.h1(c(h, "hero-title"), ["Understand the pieces.\nBuild the whole."]),
    h.p(c(h, "lead"), [
      "Explore the modules, follow the messages, and see how state changes. A living reference, generated from the code you actually use.",
    ]),
    h.div(c(h, "row"), [
      Badge.view({ label: `${catalog.length} packages` }, h),
      Badge.view(
        {
          label: `${catalog.reduce((count, pkg) => count + pkg.modules.length, 0)} source modules`,
        },
        h,
      ),
      Badge.view({ label: "Generated from source", tone: "success", dot: true }, h),
    ]),
    h.div(c(h, "search"), [
      Icon.view({ icon: Search, size: 18 }, h),
      Input.view(
        {
          value: model.query,
          ariaLabel: "Search documentation",
          placeholder: "Search packages, modules, or exports…",
          onInput: (query) => Message.Searched({ query }),
        },
        h,
      ),
    ]),
    h.div(
      [h.Role("status"), h.AriaLive("polite"), ...c(h, "muted")],
      [
        query
          ? `${matches.length} matching packages`
          : "Choose a package to explore its API and usage.",
      ],
    ),
    h.div(
      c(h, "package-grid"),
      matches.map((pkg) =>
        h.a(
          [...c(h, "package-card"), h.Href(docsPath(pkg.id))],
          [
            h.div(c(h, "section-heading"), [
              Icon.view({ icon: Boxes, size: 19 }, h),
              Badge.view({ label: `${pkg.modules.length} modules` }, h),
            ]),
            h.h2([], [pkg.id]),
            paragraph(h, pkg.description),
            h.div(c(h, "card-footer"), [
              h.code([], [pkg.name]),
              Icon.view({ icon: ArrowRight, size: 16 }, h),
            ]),
            ...(query
              ? [
                  h.div(
                    c(h, "matching-modules"),
                    pkg.modules
                      .filter((module) =>
                        `${module.id} ${module.symbols.map((symbol) => symbol.name).join(" ")}`
                          .toLowerCase()
                          .includes(query),
                      )
                      .slice(0, 4)
                      .map((module) => h.span([], [module.id])),
                  ),
                ]
              : []),
          ],
        ),
      ),
    ),
    ...(matches.length
      ? []
      : [
          h.p(c(h, "section"), [
            "No packages match your search. Try a component name such as Button or EditableText.",
          ]),
        ]),
    explorerView(model, h),
    h.section(c(h, "generation-note"), [
      h.h2([], ["Documentation that follows the code"]),
      paragraph(
        h,
        "Package metadata, public source modules, JSDoc, schemas, and messages are discovered automatically. READMEs provide the usage guides. Reducer explorers use explicit event samples and state projections; add an adapter to document another interaction.",
      ),
      link(h, "Download the generated catalog ↗", "/docs/manifest.json"),
    ]),
  ]);
};

export const view = defineView<Model, Message, { packageId: string; moduleId: string }>(
  (model, viewInputs, h) => {
    const pkg = catalog.find((item) => item.id === viewInputs.packageId);
    return h.div(
      [...c(h, "viewport"), h.DataAttribute("docs-page", "true")],
      [
        viewInputs.packageId && !pkg
          ? h.div(c(h, "overview"), [
              h.h1([], ["Package not found"]),
              link(h, "Browse all packages", docsPath()),
            ])
          : pkg
            ? packageView(pkg, viewInputs.moduleId, model, h)
            : overview(model, h),
      ],
    );
  },
);
