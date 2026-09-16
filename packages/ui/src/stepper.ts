import { Check, TriangleAlert } from "@lucide/icons";
import type { Html, HtmlBuilder } from "foldkit/html";

import * as Icon from "./icon";
import { styledAttrs, type StyledConfig } from "./catalog.shared";
import { primitiveStyles as styles } from "./primitive.styles";
import { sxAttrs } from "./sx";

export type Status = "complete" | "current" | "upcoming" | "error";
export type Step = Readonly<{ id: string; label: string; description?: string; status?: Status; isDisabled?: boolean }>;
export type ViewConfig<Message> = StyledConfig<Message> & Readonly<{
  steps: ReadonlyArray<Step>;
  currentStepId: string;
  orientation?: "horizontal" | "vertical";
  ariaLabel?: string;
  onSelect?: (id: string) => Message;
}>;

export const view = <Message>(config: ViewConfig<Message>, h: HtmlBuilder<Message>): Html => {
  const currentIndex = config.steps.findIndex((step) => step.id === config.currentStepId);
  if (currentIndex < 0 && config.steps.length > 0) throw new Error("Stepper currentStepId must identify a step.");
  const orientation = config.orientation ?? "horizontal";
  return h.nav([h.AriaLabel(config.ariaLabel ?? "Progress"), ...styledAttrs(config, h)], [
    h.ol(sxAttrs(h, styles.stepper, orientation === "horizontal" ? styles.stepperHorizontal : styles.stepperVertical),
      config.steps.map((step, index) => {
        const status = step.status ?? (index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming");
        const marker = status === "complete" ? Icon.view({ icon: Check, size: 14 }, h)
          : status === "error" ? Icon.view({ icon: TriangleAlert, size: 14 }, h) : String(index + 1);
        const copy = [
          h.span(sxAttrs(h, styles.stepLabel), [step.label]),
          ...(step.description === undefined ? [] : [h.span(sxAttrs(h, styles.stepDescription), [step.description])]),
        ];
        return h.li([
          ...sxAttrs(h, styles.step, orientation === "horizontal" && styles.stepHorizontal),
          h.DataAttribute("status", status),
          ...(status === "current" ? [h.AriaCurrent("step")] : []),
        ], [
          ...(index === config.steps.length - 1 ? [] : [h.span([
            ...sxAttrs(h, orientation === "horizontal" ? styles.stepConnectorHorizontal : styles.stepConnectorVertical),
            h.AriaHidden(true),
          ])]),
          h.span([...sxAttrs(h, styles.stepMarker,
            status === "current" && styles.stepCurrent,
            status === "complete" && styles.stepComplete,
            status === "error" && styles.stepError), h.AriaHidden(true)], [marker]),
          config.onSelect === undefined
            ? h.span(sxAttrs(h, orientation === "horizontal" && styles.stepCopyHorizontal), copy)
            : h.button([
                ...sxAttrs(h, styles.stepButton, orientation === "horizontal" && styles.stepCopyHorizontal),
                h.Type("button"), h.Disabled(step.isDisabled === true), h.OnClick(config.onSelect(step.id)),
              ], copy),
        ]);
      })),
  ]);
};

export const Stepper = { view } as const;
