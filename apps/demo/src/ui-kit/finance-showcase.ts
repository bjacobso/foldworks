import { type Html, type HtmlBuilder } from "foldkit/html";
import type { LucideIconData } from "@lucide/icons";

import {
  Bell,
  CalendarDays,
  Check,
  FileText,
  Folder,
  Inbox,
  Plus,
  Settings,
  User,
  X,
} from "@lucide/icons";
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Chart,
  Empty,
  Field,
  Icon,
  InputGroup,
  Label,
  Progress,
  Sidebar,
  Slider,
  Switch,
  Textarea,
} from "@foldworks/ui";

import { Message } from "./message";
import type { Model } from "./model";
import { financeStyles as styles } from "./finance-styles";
import { className } from "./styles";

const button = (label: string, h: HtmlBuilder<Message>, variant: "primary" | "outline" | "ghost" = "primary") =>
  Button.view({
    label,
    variant,
    style: styles.pillButton,
    onClick: Message.ClickedAction({ action: label }),
  }, h);

const cardAction = (label: string, h: HtmlBuilder<Message>) =>
  Button.view({
    label,
    variant: "outline",
    size: "sm",
    style: styles.pillButton,
    onClick: Message.ClickedAction({ action: label }),
  }, h);

const iconAction = (label: string, icon: LucideIconData, h: HtmlBuilder<Message>) =>
  Button.view({
    icon,
    ariaLabel: label,
    variant: "ghost",
    size: "icon",
    style: styles.pillButton,
    onClick: Message.ClickedAction({ action: label }),
  }, h);

const contributionHistory = (h: HtmlBuilder<Message>): Html => Card.view({
  title: "Contribution History",
  description: "Last 6 months of activity",
  style: [styles.card, styles.tallCard],
  children: [h.div([h.Class(className(styles.cardStack))], [
    h.div([h.Class(className(styles.chartWrap))], [
      Chart.view({
        ariaLabel: "Monthly contribution history",
        values: [48, 66, 54, 78, 45, 84],
        max: 90,
        style: styles.chart,
      }, h),
      h.div([h.Class(className(styles.chartLabels))], ["Dec", "Jan", "Feb", "Mar", "Apr", "May"].map((month) => h.span([], [month]))),
    ]),
    h.div([h.Class(className(styles.statGrid))], [
      h.div([h.Class(className(styles.inset))], [
        h.span([h.Class(className(styles.insetLabel))], ["Upcoming"]),
        h.strong([h.Class(className(styles.insetValue))], ["May 25, 2024"]),
        h.span([h.Class(className(styles.muted))], ["$1,000 scheduled"]),
      ]),
      h.div([h.Class(className(styles.inset))], [
        h.span([h.Class(className(styles.insetLabel))], ["Auto-save plan"]),
        h.strong([h.Class(className(styles.insetValue))], ["Accelerated"]),
        h.span([h.Class(className(styles.muted))], ["Recurring weekly"]),
      ]),
    ]),
    button("View Full Report", h),
  ])],
}, h);

const payoutThreshold = (model: Model, h: HtmlBuilder<Message>): Html => Card.view({
  title: "Payout Threshold",
  description: "Set the minimum balance required before a payout is triggered.",
  action: [iconAction("Close payout settings", X, h)],
  style: [styles.card, styles.tallCard],
  children: [h.div([h.Class(className(styles.formStack))], [
    Field.select({
      id: "showcase-currency",
      label: "Preferred Currency",
      value: "usd",
      options: [
        { value: "usd", label: "USD — United States Dollar" },
        { value: "eur", label: "EUR — Euro" },
        { value: "gbp", label: "GBP — Pound Sterling" },
      ],
    }, h),
    h.div([h.Class(className(styles.formGroup))], [
      h.div([h.Class(className(styles.amountRow))], [
        h.span([h.Class(className(styles.label))], ["Minimum Payout Amount"]),
        h.strong([h.Class(className(styles.amount))], [`$${(model.sliderValue * 100).toLocaleString()}.00`]),
      ]),
      Slider.view({
        value: model.sliderValue,
        min: 1,
        max: 100,
        ariaLabel: "Minimum payout amount",
        onChange: (value) => Message.ChangedSlider({ value }),
      }, h),
      h.div([h.Class(className(styles.rangeLabels))], [h.span([], ["$50 (MIN)"]), h.span([], ["$10,000 (MAX)"])]),
    ]),
    h.div([h.Class(className(styles.formGroup))], [
      Label.view({ for: "showcase-payout-notes", children: ["Notes"] }, h),
      Textarea.view({
        id: "showcase-payout-notes",
        rows: 3,
        placeholder: "Add any notes for this payout configuration…",
      }, h),
    ]),
    button("Save Threshold", h),
  ])],
}, h);

const target = (label: string, amount: string, achieved: number, balance: string, h: HtmlBuilder<Message>) =>
  h.div([h.Class(className(styles.target))], [
    h.span([h.Class(className(styles.insetLabel))], [label]),
    h.strong([h.Class(className(styles.targetAmount))], [amount]),
    Progress.view({ value: achieved, ariaLabel: `${label} savings progress` }, h),
    h.div([h.Class(className(styles.split))], [
      h.span([h.Class(className(styles.muted))], [`${achieved}% achieved`]),
      h.span([h.Class(className(styles.value))], [balance]),
    ]),
  ]);

const savingsTargets = (h: HtmlBuilder<Message>): Html => Card.view({
  title: "Savings Targets",
  description: "Active milestones for 2024",
  action: [cardAction("New Goal", h)],
  style: [styles.card, styles.tallCard],
  children: [h.div([h.Class(className(styles.cardStack))], [
    target("Retirement", "$420,000", 65, "$273,000", h),
    target("Real Estate", "$85,000", 32, "$27,200", h),
    h.p([h.Class(className(styles.muted))], ["You have not met your targets for this year."]),
  ])],
}, h);

const buyInvestment = (h: HtmlBuilder<Message>): Html => Card.view({
  title: "Buy Investment",
  style: [styles.card, styles.tallCard],
  children: [h.div([h.Class(className(styles.formStack))], [
    h.div([h.Class(className(styles.formGroup))], [
      Label.view({ for: "showcase-investment", children: ["Amount to Invest"] }, h),
      InputGroup.view({
        prefix: ["$"],
        control: InputGroup.input({ id: "showcase-investment", value: "1,000.00", ariaLabel: "Amount to Invest" }, h),
      }, h),
    ]),
    Field.select({
      id: "showcase-order-type",
      label: "Order Type",
      value: "market",
      description: "Market orders execute at the current price.",
      options: [
        { value: "market", label: "Market Order" },
        { value: "limit", label: "Limit Order" },
        { value: "stop", label: "Stop Order" },
      ],
    }, h),
    h.div([h.Class(className(styles.compactStack))], [
      h.div([h.Class(className(styles.split))], [h.span([h.Class(className(styles.muted))], ["Estimated Shares"]), h.strong([h.Class(className(styles.value))], ["1.95"])]),
      h.div([h.Class(className(styles.split))], [h.span([h.Class(className(styles.muted))], ["Buying Power"]), h.strong([h.Class(className(styles.value))], ["$12,450.00"])]),
    ]),
    button("Review Order", h),
    h.p([h.Class(className(styles.muted, styles.center))], ["Trades are typically executed within minutes during market hours."]),
  ])],
}, h);

const distributeTrack = (h: HtmlBuilder<Message>): Html => Card.view({
  style: styles.card,
  children: [Empty.view({
    title: "Distribute Track",
    description: "Upload your first master to start reaching listeners on Spotify, Apple Music, and more.",
    style: styles.empty,
    media: h.div([h.Class(className(styles.emptyMedia))], [Icon.view({ icon: Plus, size: 20 }, h)]),
    actions: [Button.view({
      label: "Create Release",
      style: styles.pillButton,
      onClick: Message.ClickedAction({ action: "Create Release" }),
    }, h)],
  }, h)],
}, h);

const claimableBalance = (h: HtmlBuilder<Message>): Html => Card.view({
  title: "Claimable Balance",
  style: styles.card,
  children: [h.div([h.Class(className(styles.cardStack))], [
    h.div([h.Class(className(styles.compactStack))], [
      h.strong([h.Class(className(styles.metric))], ["$0.00"]),
      h.div([], [Badge.view({ label: "Pending Setup", tone: "warning", dot: true }, h)]),
    ]),
    h.div([h.Class(className(styles.summary))], [
      h.div([h.Class(className(styles.split))], [h.span([h.Class(className(styles.muted))], ["Net Royalties"]), h.span([h.Class(className(styles.value))], ["$0.00"])]),
      h.div([h.Class(className(styles.split))], [h.span([h.Class(className(styles.muted))], ["Processing Fee"]), h.span([h.Class(className(styles.value))], ["-$0.00"])]),
      h.div([h.Class(className(styles.summaryRule))]),
      h.div([h.Class(className(styles.split))], [h.span([h.Class(className(styles.muted))], ["Total Ready to Claim"]), h.span([h.Class(className(styles.value))], ["$0.00 USD"])]),
    ]),
    h.p([h.Class(className(styles.muted))], ["Once your bank is connected, balances over $10.00 are automatically eligible for monthly distribution."]),
  ])],
}, h);

const transactions = [
  ["Blue Bottle Coffee", "Food & Drink", "Today, 10:24 AM", "-$6.50", FileText, false],
  ["Whole Foods Market", "Groceries", "Yesterday", "-$142.30", Folder, false],
  ["Stripe Payout", "Income", "Oct 12", "+$4,200.00", Inbox, true],
  ["Uber Technologies", "Transport", "Oct 11", "-$24.10", CalendarDays, false],
  ["Netflix Subscription", "Entertainment", "Oct 10", "-$19.99", Bell, false],
] as const;

const recentTransactions = (h: HtmlBuilder<Message>): Html => Card.view({
  title: "Recent Transactions",
  description: "Your latest account activity.",
  action: [cardAction("View All", h)],
  style: [styles.card, styles.spanTwo],
  children: [h.div([h.Class(className(styles.transactionList))], transactions.map(([name, category, date, amount, icon, isPositive], index) =>
    h.div([h.Class(className(styles.transaction, ...(index === transactions.length - 1 ? [styles.transactionLast] : [])))], [
      h.div([h.Class(className(styles.transactionIcon))], [Icon.view({ icon, size: 15 }, h)]),
      h.div([h.Class(className(styles.compactStack))], [
        h.span([h.Class(className(styles.transactionName))], [name]),
        h.span([h.Class(className(styles.transactionMeta))], [category]),
      ]),
      h.span([h.Class(className(styles.transactionMeta))], [date]),
      h.span([h.Class(className(styles.transactionAmount, ...(isPositive ? [styles.transactionPositive] : [])))], [amount]),
      iconAction(`More actions for ${name}`, Settings, h),
    ]),
  ))],
}, h);

const qrRows = [
  "111111101010111", "100000101110101", "101110101001101", "101110100111101", "101110101010101",
  "100000100100001", "111111101010111", "000000001110000", "101101111011101", "011010001010010",
  "110111101111011", "100010001001110", "111011101110101", "101000101011010", "111111101101111",
] as const;

const qrCard = (h: HtmlBuilder<Message>): Html => Card.view({
  title: "Quick Pay",
  description: "Scan to send or request funds.",
  style: styles.card,
  children: [h.div([h.Class(className(styles.cardStack))], [
    h.div([h.Class(className(styles.qrFrame))], [
      h.div([h.Class(className(styles.qr)), h.Role("img"), h.AriaLabel("Quick Pay code")], qrRows.flatMap((row) => [...row].map((cell) =>
        h.span([h.Class(className(styles.qrCell, ...(cell === "1" ? [styles.qrCellOn] : [])))]),
      ))),
    ]),
    h.p([h.Class(className(styles.muted, styles.center))], ["@northstar-studio"]),
  ])],
}, h);

const preferences = (model: Model, h: HtmlBuilder<Message>): Html => Card.view({
  title: "Preferences",
  description: "Manage your account settings and notifications.",
  action: [iconAction("Close preferences", X, h)],
  style: styles.card,
  children: [h.div([h.Class(className(styles.formStack))], [
    Switch.view({
      id: "showcase-product-updates",
      label: "Product updates",
      description: "Monthly account summary",
      isChecked: model.receivesUpdates,
      onToggle: (isChecked) => Message.ToggledUpdates({ isChecked }),
    }, h),
    Switch.view({
      id: "showcase-security-alerts",
      label: "Security alerts",
      description: "New sign-ins and changes",
      isChecked: model.securityAlerts,
      onToggle: (isChecked) => Message.ToggledSecurityAlerts({ isChecked }),
    }, h),
  ])],
}, h);

const navigationSamples = (h: HtmlBuilder<Message>): Html => Card.view({
  title: "Navigation",
  description: "Compact application wayfinding.",
  style: [styles.card, styles.spanTwo],
  children: [h.div([h.Class(className(styles.cardStack))], [
    h.div([h.Class(className(styles.navPair))], [
      Sidebar.view({
        ariaLabel: "Overview navigation",
        style: styles.miniSidebar,
        groups: [{
          label: "Overview",
          items: [
            { label: "Dashboard", href: "#dashboard", isCurrent: true, media: Icon.view({ icon: Inbox, size: 14 }, h) },
            { label: "Transactions", href: "#transactions", media: Icon.view({ icon: FileText, size: 14 }, h) },
            { label: "Analytics", href: "#analytics", media: Icon.view({ icon: CalendarDays, size: 14 }, h) },
          ],
        }],
      }, h),
      Sidebar.view({
        ariaLabel: "Account navigation",
        style: styles.miniSidebar,
        groups: [{
          label: "Account",
          items: [
            { label: "Profile", href: "#profile", media: Icon.view({ icon: User, size: 14 }, h) },
            { label: "Billing", href: "#billing", isCurrent: true, media: Icon.view({ icon: Folder, size: 14 }, h) },
            { label: "Security", href: "#security", media: Icon.view({ icon: Settings, size: 14 }, h) },
          ],
        }],
      }, h),
    ]),
    h.div([h.Class(className(styles.breadcrumbPanel))], [
      Breadcrumb.view({ items: [{ label: "Home", href: "#home" }, { label: "Finance", href: "#finance" }], current: "Payments", separator: "›" }, h),
      h.div([h.Class(className(styles.split))], [
        h.div([h.Class(className(styles.compactStack))], [
          h.strong([h.Class(className(styles.value))], ["Change transfer limit"]),
          h.span([h.Class(className(styles.muted))], ["Manage daily and monthly limits"]),
        ]),
        iconAction("Open transfer limits", Settings, h),
      ]),
    ]),
  ])],
}, h);

const portfolioSummary = (h: HtmlBuilder<Message>): Html =>
  h.div([h.Class(className(styles.spanTwo, styles.miniCards))], [
    Card.view({
      title: "Card Balance",
      style: styles.card,
      children: [h.div([h.Class(className(styles.compactStack))], [
        h.strong([h.Class(className(styles.miniMetric))], ["US$12.94"]),
        h.span([h.Class(className(styles.muted))], ["US$11,337.06 Available"]),
      ])],
    }, h),
    Card.view({
      title: "Yearly Activity",
      style: styles.card,
      children: [h.div([h.Class(className(styles.chartWrap))], [
        Chart.view({
          ariaLabel: "Yearly account activity",
          values: [28, 40, 31, 44, 35, 38, 50],
          max: 55,
          style: styles.miniChart,
        }, h),
        h.div([h.Class(className(styles.miniChartLabels))], ["J", "F", "M", "A", "M", "J", "J"].map((month) => h.span([], [month]))),
      ])],
    }, h),
  ]);

const accountAccess = (h: HtmlBuilder<Message>): Html => Card.view({
  title: "Account Access",
  description: "Update your credentials or review account status.",
  style: styles.card,
  children: [h.div([h.Class(className(styles.formStack))], [
    Field.input({ id: "showcase-account-email", label: "Email Address", value: "artist@studio.inc", type: "email" }, h),
    Field.input({ id: "showcase-password", label: "Current Password", value: "••••••••••••", type: "password" }, h),
    Button.view({
      label: "Update Security",
      icon: Check,
      style: styles.pillButton,
      onClick: Message.ClickedAction({ action: "Update Security" }),
    }, h),
    h.div([h.Class(className(styles.dangerZone))], [
      h.span([h.Class(className(styles.dangerIcon))], [Icon.view({ icon: X, size: 16 }, h)]),
      h.div([h.Class(className(styles.compactStack))], [
        h.strong([h.Class(className(styles.value))], ["Danger Zone"]),
        h.span([h.Class(className(styles.muted))], ["Archive account and remove access."]),
      ]),
    ]),
  ])],
}, h);

const transferFunds = (h: HtmlBuilder<Message>): Html => Card.view({
  title: "Transfer Funds",
  description: "Move money between your connected accounts.",
  style: styles.card,
  children: [h.div([h.Class(className(styles.formStack))], [
    h.div([h.Class(className(styles.formGroup))], [
      Label.view({ for: "showcase-transfer", children: ["Amount to Transfer"] }, h),
      InputGroup.view({
        prefix: ["$"],
        control: InputGroup.input({ id: "showcase-transfer", value: "1,200.00", ariaLabel: "Amount to Transfer" }, h),
      }, h),
    ]),
    Field.select({ id: "showcase-from-account", label: "From Account", value: "checking", options: [{ value: "checking", label: "Main Checking (••8402) — $8,410" }] }, h),
    Field.select({ id: "showcase-to-account", label: "To Account", value: "savings", options: [{ value: "savings", label: "High Yield Savings (••2198)" }] }, h),
    button("Continue Transfer", h),
  ])],
}, h);

export const financeShowcase = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div([h.Class(className(styles.board)), h.DataAttribute("financial-showcase", "true")], [
    contributionHistory(h),
    payoutThreshold(model, h),
    savingsTargets(h),
    buyInvestment(h),
    distributeTrack(h),
    claimableBalance(h),
    recentTransactions(h),
    qrCard(h),
    preferences(model, h),
    accountAccess(h),
    transferFunds(h),
    navigationSamples(h),
    portfolioSummary(h),
  ]);
