import { setCollapsed, walk, type Items } from "@foldworks/outliner";

import { idSource, parseSource } from "./codec";

export const OUTLINE_ID = "lisp-outline";

export const sampleSource = `; A program is an outline: every row is a form, and indentation is nesting.
(section "Pricing"
  (def tax-rate 0.0825)
  (defn invoice-total [revenue]
    ; Revenue plus sales tax, rounded to cents.
    (let [tax (* revenue tax-rate)]
      (round (+ revenue tax) 2)))
  (invoice-total 100)
  (map invoice-total [40 250 1200]))
(section "Onboarding steps"
  ; Each step names the system it calls and the data it reads and writes.
  (defstep verify-identity {:system "Persona" :writes [:identity]})
  (defstep background-check {:system "Checkr" :reads [:identity] :writes [:check]})
  (defstep collect-i9 {:system "Docs" :reads [:identity] :writes [:i9]})
  (defstep create-payroll-record {:system "Gusto" :writes [:payroll]})
  (defstep activate {:system "Okta" :reads [:check :i9 :payroll]}))
(section "Onboarding"
  (workflow onboarding
    background-check
    collect-i9
    create-payroll-record
    activate)
  ; Checks are live too.
  (before? onboarding collect-i9 activate)
  (before? onboarding verify-identity collect-i9))
(section "Library"
  ; Shared helpers, shown here read only.
  (defn percent [rate amount] (* rate amount))
  (defn cents [amount] (round amount 2)))`;

const sample = (): Items => {
  const items = parseSource(sampleSource, [], idSource(OUTLINE_ID, []));
  return walk(items)
    .filter(
      (node) => node.text === 'section "Onboarding steps"' || node.text === 'section "Library"',
    )
    .reduce((current, node) => setCollapsed(current, node.id, true), items);
};

export const sampleOutline = sample();
