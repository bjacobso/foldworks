import * as Markdown from "@foldkit/markdown";
import { parseMarkdown } from "@foldkit/markdown/vite";
import { AlertTriangle, Bot, CheckCircle2, CircleStop, CircleX, LockKeyhole, RotateCcw, Send, Sparkles, User, Wrench } from "@lucide/icons";
import { Agent } from "@foldworks/agent";
import { Alert, Badge, Button, Icon, Spinner, Stateful, Textarea } from "@foldworks/ui";
import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { modelFixtures, selectedModelFixture } from "./components";
import { className, styles as s } from "./styles";

const Message = Agent.Message;
type Message = Agent.Message;
const AgentModelSelect = Agent.ModelSelect;
type ConversationPart = Agent.ConversationPart;
type Model = Agent.Model;
type TextPart = Agent.TextPart;
type ToolPart = Agent.ToolPart;
type Turn = Agent.Turn;

const SUGGESTION = "Inspect the release setup and update the launch checklist.";

const statusLabel = (model: Model): string => {
  if (model.runState._tag === "AwaitingPermission") return "Waiting for approval";
  if (model.runState._tag === "Failed") return "Failed";
  if (model.runState._tag === "Streaming") {
    const runningTool = model.transcript.some((turn) => turn.parts.some((part) => part._tag === "Tool" && part.status === "Running"));
    return runningTool ? "Using tool" : "Streaming";
  }
  const latestAssistant = [...model.transcript].reverse().find((turn) => turn.role === "Assistant");
  const latestPart = latestAssistant?.parts.at(-1);
  if ((latestPart?._tag === "Text" && latestPart.status === "Interrupted") ||
    (latestPart?._tag === "Tool" && latestPart.status === "Cancelled")) return "Stopped";
  return model.transcript.length === 0 ? "Ready" : "Complete";
};

const toolTone = (status: ToolPart["status"]): "neutral" | "success" | "warning" | "danger" | "info" =>
  status === "Completed" ? "success"
    : status === "WaitingApproval" ? "warning"
      : status === "Denied" || status === "Cancelled" || status === "Failed" ? "danger"
        : "info";

const toolStatusLabel = (status: ToolPart["status"]): string =>
  status === "WaitingApproval" ? "Waiting for approval" : status;

const renderMarkdown = (source: string, h: HtmlBuilder<Message>): Html => {
  try {
    return h.div([h.Class(className(s.markdown))], [Markdown.view(parseMarkdown(source), {
      views: {
        Paragraph: (_paragraph, content) => h.p([h.Class(className(s.markdownParagraph))], content),
        Heading: ({ level }, content) => level === 1
          ? h.h2([h.Class(className(s.markdownHeading))], content)
          : h.h3([h.Class(className(s.markdownHeading))], content),
        InlineCode: ({ value }) => h.code([h.Class(className(s.markdownCode))], [value]),
        CodeBlock: ({ value }) => h.pre([h.Class(className(s.markdownPre))], [h.code([], [value])]),
        List: ({ isOrdered }, items) => isOrdered
          ? h.ol([h.Class(className(s.markdownList))], items)
          : h.ul([h.Class(className(s.markdownList))], items),
        ListItem: (_item, blocks) => h.li([h.Class(className(s.markdownListItem))], blocks),
      },
    })]);
  } catch {
    return h.p([h.Class(className(s.text))], [source]);
  }
};

const textPart = (part: TextPart, h: HtmlBuilder<Message>): Html => part.status === "Complete"
  ? renderMarkdown(part.text, h)
  : h.p([h.Class(className(s.text, part.status !== "Streaming" && s.interrupted))], [
      part.text,
      ...(part.status === "Streaming"
        ? [h.span([h.Class(className(s.cursor)), h.AriaHidden(true)])]
        : [h.span([], [` ${part.status === "Failed" ? "(failed)" : "(stopped)"}`])]),
    ]);

const permission = (part: ToolPart, h: HtmlBuilder<Message>): Html =>
  part.status === "WaitingApproval"
    ? h.section([
        h.Class(className(s.permission)),
        h.Role("group"),
        h.AriaLabel("Permission request for write_file"),
      ], [
        h.h3([h.Class(className(s.permissionHeading))], [
          Icon.view({ icon: LockKeyhole, size: 16 }, h),
          "Permission required",
        ]),
        h.p([h.Class(className(s.permissionCopy))], [part.permissionReason]),
        h.p([h.Class(className(s.permissionCopy))], [
          "Target: ", h.code([h.Class(className(s.markdownCode))], ["docs/launch-checklist.md"]),
        ]),
        h.div([h.Class(className(s.permissionActions))], [
          Button.view({ label: "Allow once", icon: CheckCircle2, onClick: Message.ChosePermission({ decision: "Allow" }) }, h),
          Button.view({ label: "Deny", icon: CircleX, variant: "outline", onClick: Message.ChosePermission({ decision: "Deny" }) }, h),
          h.span([h.Class(className(s.simulationNote))], ["Simulation only — no real action will run."]),
        ]),
      ])
    : h.div([h.Class(className(s.permissionCopy))], [
        part.status === "Denied" ? "Permission denied. No file was changed."
          : part.status === "Cancelled" ? "Request cancelled before execution."
            : "Permission allowed once for this simulated call.",
      ]);

const toolPart = (part: ToolPart, h: HtmlBuilder<Message>): Html => h.details([
  h.Class(className(s.tool)),
  h.Open(part.status === "WaitingApproval"),
  h.DataAttribute("tool-call", part.name),
  h.DataAttribute("tool-status", part.status),
], [
  h.summary([h.Class(className(s.toolSummary))], [
    h.span([h.Class(className(s.toolIcon)), h.AriaHidden(true)], [Icon.view({ icon: Wrench, size: 14 }, h)]),
    h.span([h.Class(className(s.toolName))], [part.name]),
    ...(part.status === "Running" ? [Spinner.view({ label: "Tool running" }, h)] : []),
    Badge.view({ label: toolStatusLabel(part.status), tone: toolTone(part.status), dot: true }, h),
  ]),
  h.div([h.Class(className(s.toolDetails))], [
    h.span([h.Class(className(s.codeLabel))], ["Input"]),
    h.pre([h.Class(className(s.code))], [part.input || "Waiting for input…"]),
    ...(part.permissionReason
      ? [permission(part, h)]
      : []),
    ...(part.output
      ? [h.span([h.Class(className(s.codeLabel))], ["Result"]), h.pre([h.Class(className(s.code))], [part.output])]
      : []),
  ]),
]);

const assistantPart = (part: ConversationPart, h: HtmlBuilder<Message>): Html =>
  part._tag === "Text" ? textPart(part, h) : toolPart(part, h);

const turnView = (turn: Turn, h: HtmlBuilder<Message>): Html => {
  const own = turn.role === "User";
  const model = modelFixtures.find((fixture) => fixture.id === turn.modelId);
  return h.article([
    h.Class(className(s.turn, own && s.userTurn)),
    h.AriaLabel(`${own ? "You" : "Assistant"} message`),
    h.DataAttribute("agent-turn", turn.role.toLowerCase()),
  ], [
    h.span([h.Class(className(s.avatar, own && s.userAvatar)), h.AriaHidden(true)], [
      Icon.view({ icon: own ? User : Bot, size: 15 }, h),
    ]),
    h.div([h.Class(className(s.turnBody, own && s.userBody))], [
      h.span([h.Class(className(s.author))], [own ? "You" : model?.label ?? "Assistant"]),
      ...(own
        ? [h.div([h.Class(className(s.userBubble))], [turn.parts[0]?._tag === "Text" ? turn.parts[0].text : ""])]
        : [h.div([h.Class(className(s.assistantContent))], turn.parts.length
            ? turn.parts.map((part) => assistantPart(part, h))
            : [h.div([], [Spinner.view({ label: "Assistant is starting" }, h)])])]),
    ]),
  ]);
};

const emptyState = (h: HtmlBuilder<Message>): Html => h.div([h.Class(className(s.empty))], [
  h.span([h.Class(className(s.emptyIcon)), h.AriaHidden(true)], [Icon.view({ icon: Sparkles, size: 25 }, h)]),
  h.h2([h.Class(className(s.emptyTitle))], ["See an agent run, one event at a time."]),
  h.p([h.Class(className(s.emptyCopy))], [
    "Watch streamed text, tool inputs, results, and a human permission checkpoint. Everything is deterministic and stays in this browser.",
  ]),
  Button.view({
    label: "Run the release checklist example",
    icon: Sparkles,
    size: "lg",
    style: s.suggestion,
    onClick: Message.SelectedSuggestion({ prompt: SUGGESTION }),
  }, h),
]);

const sessionBar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const selected = selectedModelFixture(model);
  const active = Agent.isActive(model);
  const status = statusLabel(model);
  return h.header([h.Class(className(s.sessionBar))], [
    h.div([h.Class(className(s.sessionControls))], [
      h.submodel({
        slotId: model.modelPicker.id,
        model: model.modelPicker,
        view: AgentModelSelect.view,
        viewInputs: Stateful.Select.styledViewInputs({
          value: model.selectedModel,
          ariaLabel: "Agent model",
          isDisabled: active,
          options: modelFixtures.map((fixture) => ({ value: fixture.id, label: fixture.label })),
        }, h),
        toParentMessage: (message) => Message.GotModelPickerMessage({ message }),
      }),
      h.div([h.Class(className(s.modelMeta))], [
        h.span([h.Class(className(s.modelProvider))], [selected.provider]),
        h.span([h.Class(className(s.modelDescription))], [selected.description]),
      ]),
    ]),
    h.div([h.Class(className(s.sessionControls))], [
      Badge.view({
        label: status,
        tone: status === "Failed" ? "danger" : status === "Waiting for approval" ? "warning" : status === "Complete" ? "success" : "info",
        dot: true,
      }, h),
      Button.view({ label: "Reset", icon: RotateCcw, variant: "ghost", size: "sm", onClick: Message.Reset() }, h),
    ]),
  ]);
};

const composer = (model: Model, h: HtmlBuilder<Message>): Html => {
  const active = Agent.isActive(model);
  return h.div([h.Class(className(s.composerShell))], [
    h.form([h.Class(className(s.composer)), h.OnSubmit(Message.Submitted()), h.AriaLabel("Agent prompt")], [
      h.label([h.Class(className(s.srOnly)), h.For("agent-prompt")], ["Message the agent"]),
      Textarea.view({
        id: "agent-prompt",
        value: model.draft,
        rows: 2,
        placeholder: active ? "Wait for the current run to finish…" : "Ask the simulated agent to inspect the project…",
        ariaLabel: "Message the agent",
        isDisabled: active,
        onInput: (value) => Message.ChangedDraft({ value }),
        style: s.textarea,
        attributes: [h.AriaDescribedBy("agent-composer-help"), h.OnKeyDownPreventDefault((key, modifiers) =>
          key === "Enter" && !modifiers.shiftKey ? Option.some(Message.Submitted()) : Option.none())],
      }, h),
      h.div([h.Class(className(s.composerFooter))], [
        h.span([h.Class(className(s.composerHelp)), h.Id("agent-composer-help")], ["Enter to send · Shift+Enter for a new line"]),
        active
          ? Button.view({ label: "Stop", icon: CircleStop, variant: "danger", onClick: Message.Stopped() }, h)
          : Button.view({ label: "Send", icon: Send, onClick: Message.Submitted(), isDisabled: !model.draft.trim() }, h),
      ]),
    ]),
  ]);
};

export const view = defineView<Model, Message>((model, h) => h.section([
  h.Class(className(s.root)),
  h.DataAttribute("agent-playground", "true"),
], [
  sessionBar(model, h),
  h.div([
    h.Class(className(s.transcript)),
    h.Id(Agent.transcriptId(model)),
    h.Role("log"),
    h.AriaLive("off"),
    h.AriaLabel("Agent conversation"),
    h.AriaBusy(model.runState._tag === "Streaming"),
    h.Tabindex(0),
    h.OnScroll((scrollTop) => Message.ScrolledTranscript({ scrollTop })),
  ], model.transcript.length === 0
    ? [emptyState(h)]
    : [h.div([h.Class(className(s.transcriptInner))], [
        ...model.transcript.map((turn) => turnView(turn, h)),
        ...(model.runState._tag === "Failed"
          ? [Alert.view({
              title: "The simulated stream failed",
              description: model.runState.message,
              tone: "danger",
              children: [Button.view({ label: "Retry", icon: RotateCcw, variant: "outline", onClick: Message.Retried() }, h)],
            }, h)]
          : []),
      ])]),
  ...(!model.isFollowing && model.transcript.length
    ? [h.div([h.Class(className(s.jump))], [Button.view({ label: "Jump to latest", variant: "secondary", size: "sm", onClick: Message.JumpedLatest() }, h)])]
    : []),
  composer(model, h),
  h.div([h.Class(className(s.srOnly)), h.Role("status"), h.AriaLive("polite"), h.AriaAtomic(true)], [model.announcement]),
]));
