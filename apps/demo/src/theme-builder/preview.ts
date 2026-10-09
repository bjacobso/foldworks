import type { Html, HtmlBuilder } from "foldkit/html";
import {
  Activity,
  ArrowUpRight,
  Bell,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  Plus,
  Settings,
  Users,
  Zap,
} from "@lucide/icons";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Chart,
  Checkbox,
  Field,
  Icon,
  Popover,
  Sidebar,
  Stat,
  Switch,
  Table,
} from "@foldworks/ui";
import { Message } from "./message";
import type { Model } from "./model";
import type { Mode, Tokens } from "./contract";
import { className, styles } from "./styles";

export const preview = (
  model: Model,
  mode: Mode,
  tokens: Tokens,
  h: HtmlBuilder<Message>,
): Html => {
  const action = (value: string) => Message.PreviewAction({ value });
  const button = (
    label: string,
    variant: "primary" | "secondary" | "outline" | "danger" | "ghost" = "primary",
  ) => Button.view({ label, variant, size: "sm", onClick: action(label) }, h);
  const invoices = [
    ["INV-1042", "Linear", "Pro plan", "Paid", "$240.00"],
    ["INV-1041", "Vercel", "Team plan", "Pending", "$180.00"],
    ["INV-1040", "Figma", "Pro plan", "Paid", "$320.00"],
  ] as const;
  return h.div(
    [
      h.Class(className(styles.frame)),
      h.DataAttribute("theme", "custom"),
      h.DataAttribute("mode", mode),
      h.DataAttribute("theme-preview", mode),
      h.Style({
        ...Object.fromEntries(Object.entries(tokens).map(([name, value]) => [`--${name}`, value])),
        colorScheme: mode,
      }),
    ],
    [
      h.div(
        [h.Class(className(styles.frameBar))],
        [
          h.div(
            [h.Class(className(styles.dots)), h.AriaHidden(true)],
            [0, 1, 2].map(() => h.span([h.Class(className(styles.dot))])),
          ),
          h.span([], ["acme.app / overview"]),
          h.span([], [mode === "light" ? "Light" : "Dark"]),
        ],
      ),
      h.div(
        [h.Class(className(styles.product))],
        [
          Sidebar.view(
            {
              ariaLabel: `${mode} preview navigation`,
              sx: styles.sidebar,
              header: [
                h.div(
                  [h.Class(className(styles.brand))],
                  [
                    h.span(
                      [h.Class(className(styles.brandIcon))],
                      [Icon.view({ icon: Zap, size: 15 }, h)],
                    ),
                    "Acme",
                  ],
                ),
                Badge.view({ label: "Pro workspace", tone: "muted" }, h),
              ],
              groups: [
                {
                  label: "Workspace",
                  items: [
                    {
                      label: "Overview",
                      media: Icon.view({ icon: LayoutDashboard, size: 14 }, h),
                      isCurrent: true,
                      onClick: action("Overview"),
                    },
                    {
                      label: "Customers",
                      media: Icon.view({ icon: Users, size: 14 }, h),
                      count: 24,
                      onClick: action("Customers"),
                    },
                    {
                      label: "Transactions",
                      media: Icon.view({ icon: CreditCard, size: 14 }, h),
                      onClick: action("Transactions"),
                    },
                    {
                      label: "Activity",
                      media: Icon.view({ icon: Activity, size: 14 }, h),
                      onClick: action("Activity"),
                    },
                  ],
                },
                {
                  label: "Manage",
                  items: [
                    {
                      label: "Settings",
                      media: Icon.view({ icon: Settings, size: 14 }, h),
                      onClick: action("Settings"),
                    },
                    {
                      label: "Help & support",
                      media: Icon.view({ icon: CircleHelp, size: 14 }, h),
                      onClick: action("Help & support"),
                    },
                  ],
                },
              ],
              footer: [
                h.div(
                  [h.Class(className(styles.sidebarFooter))],
                  [
                    h.div(
                      [h.Class(className(styles.avatarRow))],
                      [
                        Avatar.view({ alt: "Alex Morgan", fallback: "AM", size: "sm" }, h),
                        h.div(
                          [],
                          [
                            h.strong([], ["Alex Morgan"]),
                            h.p([h.Class(className(styles.hint))], ["Workspace owner"]),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            },
            h,
          ),
          h.div(
            [h.Class(className(styles.dashboard))],
            [
              h.div(
                [h.Class(className(styles.split))],
                [
                  h.div(
                    [],
                    [
                      h.p([h.Class(className(styles.eyebrow))], ["Your workspace, at a glance"]),
                      h.h2([h.Class(className(styles.productTitle))], ["Overview"]),
                    ],
                  ),
                  h.div(
                    [h.Class(className(styles.productHeader))],
                    [
                      Popover.view(
                        {
                          id: `${mode}-notifications`,
                          sx: styles.popover,
                          trigger: [Icon.view({ icon: Bell, size: 13 }, h), " Notifications"],
                          isOpen: model.popoverOpen,
                          onOpenChange: (value) => Message.ToggledPopover({ value }),
                          ariaLabel: `${mode} workspace notifications`,
                          content: [
                            h.div(
                              [h.Class(className(styles.popoverContent))],
                              [
                                h.strong([], ["Looking good, Alex"]),
                                h.span(
                                  [h.Class(className(styles.hint))],
                                  ["Your workspace is ready for the next big thing."],
                                ),
                                Badge.view(
                                  { label: "All systems operational", tone: "success" },
                                  h,
                                ),
                              ],
                            ),
                          ],
                        },
                        h,
                      ),
                      Button.view(
                        {
                          label: "New invoice",
                          icon: Plus,
                          size: "sm",
                          onClick: action("New invoice"),
                        },
                        h,
                      ),
                    ],
                  ),
                ],
              ),
              h.div(
                [h.Class(className(styles.stats))],
                [
                  ["Total revenue", "$24,580", "12.8%"],
                  ["Active customers", "1,284", "8.2%"],
                  ["Conversion rate", "4.6%", "2.1%"],
                ].map(([label, value, delta]) =>
                  Card.view(
                    {
                      sx: styles.statCard,
                      slotProps: { content: { sx: styles.statContent } },
                      children: [
                        Stat.view(
                          {
                            label: label!,
                            value: value!,
                            variant: "plain",
                            size: "sm",
                            delta: { value: delta!, trend: "up", label: "this month" },
                            slotProps: { value: { sx: styles.statValue } },
                          },
                          h,
                        ),
                      ],
                    },
                    h,
                  ),
                ),
              ),
              h.div(
                [h.Class(className(styles.middle))],
                [
                  Card.view(
                    {
                      title: "Revenue",
                      description: "A little growth, every month.",
                      sx: styles.card,
                      action: [Badge.view({ label: "Last 6 months", tone: "muted" }, h)],
                      children: [
                        Chart.view(
                          {
                            ariaLabel: "Monthly revenue by channel",
                            values: [34, 52, 43, 68, 60, 86, 74, 94, 82, 108],
                            max: 115,
                            sx: styles.chart,
                          },
                          h,
                        ),
                        h.div(
                          [h.Class(className(styles.chartLabels))],
                          ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((label) =>
                            h.span([], [label]),
                          ),
                        ),
                        h.div(
                          [h.Class(className(styles.chartLegend))],
                          ["Subscriptions", "Services", "Partners", "Add-ons", "Other"].map(
                            (label, index) =>
                              h.span(
                                [],
                                [
                                  h.span([
                                    h.Class(className(styles.legendDot)),
                                    h.Style({ backgroundColor: `var(--chart-${index + 1})` }),
                                  ]),
                                  label,
                                ],
                              ),
                          ),
                        ),
                        h.div(
                          [h.Class(className(styles.reviewRow))],
                          [
                            h.span([h.Class(className(styles.hint))], ["Monthly target"]),
                            Badge.view({ label: "On track", tone: "success" }, h),
                          ],
                        ),
                        Alert.view(
                          {
                            title: "You're all caught up",
                            description: "Your latest payouts have arrived.",
                            sx: styles.notice,
                            children: [],
                          },
                          h,
                        ),
                      ],
                    },
                    h,
                  ),
                  Card.view(
                    {
                      title: "Workspace settings",
                      description: "Make this space your own.",
                      sx: styles.card,
                      children: [
                        h.div(
                          [h.Class(className(styles.stack))],
                          [
                            Field.input(
                              {
                                id: `${mode}-workspace`,
                                label: "Workspace name",
                                value: model.projectName,
                                onInput: (value) => Message.ChangedProjectName({ value }),
                              },
                              h,
                            ),
                            Field.select(
                              {
                                id: `${mode}-currency`,
                                label: "Billing currency",
                                value: model.currency,
                                options: [
                                  { value: "usd", label: "USD · US Dollar" },
                                  { value: "eur", label: "EUR · Euro" },
                                  { value: "gbp", label: "GBP · British Pound" },
                                ],
                                onChange: (value) => Message.ChangedCurrency({ value }),
                              },
                              h,
                            ),
                            Switch.view(
                              {
                                id: `${mode}-updates`,
                                label: "Email notifications",
                                isChecked: model.updates,
                                onToggle: (value) => Message.ToggledUpdates({ value }),
                              },
                              h,
                            ),
                            Checkbox.view(
                              {
                                id: `${mode}-approved`,
                                label: "Include tax on invoices",
                                isChecked: model.approved,
                                onToggle: (value) => Message.ToggledApproved({ value }),
                              },
                              h,
                            ),
                            h.div(
                              [h.Class(className(styles.row))],
                              [
                                button("Save changes"),
                                button("Cancel", "secondary"),
                                button("Preview", "outline"),
                                button("Delete", "danger"),
                              ],
                            ),
                          ],
                        ),
                      ],
                    },
                    h,
                  ),
                ],
              ),
              Card.view(
                {
                  title: "Recent invoices",
                  description: "A good month for good work.",
                  sx: styles.card,
                  flush: true,
                  action: [button("View all", "ghost")],
                  children: [
                    h.div(
                      [h.Class(className(styles.table))],
                      [
                        Table.view(
                          {
                            caption: "Recent customer invoices",
                            slotProps: { caption: { sx: styles.tableCaption } },
                            rowHeaders: true,
                            columns: [
                              "Invoice",
                              "Customer",
                              "Status",
                              { label: "Amount", align: "end" },
                            ],
                            rows: invoices.map(([id, name, plan, status, amount]) => ({
                              key: id,
                              cells: [
                                id,
                                h.div(
                                  [],
                                  [
                                    h.strong([], [name]),
                                    h.p([h.Class(className(styles.hint))], [plan]),
                                  ],
                                ),
                                Badge.view(
                                  {
                                    label: status,
                                    tone: status === "Paid" ? "success" : "warning",
                                  },
                                  h,
                                ),
                                amount,
                              ],
                              isSelected: model.selectedRow === id,
                              onClick: Message.SelectedRow({ value: id }),
                              ariaLabel: `Select ${id}`,
                            })),
                          },
                          h,
                        ),
                      ],
                    ),
                  ],
                },
                h,
              ),
              h.div(
                [h.Class(className(styles.split))],
                [
                  Button.view(
                    {
                      label: "View reports",
                      variant: "ghost",
                      size: "sm",
                      icon: ArrowUpRight,
                      onClick: action("View reports"),
                    },
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
};
