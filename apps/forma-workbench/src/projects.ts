import type { Workspace } from "./workbench/index";
import { capabilities } from "./program/capabilities";
import { dataflow } from "./program/checks";
import onboarding from "./program/onboarding.forma?raw";
import workflow from "./program/workflow.lisp?raw";
import functions from "./program/functions.forma?raw";
import main from "./program/modules/main.forma?raw";
import pricing from "./program/modules/pricing.forma?raw";
import pricingApi from "./program/modules/pricing-api.forma?raw";
import discount from "./program/modules/lib/discount.forma?raw";

export const projects: readonly Workspace.Project[] = [
  {
    id: "onboarding",
    title: "Onboarding workflow",
    description:
      "Author typed workflow forms, inspect pricing, and approve simulated directory and chat calls.",
    entry: "onboarding.forma",
    files: [{ sourceId: "onboarding.forma", source: onboarding }],
    repl: "(with-tax 100)",
    config: {
      preludes: [{ sourceId: "workflow.lisp", source: workflow }],
      capabilities,
      checks: [dataflow],
    },
  },
  {
    id: "functions",
    title: "Functions & collections",
    description:
      "A small program for trying expressions and keeping scratch definitions in the REPL.",
    entry: "functions.forma",
    files: [{ sourceId: "functions.forma", source: functions }],
    repl: "(map square [2 4 8])",
  },
  {
    id: "modules",
    title: "Pricing modules",
    description:
      "Four files with named imports, a namespace, and a re-export. Edit a helper, then evaluate a new quote.",
    entry: "main.forma",
    files: [
      { sourceId: "main.forma", source: main },
      { sourceId: "pricing.forma", source: pricing },
      { sourceId: "pricing-api.forma", source: pricingApi },
      { sourceId: "lib/discount.forma", source: discount },
    ],
    repl: "(price-quote 100)",
  },
];
