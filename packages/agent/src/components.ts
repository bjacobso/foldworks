import {
  Bot,
  CheckCircle2,
  CircleStop,
  CircleX,
  LockKeyhole,
  RotateCcw,
  Send,
  Sparkles,
  User,
  Wrench,
} from "@lucide/icons";
import { Alert, Badge, Button, Icon, Spinner, Stateful, Textarea } from "@foldworks/ui";
import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";

import { Message } from "./message";
import {
  isActive,
  transcriptId,
  type ConversationPart,
  type Model,
  type ModelOption,
  type TextPart,
  type ToolPart,
  type Turn,
} from "./model";
import { className, styles as s } from "./styles";

export const ModelSelect: Stateful.Select.Bundle<string> = Stateful.Select.create<string>();

export type TextRenderer<ParentMessage> = (
  part: TextPart,
  h: HtmlBuilder<ParentMessage>,
) => Html;

export type PermissionPresentation<ParentMessage> = Readonly<{
  renderDetails?: (part: ToolPart, h: HtmlBuilder<ParentMessage>) => ReadonlyArray<Html>;
  note?: string;
  resolutionText?: (part: ToolPart) => string;
}>;

export type TextResponseConfig<ParentMessage> = Readonly<{
  part: TextPart;
  renderComplete?: TextRenderer<ParentMessage>;
}>;

export type PermissionRequestConfig<ParentMessage> = Readonly<{
  part: ToolPart;
  onDecision: (decision: "Allow" | "Deny") => ParentMessage;
  presentation?: PermissionPresentation<ParentMessage>;
}>;

export type ToolCallConfig<ParentMessage> = Readonly<{
  part: ToolPart;
  onPermissionDecision: (decision: "Allow" | "Deny") => ParentMessage;
  permission?: PermissionPresentation<ParentMessage>;
}>;

export type ConversationTurnConfig<ParentMessage> = Readonly<{
  turn: Turn;
  models?: ReadonlyArray<ModelOption>;
  assistantName?: string;
  renderText?: TextRenderer<ParentMessage>;
  onPermissionDecision: (decision: "Allow" | "Deny") => ParentMessage;
  permission?: PermissionPresentation<ParentMessage>;
}>;

export type EmptyStateConfig<ParentMessage> = Readonly<{
  title?: string;
  description?: string;
  suggestion?: Readonly<{
    label: string;
    onSelect: ParentMessage;
  }>;
}>;

export type SessionBarConfig<ParentMessage> = Readonly<{
  model: Model;
  models: ReadonlyArray<ModelOption>;
  toParentMessage: (message: Message) => ParentMessage;
  modelAriaLabel?: string;
  resetLabel?: string;
}>;

export type TranscriptConfig<ParentMessage> = Readonly<{
  model: Model;
  models?: ReadonlyArray<ModelOption>;
  toParentMessage: (message: Message) => ParentMessage;
  assistantName?: string;
  ariaLabel?: string;
  renderText?: TextRenderer<ParentMessage>;
  permission?: PermissionPresentation<ParentMessage>;
  empty?: EmptyStateConfig<ParentMessage>;
  failureTitle?: string;
  retryLabel?: string;
}>;

export type ComposerConfig<ParentMessage> = Readonly<{
  model: Model;
  toParentMessage: (message: Message) => ParentMessage;
  ariaLabel?: string;
  placeholder?: string;
  activePlaceholder?: string;
  helpText?: string;
  sendLabel?: string;
  stopLabel?: string;
}>;

export type ChatConfig<ParentMessage> = Readonly<{
  model: Model;
  models: ReadonlyArray<ModelOption>;
  toParentMessage: (message: Message) => ParentMessage;
  assistantName?: string;
  transcriptAriaLabel?: string;
  renderText?: TextRenderer<ParentMessage>;
  permission?: PermissionPresentation<ParentMessage>;
  empty?: Readonly<{
    title?: string;
    description?: string;
    suggestion?: Readonly<{ label: string; prompt: string }>;
  }>;
  composer?: Omit<ComposerConfig<ParentMessage>, "model" | "toParentMessage">;
  failureTitle?: string;
  retryLabel?: string;
  jumpLabel?: string;
}>;

export const statusLabel = (model: Model): string => {
  if (model.runState._tag === "AwaitingPermission") return "Waiting for approval";
  if (model.runState._tag === "Failed") return "Failed";
  if (model.runState._tag === "Streaming") {
    const runningTool = model.transcript.some((turn) =>
      turn.parts.some((part) => part._tag === "Tool" && part.status === "Running"));
    return runningTool ? "Using tool" : "Streaming";
  }
  const latestAssistant = [...model.transcript].reverse().find((turn) => turn.role === "Assistant");
  const latestPart = latestAssistant?.parts.at(-1);
  if (
    (latestPart?._tag === "Text" && latestPart.status === "Interrupted") ||
    (latestPart?._tag === "Tool" && latestPart.status === "Cancelled")
  ) return "Stopped";
  return model.transcript.length === 0 ? "Ready" : "Complete";
};

const toolTone = (status: ToolPart["status"]): "neutral" | "success" | "warning" | "danger" | "info" =>
  status === "Completed" ? "success"
    : status === "WaitingApproval" ? "warning"
      : status === "Denied" || status === "Cancelled" || status === "Failed" ? "danger"
        : "info";

const toolStatusLabel = (status: ToolPart["status"]): string =>
  status === "WaitingApproval" ? "Waiting for approval" : status;

const defaultPermissionResolution = (part: ToolPart): string =>
  part.status === "Denied" ? "Permission denied."
    : part.status === "Cancelled" ? "Request cancelled before execution."
      : "Permission allowed.";

const textResponse = <ParentMessage>(
  config: TextResponseConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => config.part.status === "Complete" && config.renderComplete !== undefined
  ? config.renderComplete(config.part, h)
  : h.p([h.Class(className(s.text, config.part.status !== "Streaming" && s.interrupted))], [
      config.part.text,
      ...(config.part.status === "Streaming"
        ? [h.span([h.Class(className(s.cursor)), h.AriaHidden(true)])]
        : config.part.status === "Complete"
          ? []
          : [h.span([], [` ${config.part.status === "Failed" ? "(failed)" : "(stopped)"}`])]),
    ]);

const permissionRequest = <ParentMessage>(
  config: PermissionRequestConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => config.part.status === "WaitingApproval"
  ? h.section([
      h.Class(className(s.permission)),
      h.Role("group"),
      h.AriaLabel(`Permission request for ${config.part.name}`),
    ], [
      h.h3([h.Class(className(s.permissionHeading))], [
        Icon.view({ icon: LockKeyhole, size: 16 }, h),
        "Permission required",
      ]),
      ...(config.part.permissionReason
        ? [h.p([h.Class(className(s.permissionCopy))], [config.part.permissionReason])]
        : []),
      ...(config.presentation?.renderDetails?.(config.part, h) ?? []),
      h.div([h.Class(className(s.permissionActions))], [
        Button.view({
          label: "Allow once",
          icon: CheckCircle2,
          onClick: config.onDecision("Allow"),
        }, h),
        Button.view({
          label: "Deny",
          icon: CircleX,
          variant: "outline",
          onClick: config.onDecision("Deny"),
        }, h),
        ...(config.presentation?.note === undefined
          ? []
          : [h.span([h.Class(className(s.simulationNote))], [config.presentation.note])]),
      ]),
    ])
  : h.div([h.Class(className(s.permissionCopy))], [
      config.presentation?.resolutionText?.(config.part) ?? defaultPermissionResolution(config.part),
    ]);

const toolCall = <ParentMessage>(
  config: ToolCallConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => h.details([
  h.Class(className(s.tool)),
  h.Open(config.part.status === "WaitingApproval"),
  h.DataAttribute("tool-call", config.part.name),
  h.DataAttribute("tool-status", config.part.status),
], [
  h.summary([h.Class(className(s.toolSummary))], [
    h.span([h.Class(className(s.toolIcon)), h.AriaHidden(true)], [
      Icon.view({ icon: Wrench, size: 14 }, h),
    ]),
    h.span([h.Class(className(s.toolName))], [config.part.name]),
    ...(config.part.status === "Running" ? [Spinner.view({ label: "Tool running" }, h)] : []),
    Badge.view({
      label: toolStatusLabel(config.part.status),
      tone: toolTone(config.part.status),
      dot: true,
    }, h),
  ]),
  h.div([h.Class(className(s.toolDetails))], [
    h.span([h.Class(className(s.codeLabel))], ["Input"]),
    h.pre([h.Class(className(s.code))], [config.part.input || "Waiting for input…"]),
    ...(config.part.permissionReason || config.part.status === "WaitingApproval"
      ? [permissionRequest({
          part: config.part,
          onDecision: config.onPermissionDecision,
          ...(config.permission === undefined ? {} : { presentation: config.permission }),
        }, h)]
      : []),
    ...(config.part.output
      ? [
          h.span([h.Class(className(s.codeLabel))], ["Result"]),
          h.pre([h.Class(className(s.code))], [config.part.output]),
        ]
      : []),
  ]),
]);

const conversationPart = <ParentMessage>(
  part: ConversationPart,
  config: ConversationTurnConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => part._tag === "Text"
  ? textResponse({ part, ...(config.renderText === undefined ? {} : { renderComplete: config.renderText }) }, h)
  : toolCall({
      part,
      onPermissionDecision: config.onPermissionDecision,
      ...(config.permission === undefined ? {} : { permission: config.permission }),
    }, h);

const conversationTurn = <ParentMessage>(
  config: ConversationTurnConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const own = config.turn.role === "User";
  const model = config.models?.find((option) => option.id === config.turn.modelId);
  const assistantName = config.assistantName ?? model?.label ?? "Assistant";
  return h.article([
    h.Class(className(s.turn, own && s.userTurn)),
    h.AriaLabel(`${own ? "You" : assistantName} message`),
    h.DataAttribute("agent-turn", config.turn.role.toLowerCase()),
  ], [
    h.span([h.Class(className(s.avatar, own && s.userAvatar)), h.AriaHidden(true)], [
      Icon.view({ icon: own ? User : Bot, size: 15 }, h),
    ]),
    h.div([h.Class(className(s.turnBody, own && s.userBody))], [
      h.span([h.Class(className(s.author))], [own ? "You" : assistantName]),
      ...(own
        ? [h.div([h.Class(className(s.userBubble))], [
            config.turn.parts[0]?._tag === "Text" ? config.turn.parts[0].text : "",
          ])]
        : [h.div([h.Class(className(s.assistantContent))], config.turn.parts.length
            ? config.turn.parts.map((part) => conversationPart(part, config, h))
            : [h.div([], [Spinner.view({ label: "Assistant is starting" }, h)])])]),
    ]),
  ]);
};

const emptyState = <ParentMessage>(
  config: EmptyStateConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => h.div([h.Class(className(s.empty))], [
  h.span([h.Class(className(s.emptyIcon)), h.AriaHidden(true)], [
    Icon.view({ icon: Sparkles, size: 25 }, h),
  ]),
  h.h2([h.Class(className(s.emptyTitle))], [config.title ?? "Start a conversation"]),
  h.p([h.Class(className(s.emptyCopy))], [
    config.description ?? "Send a message to begin working with the agent.",
  ]),
  ...(config.suggestion === undefined
    ? []
    : [Button.view({
        label: config.suggestion.label,
        icon: Sparkles,
        size: "lg",
        style: s.suggestion,
        onClick: config.suggestion.onSelect,
      }, h)]),
]);

const sessionBar = <ParentMessage>(
  config: SessionBarConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const selected = config.models.find((option) => option.id === config.model.selectedModel);
  const active = isActive(config.model);
  const status = statusLabel(config.model);
  return h.header([h.Class(className(s.sessionBar))], [
    h.div([h.Class(className(s.sessionControls))], [
      h.submodel({
        slotId: config.model.modelPicker.id,
        model: config.model.modelPicker,
        view: ModelSelect.view,
        viewInputs: Stateful.Select.styledViewInputs({
          value: config.model.selectedModel,
          ariaLabel: config.modelAriaLabel ?? "Agent model",
          isDisabled: active,
          options: config.models.map((option) => ({ value: option.id, label: option.label })),
        }, h),
        toParentMessage: (message) => config.toParentMessage(Message.GotModelPickerMessage({ message })),
      }),
      ...(selected === undefined
        ? []
        : [h.div([h.Class(className(s.modelMeta))], [
            h.span([h.Class(className(s.modelProvider))], [selected.provider]),
            h.span([h.Class(className(s.modelDescription))], [selected.description]),
          ])]),
    ]),
    h.div([h.Class(className(s.sessionControls))], [
      Badge.view({
        label: status,
        tone: status === "Failed" ? "danger"
          : status === "Waiting for approval" ? "warning"
            : status === "Complete" ? "success"
              : "info",
        dot: true,
      }, h),
      Button.view({
        label: config.resetLabel ?? "Reset",
        icon: RotateCcw,
        variant: "ghost",
        size: "sm",
        onClick: config.toParentMessage(Message.Reset()),
      }, h),
    ]),
  ]);
};

const transcript = <ParentMessage>(
  config: TranscriptConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => h.div([
  h.Class(className(s.transcript)),
  h.Id(transcriptId(config.model)),
  h.Role("log"),
  h.AriaLive("off"),
  h.AriaLabel(config.ariaLabel ?? "Agent conversation"),
  h.AriaBusy(config.model.runState._tag === "Streaming"),
  h.Tabindex(0),
  h.OnScroll((scrollTop) => config.toParentMessage(Message.ScrolledTranscript({ scrollTop }))),
], config.model.transcript.length === 0
  ? [emptyState(config.empty ?? {}, h)]
  : [h.div([h.Class(className(s.transcriptInner))], [
      ...config.model.transcript.map((turn) => conversationTurn({
        turn,
        onPermissionDecision: (decision) =>
          config.toParentMessage(Message.ChosePermission({ decision })),
        ...(config.models === undefined ? {} : { models: config.models }),
        ...(config.assistantName === undefined ? {} : { assistantName: config.assistantName }),
        ...(config.renderText === undefined ? {} : { renderText: config.renderText }),
        ...(config.permission === undefined ? {} : { permission: config.permission }),
      }, h)),
      ...(config.model.runState._tag === "Failed"
        ? [Alert.view({
            title: config.failureTitle ?? "The agent run failed",
            description: config.model.runState.message,
            tone: "danger",
            children: [Button.view({
              label: config.retryLabel ?? "Retry",
              icon: RotateCcw,
              variant: "outline",
              onClick: config.toParentMessage(Message.Retried()),
            }, h)],
          }, h)]
        : []),
    ])]);

const composer = <ParentMessage>(
  config: ComposerConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const active = isActive(config.model);
  const inputId = `${config.model.id}-prompt`;
  const helpId = `${config.model.id}-composer-help`;
  return h.div([h.Class(className(s.composerShell))], [
    h.form([
      h.Class(className(s.composer)),
      h.OnSubmit(config.toParentMessage(Message.Submitted())),
      h.AriaLabel(config.ariaLabel ?? "Agent prompt"),
    ], [
      h.label([h.Class(className(s.srOnly)), h.For(inputId)], ["Message the agent"]),
      Textarea.view({
        id: inputId,
        value: config.model.draft,
        rows: 2,
        placeholder: active
          ? config.activePlaceholder ?? "Wait for the current run to finish…"
          : config.placeholder ?? "Message the agent…",
        ariaLabel: "Message the agent",
        isDisabled: active,
        onInput: (value) => config.toParentMessage(Message.ChangedDraft({ value })),
        style: s.textarea,
        attributes: [
          h.AriaDescribedBy(helpId),
          h.OnKeyDownPreventDefault((key, modifiers) =>
            key === "Enter" && !modifiers.shiftKey
              ? Option.some(config.toParentMessage(Message.Submitted()))
              : Option.none()),
        ],
      }, h),
      h.div([h.Class(className(s.composerFooter))], [
        h.span([h.Class(className(s.composerHelp)), h.Id(helpId)], [
          config.helpText ?? "Enter to send · Shift+Enter for a new line",
        ]),
        active
          ? Button.view({
              label: config.stopLabel ?? "Stop",
              icon: CircleStop,
              variant: "danger",
              onClick: config.toParentMessage(Message.Stopped()),
            }, h)
          : Button.view({
              label: config.sendLabel ?? "Send",
              icon: Send,
              onClick: config.toParentMessage(Message.Submitted()),
              isDisabled: !config.model.draft.trim(),
            }, h),
      ]),
    ]),
  ]);
};

const chat = <ParentMessage>(
  config: ChatConfig<ParentMessage>,
  h: HtmlBuilder<ParentMessage>,
): Html => {
  const empty: EmptyStateConfig<ParentMessage> = {
    ...(config.empty?.title === undefined ? {} : { title: config.empty.title }),
    ...(config.empty?.description === undefined ? {} : { description: config.empty.description }),
    ...(config.empty?.suggestion === undefined
      ? {}
      : {
          suggestion: {
            label: config.empty.suggestion.label,
            onSelect: config.toParentMessage(Message.SelectedSuggestion({
              prompt: config.empty.suggestion.prompt,
            })),
          },
        }),
  };
  return h.section([
    h.Class(className(s.root)),
    h.DataAttribute("agent-chat", "true"),
  ], [
    sessionBar({
      model: config.model,
      models: config.models,
      toParentMessage: config.toParentMessage,
    }, h),
    transcript({
      model: config.model,
      models: config.models,
      toParentMessage: config.toParentMessage,
      empty,
      ...(config.assistantName === undefined ? {} : { assistantName: config.assistantName }),
      ...(config.transcriptAriaLabel === undefined ? {} : { ariaLabel: config.transcriptAriaLabel }),
      ...(config.renderText === undefined ? {} : { renderText: config.renderText }),
      ...(config.permission === undefined ? {} : { permission: config.permission }),
      ...(config.failureTitle === undefined ? {} : { failureTitle: config.failureTitle }),
      ...(config.retryLabel === undefined ? {} : { retryLabel: config.retryLabel }),
    }, h),
    ...(!config.model.isFollowing && config.model.transcript.length
      ? [h.div([h.Class(className(s.jump))], [Button.view({
          label: config.jumpLabel ?? "Jump to latest",
          variant: "secondary",
          size: "sm",
          onClick: config.toParentMessage(Message.JumpedLatest()),
        }, h)])]
      : []),
    composer({
      model: config.model,
      toParentMessage: config.toParentMessage,
      ...(config.composer ?? {}),
    }, h),
    h.div([
      h.Class(className(s.srOnly)),
      h.Role("status"),
      h.AriaLive("polite"),
      h.AriaAtomic(true),
    ], [config.model.announcement]),
  ]);
};

export const Chat = { view: chat } as const;
export const SessionBar = { view: sessionBar } as const;
export const Transcript = { view: transcript } as const;
export const ConversationTurn = { view: conversationTurn } as const;
export const TextResponse = { view: textResponse } as const;
export const ToolCall = { view: toolCall } as const;
export const PermissionRequest = { view: permissionRequest } as const;
export const EmptyState = { view: emptyState } as const;
export const Composer = { view: composer } as const;
