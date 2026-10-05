import { decodeDocument, viewBlocks } from "@foldkit/markdown";
import { highlight } from "@foldworks/code-editor";
import {
  createFreeformLayout,
  smoothPathForPoints,
  type DiagramDocument,
} from "@foldworks/diagram";
import { Badge, CodeBlock, Icon, InputGroup, Select } from "@foldworks/ui";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  GitBranch,
  RotateCcw,
  Search,
} from "@lucide/icons";
import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";
import catalog from "virtual:foldworks-docs";
import { docsPath, sourceUrl, type ApiSymbol, type ModuleDoc, type PackageDoc } from "./catalog";
import { explorers, type Explorer } from "./explorer";
import { Message } from "./message";
import type { Model } from "./model";
import { groupPackages, packageIcon } from "./packages";
import "./styles.css";

export { catalog };
const c = (h: HtmlBuilder<Message>, ...values: string[]) => [
  h.Class(values.map((value) => `docs-${value}`).join(" ")),
];
const link = (h: HtmlBuilder<Message>, label: string, href: string, style = "link") =>
  h.a([...c(h, style), h.Href(href)], [label]);
const externalLink = (h: HtmlBuilder<Message>, label: string, href: string) =>
  h.a(
    [...c(h, "external"), h.Href(href), h.Target("_blank"), h.Rel("noreferrer")],
    [label, Icon.view({ icon: ArrowUpRight, size: 13 }, h)],
  );
const paragraph = (h: HtmlBuilder<Message>, text: string) => h.p(c(h, "muted"), [text]);
const languageOf = (value: string | undefined) =>
  value === "ts" ? "typescript" : value === "js" ? "javascript" : value;
const moduleCount = catalog.reduce((count, pkg) => count + pkg.modules.length, 0);

const kindTones: Readonly<Record<ApiSymbol["kind"], Badge.Tone>> = {
  function: "info",
  class: "warning",
  value: "success",
  type: "accent",
  interface: "accent",
  enum: "warning",
  export: "muted",
};

const breadcrumbs = (
  h: HtmlBuilder<Message>,
  items: ReadonlyArray<readonly [string, string?] | readonly [string]>,
): Html =>
  h.nav(
    [...c(h, "breadcrumbs"), h.AriaLabel("Breadcrumb")],
    items.flatMap(([label, href], index) => [
      ...(index ? [Icon.view({ icon: ChevronRight, size: 13 }, h)] : []),
      href ? h.a([h.Href(href)], [label]) : h.span([h.AriaCurrent("page")], [label]),
    ]),
  );

const onThisPage = (
  h: HtmlBuilder<Message>,
  items: ReadonlyArray<Readonly<{ id: string; label: string; depth?: number }>>,
): Html =>
  h.aside(
    [...c(h, "rail"), h.AriaLabel("On this page")],
    [
      h.div(c(h, "rail-title"), ["On this page"]),
      ...items.map((item) =>
        h.button(
          [
            ...c(h, item.depth ? "rail-link-nested" : "rail-link"),
            h.Type("button"),
            h.OnClick(Message.JumpedTo({ id: item.id })),
          ],
          [item.label],
        ),
      ),
    ],
  );

// Diagram

const diagramDocuments = new Map(
  explorers.map((explorer) => {
    const grouped = new Map<string, { from: string; to: string; labels: string[] }>();
    for (const transition of explorer.transitions) {
      if (transition.from === transition.to) continue;
      const key = JSON.stringify([transition.from, transition.to]);
      const group = grouped.get(key) ?? { from: transition.from, to: transition.to, labels: [] };
      if (!group.labels.includes(transition.event)) group.labels.push(transition.event);
      grouped.set(key, group);
    }
    const groups = [...grouped.values()];
    const document: DiagramDocument<string, string> = {
      nodes: explorer.states.map((state) => ({ id: state, data: state })),
      annotations: [],
      edges: groups.map((group, index) => ({
        id: `edge-${index}`,
        source: { nodeId: group.from },
        target: { nodeId: group.to },
        data: group.labels.join(" / "),
      })),
    };
    const scene = createFreeformLayout<string, string, { text: string }>({
      nodeSize: () => ({ width: 220, height: 56 }),
      gap: 180,
      edgeRouting: "Curved",
      edgeSpacing: 46,
    })(document);
    return [explorer.id, { document, scene, groups }] as const;
  }),
);

const truncate = (text: string, max = 32) =>
  text.length > max ? text.slice(0, max - 1) + "…" : text;

const diagram = (
  explorer: Explorer,
  state: string,
  previous: Readonly<{ from: string; to: string }> | undefined,
  h: HtmlBuilder<Message>,
): Html => {
  const { document, scene, groups } = diagramDocuments.get(explorer.id)!;
  const pad = 48;
  const bounds = scene.bounds;
  const edges = scene.edges.map((edge, index) => {
    const group = groups[Number(edge.id.slice("edge-".length))] ?? groups[index]!;
    const semantic = document.edges.find((item) => item.id === edge.id)!;
    const isLast =
      previous !== undefined && group.from === previous.from && group.to === previous.to;
    const tone: "idle" | "available" | "last" = isLast
      ? "last"
      : group.from === state
        ? "available"
        : "idle";
    return { edge, label: semantic.data, tone };
  });
  // Draw idle edges first so highlighted paths and labels stay on top.
  const order = { idle: 0, available: 1, last: 2 } as const;
  edges.sort((a, b) => order[a.tone] - order[b.tone]);
  return h.div(c(h, "diagram"), [
    h.svg(
      [
        h.ViewBox(
          `${bounds.x - pad} ${bounds.y - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`,
        ),
        h.Style({ aspectRatio: `${bounds.width + pad * 2} / ${bounds.height + pad * 2}` }),
        h.Role("img"),
        h.AriaLabel(
          `${explorer.title} state machine; active state ${state}. Full transitions listed below.`,
        ),
      ],
      [
        h.defs(
          [],
          (["idle", "available", "last"] as const).map((tone) =>
            h.marker(
              [
                h.Id(`docs-arrow-${explorer.id}-${tone}`),
                h.ViewBox("0 0 10 10"),
                h.RefX("9"),
                h.RefY("5"),
                h.MarkerWidth("7"),
                h.MarkerHeight("7"),
                h.Orient("auto-start-reverse"),
              ],
              [h.path([h.D("M 1 1 L 9 5 L 1 9 z"), h.Class(`docs-arrow-${tone}`)])],
            ),
          ),
        ),
        ...edges.map(({ edge, label, tone }) =>
          h.path(
            [
              h.D(smoothPathForPoints(edge.points)),
              h.Class(`docs-edge docs-edge-${tone}`),
              h.MarkerEnd(`url(#docs-arrow-${explorer.id}-${tone})`),
            ],
            [h.title([], [label])],
          ),
        ),
        ...[...scene.nodes.values()].map((node) => {
          const isActive = node.id === state;
          return h.g(
            [h.Class(isActive ? "docs-node docs-node-active" : "docs-node")],
            [
              h.rect([
                h.X(String(node.x)),
                h.Y(String(node.y)),
                h.Width(String(node.width)),
                h.Height(String(node.height)),
                h.Rx("12"),
              ]),
              ...(node.id === explorer.initial
                ? [
                    h.circle([
                      h.Cx(String(node.x + 18)),
                      h.Cy(String(node.y + node.height / 2)),
                      h.R("3.5"),
                      h.Class("docs-node-initial"),
                    ]),
                  ]
                : []),
              h.text(
                [
                  h.X(String(node.x + node.width / 2)),
                  h.Y(String(node.y + node.height / 2 + 4.5)),
                  h.TextAnchor("middle"),
                  h.Class("docs-node-label"),
                ],
                [node.id],
              ),
            ],
          );
        }),
        ...edges.flatMap(({ edge, label, tone }) => {
          if (!edge.labelPosition) return [];
          const text = truncate(label);
          const width = text.length * 6.1 + 14;
          const { x, y } = edge.labelPosition;
          return [
            h.g(
              [h.Class(`docs-edge-label docs-edge-label-${tone}`)],
              [
                h.rect([
                  h.X(String(x - width / 2)),
                  h.Y(String(y - 10)),
                  h.Width(String(width)),
                  h.Height("20"),
                  h.Rx("10"),
                ]),
                h.text([h.X(String(x)), h.Y(String(y + 3.5)), h.TextAnchor("middle")], [text]),
              ],
            ),
          ];
        }),
      ],
    ),
    h.div(
      [...c(h, "legend"), h.AriaHidden(true)],
      [
        h.span([], [h.i(c(h, "legend-swatch", "legend-active"), []), "Current state"]),
        h.span([], [h.i(c(h, "legend-line", "legend-available"), []), "Available"]),
        h.span([], [h.i(c(h, "legend-line", "legend-last"), []), "Last transition"]),
        h.span([], [h.i(c(h, "legend-dot"), []), "Initial"]),
      ],
    ),
  ]);
};

// State machine explorer

const explorerView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const explorer = explorers.find((item) => item.id === model.explorer) ?? explorers[0]!;
  const snapshot = explorer.replay(model.events);
  const last = snapshot.trace.at(-1);
  return h.section(
    [...c(h, "explorer"), h.Id("state-machine")],
    [
      h.header(c(h, "explorer-header"), [
        h.div(c(h, "explorer-title"), [
          h.span(c(h, "explorer-icon"), [Icon.view({ icon: GitBranch, size: 16 }, h)]),
          h.div(
            [],
            [
              h.h2([], ["State machine explorer"]),
              h.p([], [`${explorer.states.length} states · ${explorer.events.length} messages`]),
            ],
          ),
        ]),
        h.div(c(h, "explorer-controls"), [
          Badge.view({ label: "Real reducer", tone: "success", dot: true }, h),
          Select.control(
            {
              value: explorer.id,
              ariaLabel: "Reducer to explore",
              options: explorers.map((item) => ({ value: item.id, label: item.title })),
              onChange: (id) => Message.SelectedExplorer({ id }),
            },
            h,
          ),
          h.button(
            [
              ...c(h, "icon-button"),
              h.Type("button"),
              h.AriaLabel("Reset"),
              h.Title("Reset to the initial state"),
              h.OnClick(Message.Reset()),
              ...(model.events.length ? [] : [h.Disabled(true)]),
            ],
            [Icon.view({ icon: RotateCcw, size: 14 }, h)],
          ),
        ]),
      ]),
      h.p(c(h, "explorer-description"), [explorer.description]),
      diagram(explorer, snapshot.state, last, h),
      h.div(c(h, "explorer-panel"), [
        h.div(c(h, "events"), [
          h.div(c(h, "panel-heading"), [
            h.h3([], ["Send a message"]),
            h.p(
              [h.Role("status"), h.AriaLive("polite"), ...c(h, "sr-only")],
              [`Current state: ${snapshot.state}`],
            ),
          ]),
          h.div(c(h, "current-state"), [
            h.span(c(h, "current-dot"), []),
            h.span([], ["Current state"]),
            h.strong([], [snapshot.state]),
          ]),
          h.div(
            c(h, "event-list"),
            explorer.events.map((event) => {
              const next = explorer.replay([...model.events, event]).state;
              const changes = next !== snapshot.state;
              return h.button(
                [
                  ...c(h, "event", ...(changes ? [] : ["event-noop"])),
                  h.Type("button"),
                  h.AriaLabel(event),
                  h.OnClick(Message.SentEvent({ event })),
                ],
                [
                  h.code([], [event]),
                  h.span(
                    c(h, "event-target"),
                    changes ? [Icon.view({ icon: ArrowRight, size: 12 }, h), next] : ["No change"],
                  ),
                ],
              );
            }),
          ),
        ]),
        h.div(c(h, "model-panel"), [
          CodeBlock.view(
            {
              title: "Current model",
              language: "json",
              highlight,
              code: JSON.stringify(snapshot.model, null, 2),
              wrap: true,
              maxHeight: "300px",
            },
            h,
          ),
        ]),
      ]),
      h.div(c(h, "trace"), [
        h.div(c(h, "panel-heading"), [
          h.h3([], ["Message trace"]),
          h.span(c(h, "muted"), [
            snapshot.trace.length
              ? `${snapshot.trace.length} message${snapshot.trace.length === 1 ? "" : "s"}${snapshot.trace.length > 8 ? " · showing last 8" : ""}`
              : "Send a message to record a trace",
          ]),
        ]),
        ...(snapshot.trace.length
          ? [
              h.ol(
                c(h, "trace-list"),
                snapshot.trace.slice(-8).map((item, index, items) =>
                  h.li(c(h, "trace-row", ...(index === items.length - 1 ? ["trace-latest"] : [])), [
                    h.span(c(h, "trace-index"), [
                      String(snapshot.trace.length - items.length + index + 1),
                    ]),
                    h.code([], [item.event]),
                    h.span(c(h, "trace-path"), [
                      item.from === item.to
                        ? `${item.from} (unchanged)`
                        : `${item.from} → ${item.to}`,
                    ]),
                    ...(item.commands
                      ? [
                          Badge.view(
                            {
                              label: `${item.commands} command${item.commands === 1 ? "" : "s"}`,
                              tone: "info",
                            },
                            h,
                          ),
                        ]
                      : []),
                    ...(item.outMessage
                      ? [
                          Badge.view(
                            { label: `out ${item.outMessage}`, tone: "accent", mono: true },
                            h,
                          ),
                        ]
                      : []),
                  ]),
                ),
              ),
            ]
          : []),
      ]),
      h.details(c(h, "details"), [
        h.summary(
          [],
          [`All ${explorer.transitions.length} transitions, including unchanged states`],
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
                    ["From", "Message", "To", "Commands", "Out message"].map((label) =>
                      h.th([h.Scope("col")], [label]),
                    ),
                  ),
                ],
              ),
              h.tbody(
                [],
                explorer.transitions.map((item) =>
                  h.tr(item.from === snapshot.state ? c(h, "row-current") : [], [
                    h.td([], [item.from]),
                    h.td([], [h.code([], [item.event])]),
                    h.td(item.from === item.to ? c(h, "muted") : [], [item.to]),
                    h.td([], [String(item.commands)]),
                    h.td([], [item.outMessage ? h.code([], [item.outMessage]) : "—"]),
                  ]),
                ),
              ),
            ],
          ),
        ]),
      ]),
    ],
  );
};

// Module reference

const contractTitle = (kind: ModuleDoc["contracts"][number]["kind"]) =>
  kind === "model" ? "Model schema" : kind === "outMessages" ? "Outgoing messages" : "Messages";

const symbolView = (module: ModuleDoc, symbol: ApiSymbol, index: number, h: HtmlBuilder<Message>) =>
  h.article(
    [...c(h, "symbol"), h.Id(`symbol-${index}`)],
    [
      h.div(c(h, "symbol-heading"), [
        h.h3([], [symbol.name]),
        Badge.view({ label: symbol.kind, tone: kindTones[symbol.kind], variant: "outline" }, h),
        externalLink(h, `L${symbol.line}`, sourceUrl(module.path, symbol.line)),
      ]),
      ...(symbol.description ? [h.p(c(h, "symbol-description"), [symbol.description])] : []),
      CodeBlock.view(
        {
          code: symbol.signature,
          language: "typescript",
          highlight,
          wrap: true,
          maxHeight: "360px",
          ariaLabel: `${symbol.name} signature`,
        },
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
                  highlight,
                  maxHeight: "480px",
                  lineNumbers: true,
                  ariaLabel: `${symbol.name} declaration`,
                },
                h,
              ),
            ]),
          ]
        : []),
    ],
  );

const moduleView = (pkg: PackageDoc, module: ModuleDoc, h: HtmlBuilder<Message>): Html =>
  h.div(
    [],
    [
      h.header(c(h, "page-header"), [
        h.div(c(h, "eyebrow"), ["Module"]),
        h.div(c(h, "title-row"), [h.h1(c(h, "mono-title"), [module.id])]),
        h.div(c(h, "meta"), [
          h.code([], [module.path]),
          h.span([], [`${module.symbols.length} exports`]),
          ...module.contracts.map((contract) =>
            h.span([], [`${contract.fields.length} ${contractTitle(contract.kind).toLowerCase()}`]),
          ),
          externalLink(h, "View source", sourceUrl(module.path)),
        ]),
      ]),
      ...module.contracts.map((contract) =>
        h.section(
          [...c(h, "card"), h.Id(`contract-${contract.kind}`)],
          [
            h.div(c(h, "card-header"), [
              h.h3([], [contractTitle(contract.kind)]),
              Badge.view({ label: String(contract.fields.length), tone: "muted" }, h),
            ]),
            h.table(c(h, "contract-table"), [
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
                      h.td([], [h.code(c(h, "field-name"), [field.name])]),
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
            ]),
          ],
        ),
      ),
      h.div(
        [...c(h, "section-title"), h.Id("exported-api")],
        [
          h.h2([], ["Exported API"]),
          Badge.view({ label: String(module.symbols.length), tone: "muted" }, h),
        ],
      ),
      ...module.symbols.map((symbol, index) => symbolView(module, symbol, index, h)),
      ...(module.imports.length
        ? [
            h.section(
              [...c(h, "section"), h.Id("imports")],
              [
                h.h2([], ["Imports & re-exports"]),
                h.div(
                  c(h, "chips"),
                  module.imports.map((item) =>
                    item.startsWith("@foldworks/")
                      ? link(
                          h,
                          item,
                          docsPath(item.slice("@foldworks/".length).split("/")[0]),
                          "chip-link",
                        )
                      : h.code([], [item]),
                  ),
                ),
              ],
            ),
          ]
        : []),
      h.nav(
        c(h, "pager"),
        [-1, 1].flatMap((offset) => {
          const index = pkg.modules.indexOf(module) + offset;
          const target = pkg.modules[index];
          return target
            ? [
                h.a(
                  [
                    ...c(h, offset < 0 ? "pager-prev" : "pager-next"),
                    h.Href(docsPath(pkg.id, target.id)),
                  ],
                  [h.span([], [offset < 0 ? "Previous" : "Next"]), h.strong([], [target.id])],
                ),
              ]
            : [h.span([], [])];
        }),
      ),
    ],
  );

const readmeView = (pkg: PackageDoc, h: HtmlBuilder<Message>): Html =>
  h.div(
    [...c(h, "markdown"), h.Id("guide")],
    viewBlocks(decodeDocument(pkg.readme), {
      views: {
        CodeBlock: (block) => {
          const language = languageOf(Option.getOrUndefined(block.maybeLanguage));
          return CodeBlock.view(
            {
              code: block.value,
              wrap: false,
              maxHeight: "500px",
              highlight,
              ...(language ? { language, title: language } : {}),
            },
            h,
          );
        },
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

const packageHome = (pkg: PackageDoc, model: Model, h: HtmlBuilder<Message>): Html => {
  const internal = pkg.dependencies.filter((item) => item.startsWith("@foldworks/"));
  return h.div(
    [],
    [
      h.header(c(h, "page-header"), [
        h.div(c(h, "title-row"), [
          h.span(c(h, "package-mark"), [Icon.view({ icon: packageIcon(pkg.id), size: 22 }, h)]),
          h.div(c(h, "title-copy"), [
            h.h1([], [pkg.name]),
            h.p(c(h, "lead-small"), [pkg.description]),
          ]),
        ]),
        h.div(
          [...c(h, "install"), h.Id("install")],
          [h.span(c(h, "install-prompt"), ["$"]), h.code([], [`pnpm add ${pkg.name}`])],
        ),
        h.dl(c(h, "facts"), [
          h.div([], [h.dt([], ["Version"]), h.dd([], [pkg.version])]),
          h.div([], [h.dt([], ["Modules"]), h.dd([], [String(pkg.modules.length)])]),
          h.div([], [h.dt([], ["Entrypoints"]), h.dd([], [String(pkg.entrypoints.length)])]),
          h.div(
            [],
            [
              h.dt([], ["Source"]),
              h.dd([], [externalLink(h, `packages/${pkg.id}`, sourceUrl(`packages/${pkg.id}`))]),
            ],
          ),
        ]),
      ]),
      ...(pkg.id === "sidebar" || pkg.id === "ui" ? [explorerView(model, h)] : []),
      readmeView(pkg, h),
      h.section(
        [...c(h, "section"), h.Id("entrypoints")],
        [
          h.h2([], ["Package entrypoints"]),
          h.div(
            c(h, "chips"),
            pkg.entrypoints.map((item) => h.code([], [item])),
          ),
        ],
      ),
      h.section(
        [...c(h, "section"), h.Id("dependencies")],
        [
          h.h2([], ["Dependencies"]),
          ...(internal.length
            ? [
                h.div(
                  c(h, "dependency-grid"),
                  internal.map((item) => {
                    const id = item.slice("@foldworks/".length);
                    return h.a(
                      [...c(h, "dependency"), h.Href(docsPath(id))],
                      [Icon.view({ icon: packageIcon(id), size: 15 }, h), h.span([], [item])],
                    );
                  }),
                ),
              ]
            : []),
          h.div(
            c(h, "chips"),
            pkg.dependencies
              .filter((item) => !item.startsWith("@foldworks/"))
              .map((item) => h.code([], [item])),
          ),
        ],
      ),
    ],
  );
};

const moduleNav = (pkg: PackageDoc, moduleId: string, model: Model, h: HtmlBuilder<Message>) => {
  const query = model.moduleQuery.toLowerCase().trim();
  const modules = pkg.modules.filter((item) => item.id.toLowerCase().includes(query));
  const groups = new Map<string, ModuleDoc[]>();
  for (const item of modules) {
    const slash = item.id.lastIndexOf("/");
    const group = slash === -1 ? "" : item.id.slice(0, slash);
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  const moduleLink = (item: ModuleDoc, label: string) =>
    link(
      h,
      label,
      docsPath(pkg.id, item.id),
      item.id === moduleId ? "module-active" : "module-link",
    );
  return h.nav(
    [...c(h, "module-nav"), h.AriaLabel("Module reference")],
    [
      h.a(
        [...c(h, "module-nav-package"), h.Href(docsPath(pkg.id))],
        [Icon.view({ icon: packageIcon(pkg.id), size: 15 }, h), h.span([], [pkg.id])],
      ),
      link(
        h,
        "Overview & usage",
        docsPath(pkg.id),
        moduleId === "" ? "module-active" : "module-link",
      ),
      ...(pkg.modules.length > 12
        ? [
            InputGroup.view(
              {
                prefix: [Icon.view({ icon: Search, size: 13 }, h)],
                control: InputGroup.input(
                  {
                    value: model.moduleQuery,
                    ariaLabel: "Filter modules",
                    placeholder: `Filter ${pkg.modules.length} modules`,
                    onInput: (query) => Message.FilteredModules({ query }),
                  },
                  h,
                ),
              },
              h,
            ),
          ]
        : []),
      ...[...groups.entries()].flatMap(([group, items]) => [
        h.div(c(h, "nav-group"), [group ? `${group}/` : "Modules"]),
        ...items.map((item) => moduleLink(item, group ? item.id.slice(group.length + 1) : item.id)),
      ]),
      ...(modules.length ? [] : [h.p(c(h, "muted", "nav-empty"), ["No modules match."])]),
    ],
  );
};

const packageView = (
  pkg: PackageDoc,
  moduleId: string,
  model: Model,
  h: HtmlBuilder<Message>,
): Html => {
  const module = pkg.modules.find((item) => item.id === moduleId);
  const hasExplorer = pkg.id === "sidebar" || pkg.id === "ui";
  const rail = module
    ? onThisPage(h, [
        ...module.contracts.map((contract) => ({
          id: `contract-${contract.kind}`,
          label: contractTitle(contract.kind),
        })),
        { id: "exported-api", label: "Exported API" },
        ...module.symbols.map((symbol, index) => ({
          id: `symbol-${index}`,
          label: symbol.name,
          depth: 1,
        })),
        ...(module.imports.length ? [{ id: "imports", label: "Imports & re-exports" }] : []),
      ])
    : moduleId
      ? undefined
      : onThisPage(h, [
          { id: "install", label: "Install" },
          ...(hasExplorer ? [{ id: "state-machine", label: "State machine explorer" }] : []),
          { id: "guide", label: "Guide" },
          { id: "entrypoints", label: "Entrypoints" },
          { id: "dependencies", label: "Dependencies" },
        ]);
  return h.div(c(h, "package-layout"), [
    moduleNav(pkg, moduleId, model, h),
    h.article(
      [...c(h, "article"), h.Id("docs-top")],
      [
        breadcrumbs(h, [
          ["Docs", docsPath()],
          ...(moduleId
            ? [[pkg.name, docsPath(pkg.id)] as const, [moduleId] as const]
            : [[pkg.name] as const]),
        ]),
        moduleId && !module
          ? h.div(c(h, "empty"), [
              h.h2([], ["Module not found"]),
              paragraph(h, `${pkg.name} has no public module named “${moduleId}”.`),
              link(h, "Back to package overview", docsPath(pkg.id)),
            ])
          : module
            ? moduleView(pkg, module, h)
            : packageHome(pkg, model, h),
      ],
    ),
    ...(rail ? [rail] : []),
  ]);
};

// Overview

const packageCard = (pkg: PackageDoc, query: string, h: HtmlBuilder<Message>) =>
  h.a(
    [...c(h, "package-card"), h.Href(docsPath(pkg.id))],
    [
      h.div(c(h, "card-top"), [
        h.span(c(h, "package-mark", "package-mark-small"), [
          Icon.view({ icon: packageIcon(pkg.id), size: 17 }, h),
        ]),
        h.h3([], [pkg.id]),
        Icon.view({ icon: ArrowRight, size: 15 }, h),
      ]),
      h.p([], [pkg.description]),
      h.div(c(h, "card-footer"), [
        h.code([], [pkg.name]),
        h.span([], [`${pkg.modules.length} module${pkg.modules.length === 1 ? "" : "s"}`]),
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
  );

const overview = (model: Model, h: HtmlBuilder<Message>): Html => {
  const query = model.query.toLowerCase().trim();
  const matches = catalog.filter((pkg) =>
    `${pkg.name} ${pkg.description} ${pkg.modules.map((module) => `${module.id} ${module.symbols.map((symbol) => symbol.name).join(" ")}`).join(" ")}`
      .toLowerCase()
      .includes(query),
  );
  return h.div(c(h, "overview"), [
    h.header(c(h, "hero"), [
      h.div(c(h, "eyebrow"), ["Foldworks documentation"]),
      h.h1(c(h, "hero-title"), ["Understand the pieces.\nBuild the whole."]),
      h.p(c(h, "lead"), [
        "Explore the modules, follow the messages, and watch state change. A living reference generated from the code you actually ship.",
      ]),
      h.div(c(h, "hero-stats"), [
        h.div([], [h.strong([], [String(catalog.length)]), h.span([], ["packages"])]),
        h.div([], [h.strong([], [String(moduleCount)]), h.span([], ["source modules"])]),
        h.div([], [h.strong([], [String(explorers.length)]), h.span([], ["live state machines"])]),
      ]),
      h.div(c(h, "search"), [
        InputGroup.view(
          {
            prefix: [Icon.view({ icon: Search, size: 16 }, h)],
            control: InputGroup.input(
              {
                value: model.query,
                ariaLabel: "Search documentation",
                placeholder: "Search packages, modules, or exports…",
                onInput: (query) => Message.Searched({ query }),
              },
              h,
            ),
          },
          h,
        ),
        h.div(
          [h.Role("status"), h.AriaLive("polite"), ...c(h, "search-status")],
          [query ? `${matches.length} matching package${matches.length === 1 ? "" : "s"}` : ""],
        ),
      ]),
    ]),
    ...(query
      ? [
          h.div(
            c(h, "package-grid"),
            matches.map((pkg) => packageCard(pkg, query, h)),
          ),
          ...(matches.length
            ? []
            : [
                h.div(c(h, "empty"), [
                  h.h2([], ["No matches"]),
                  paragraph(h, "Try a component name such as Button or EditableText."),
                ]),
              ]),
        ]
      : groupPackages(catalog).map((group) =>
          h.section(c(h, "package-group"), [
            h.div(c(h, "group-heading"), [
              h.h2([], [group.title]),
              h.span([], [String(group.packages.length)]),
            ]),
            h.div(
              c(h, "package-grid"),
              group.packages.map((pkg) => packageCard(pkg, query, h)),
            ),
          ]),
        )),
    h.div(c(h, "overview-explorer"), [
      h.div(c(h, "group-heading"), [h.h2([], ["See it run"])]),
      paragraph(
        h,
        "Every edge below was discovered by executing the package's own update function. Send messages and watch the model change.",
      ),
      explorerView(model, h),
    ]),
    h.section(c(h, "generation-note"), [
      h.h2([], ["Documentation that follows the code"]),
      paragraph(
        h,
        "Package metadata, public source modules, JSDoc, schemas, and messages are discovered automatically. READMEs provide the usage guides. Reducer explorers use explicit event samples and state projections; add an adapter to document another interaction.",
      ),
      externalLink(h, "Download the generated catalog", "/docs/manifest.json"),
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
              h.div(c(h, "empty"), [
                h.h1([], ["Package not found"]),
                paragraph(h, `There is no Foldworks package named “${viewInputs.packageId}”.`),
                link(h, "Browse all packages", docsPath()),
              ]),
            ])
          : pkg
            ? packageView(pkg, viewInputs.moduleId, model, h)
            : overview(model, h),
      ],
    );
  },
);
