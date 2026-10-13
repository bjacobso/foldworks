import { render, validateSpec } from "@foldworks/generative-ui/core";
import { foldworksRegistry } from "@foldworks/generative-ui/foldworks";
import { Alert, Badge, Button, Card, CodeBlock, Field, Heading, Layout, Text } from "@foldworks/ui";
import * as stylex from "@stylexjs/stylex";
import { Option, Result } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineView } from "foldkit/submodel";

import { catalog } from "./catalog";
import { CassetteId, cassettes } from "./cassettes";
import { document } from "./document";
import { Message } from "./message";
import type { Model } from "./model";

const styles = stylex.create({
  root: { padding: "24px", width: "100%", maxWidth: "1100px", marginInline: "auto", minWidth: 0 },
});

const generationPanel = (model: Model, h: HtmlBuilder<Message>): Html =>
  Card.view(
    {
      title: "Mock UI generation",
      description:
        "Enter a prompt and choose a fixed response cassette. This runs the generation API with a mock provider; the cassette controls the output.",
      children: [
        Layout.Stack.view(
          {
            gap: "md",
            children: [
              Field.select(
                {
                  id: "viewspec-cassette",
                  label: "Response cassette",
                  value: model.cassetteId,
                  description: cassettes[model.cassetteId].description,
                  options: CassetteId.literals.map((id) => ({
                    value: id,
                    label: cassettes[id].label,
                  })),
                  onChange: (value) =>
                    Message.SelectedCassette({ cassetteId: value as CassetteId }),
                },
                h,
              ),
              Field.textarea(
                {
                  id: "viewspec-prompt",
                  label: "UI prompt",
                  value: model.prompt,
                  minRows: 3,
                  onInput: (value) => Message.ChangedPrompt({ value }),
                },
                h,
              ),
              Button.view(
                {
                  label:
                    model.generationState === "Loading"
                      ? "Generating mock UI…"
                      : "Generate mock UI",
                  isDisabled: model.generationState === "Loading" || model.prompt.trim() === "",
                  onClick: Message.RequestedGeneration(),
                },
                h,
              ),
              h.div(
                [h.AriaLive("polite"), h.DataAttribute("generation-state", model.generationState)],
                [
                  model.generationState === "Loading"
                    ? "Loading mock response…"
                    : model.generationState === "Ready"
                      ? "Mock response validated and rendered."
                      : model.generationState === "Error"
                        ? "Generation failed. The last valid response is preserved."
                        : "Ready to replay a mock response.",
                ],
              ),
              model.generationState === "Error"
                ? Alert.view(
                    {
                      title: "Mock generation failed",
                      description: model.generationError,
                      tone: "danger",
                    },
                    h,
                  )
                : h.empty,
            ],
          },
          h,
        ),
      ],
    },
    h,
  );

const generatedPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const spec = Option.getOrUndefined(model.generatedSpec);
  if (spec === undefined) return h.empty;
  return h.section(
    [h.AriaLabel("Generated UI"), h.DataAttribute("generated-ui", "true")],
    [
      Layout.Stack.view(
        {
          gap: "md",
          children: [
            Heading.view({ children: ["Generated UI"], level: 2 }, h),
            Text.view(
              {
                children: [
                  `${cassettes[model.generatedCassette].label} · Prompt: ${model.generatedPrompt}`,
                ],
                size: "sm",
                tone: "muted",
              },
              h,
            ),
            render(
              {
                spec,
                registry: foldworksRegistry<Message>(),
                toMessage: (intent) => Message.ReceivedGeneratedIntent({ intent }),
              },
              h,
            ),
            model.showDocument
              ? CodeBlock.view(
                  {
                    code: JSON.stringify(spec, null, 2),
                    title: "Generated version-1 document",
                    language: "json",
                    maxHeight: "300px",
                    wrap: true,
                  },
                  h,
                )
              : h.empty,
          ],
        },
        h,
      ),
    ],
  );
};

export const view = defineView<Model, Message>((model, h) => {
  const spec = validateSpec(catalog, document(model));
  return h.div(
    [
      h.Class(stylex.props(styles.root).className ?? ""),
      h.DataAttribute("viewspec-playground", "true"),
    ],
    [
      Layout.Stack.view(
        {
          gap: "lg",
          children: [
            Layout.Row.view(
              {
                justify: "between",
                wrap: true,
                gap: "sm",
                children: [
                  Heading.view({ children: ["ViewSpec playground"], level: 1, size: "xl" }, h),
                  Badge.view({ label: "Mock provider · Local fixtures", tone: "info" }, h),
                ],
              },
              h,
            ),
            Text.view(
              {
                children: [
                  "Filter the crew, select a record, and request an assignment. Foldkit keeps the draft locally; the fixture host checks each intent.",
                ],
                tone: "muted",
              },
              h,
            ),
            generationPanel(model, h),
            generatedPanel(model, h),
            Heading.view({ children: ["Fixture host"], level: 2 }, h),
            Result.isSuccess(spec)
              ? render(
                  {
                    spec: spec.success,
                    registry: foldworksRegistry<Message>(),
                    toMessage: (intent) => Message.ReceivedIntent({ intent }),
                  },
                  h,
                )
              : Alert.view(
                  {
                    title: "Invalid UI document",
                    description: spec.failure.map((issue) => issue.message).join("\n"),
                    tone: "danger",
                  },
                  h,
                ),
            Card.view(
              {
                title: "Host receipt",
                children: [
                  Layout.Stack.view(
                    {
                      gap: "sm",
                      children: [
                        h.div(
                          [h.Role("status"), h.AriaLabel("Host receipt"), h.AriaLive("polite")],
                          [model.receipt],
                        ),
                        model.lastIntent === ""
                          ? h.empty
                          : CodeBlock.view(
                              {
                                code: model.lastIntent,
                                title: "Last submitted intent",
                                language: "json",
                                maxHeight: "220px",
                                wrap: true,
                              },
                              h,
                            ),
                      ],
                    },
                    h,
                  ),
                ],
              },
              h,
            ),
            Layout.Row.view(
              {
                gap: "sm",
                wrap: true,
                children: [
                  Button.view(
                    {
                      label: model.showDocument ? "Hide document" : "Inspect document",
                      variant: "outline",
                      onClick: Message.ToggledDocument(),
                    },
                    h,
                  ),
                  Button.view(
                    { label: "Reset playground", variant: "ghost", onClick: Message.Reset() },
                    h,
                  ),
                ],
              },
              h,
            ),
            model.showDocument
              ? CodeBlock.view(
                  {
                    code: JSON.stringify(document(model), null, 2),
                    title: "Validated version-1 document",
                    language: "json",
                    maxHeight: "400px",
                    wrap: true,
                  },
                  h,
                )
              : h.empty,
          ],
        },
        h,
      ),
    ],
  );
});
