import { describe, expect, it } from "vitest";
import { find, item, walk, type Items } from "@foldworks/outliner";

import { analyze, decorations, diagnosticsOf } from "./analysis";
import { propose } from "./assistant";
import { idSource, parseSource, printOutline, readOutline } from "./codec";
import { treeDiff } from "./diff";
import { evaluate, show } from "./evaluate";
import { describeAt } from "./hover";
import { extract, join, explode, rename, wrap } from "./refactor";
import { sampleOutline, sampleSource } from "./sample";
import { print, read } from "./syntax";

const outline = (source: string): Items => parseSource(source, [], idSource("t", []));

const byText = (items: Items, text: string) => walk(items).find((node) => node.text === text)!;

const valueOf = (items: Items, text: string) => {
  const analysis = analyze(items);
  const observed = analysis.evaluation.values.get(byText(items, text).id);
  return observed === undefined ? undefined : show(observed.value);
};

describe("reader", () => {
  it("reads and prints the usual forms", () => {
    const [expr] = read(`(defn f [x & more] {:a "b\\"c" :n -1.5} 'sym)`);
    expect(print(expr!)).toBe(`(defn f [x & more] {:a "b\\"c" :n -1.5} (quote sym))`);
  });

  it("reports unbalanced input", () => {
    expect(() => read("(+ 1 2")).toThrow("Missing )");
    expect(() => read("(+ 1 2]")).toThrow("Expected )");
  });
});

describe("outline codec", () => {
  it("reads items as wisp-style forms", () => {
    const items: Items = [
      item("a", "defn twice [x]", [item("b", "* x 2")]),
      item("c", "twice 21"),
      item("d", "(now)"),
      item("e", "; a note"),
    ];
    const program = readOutline(items);
    expect(program.forms.map(print)).toEqual([
      "(defn twice [x] (* x 2))",
      "(twice 21)",
      "(now)",
      "; a note",
    ]);
  });

  it("prints the outline line for line", () => {
    const items: Items = [
      item("a", "defn twice [x]", [item("b", "; doubles"), item("c", "* x 2")]),
      item("d", "twice 21"),
      item("e", "total"),
    ];
    const source = printOutline(items);
    expect(source.text).toBe("(defn twice [x]\n  ; doubles\n  (* x 2))\n(twice 21)\ntotal");
    expect(source.lines).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("round-trips source through the outline", () => {
    const items = outline(sampleSource);
    expect(printOutline(items).text).toBe(sampleSource);
  });

  it("keeps ids and folding at the same positions", () => {
    const previous = outline("(f\n  (g 1)\n  2)");
    const next = parseSource("(f\n  (g 1)\n  3)", previous, idSource("t", previous));
    expect(walk(next).map((node) => node.id)).toEqual(walk(previous).map((node) => node.id));
    expect(next[0]!.children[1]!.text).toBe("3");
  });

  it("keeps parentheses on single-element lists", () => {
    const items = outline("(do\n  (now)\n  x)");
    expect(items[0]!.children.map((node) => node.text)).toEqual(["(now)", "x"]);
  });
});

describe("bracket notation", () => {
  it("turns bullets into opening brackets and closes each list after its last row", () => {
    const items: Items = [
      item("a", "defn twice [x]", [item("b", "; doubles"), item("c", "* x 2")]),
      item("d", "twice 21"),
      item("e", "total"),
      item("f", "do", [item("g", "now", [item("h", "x")])], { collapsed: true }),
    ];
    const brackets = decorations(items, { notation: "Lisp", scopeId: null, focusId: "a" });
    const row = (id: string) =>
      `${brackets[id]?.marker}${find(items, id)!.text}${(brackets[id]?.suffix ?? []).map((span) => span.text).join("")}`;
    expect(["a", "b", "c", "d", "e", "f"].map(row)).toEqual([
      "(defn twice [x]",
      "; doubles",
      "(* x 2))",
      "(twice 21)",
      "total",
      "(do …)",
    ]);
    // The bracket that closes the row with the caret is marked.
    expect(brackets["c"]?.suffix?.map((span) => span.kind)).toEqual(["paren", "paren-match"]);
  });
});

describe("evaluation", () => {
  it("records a value for every item, including inside functions", () => {
    expect(valueOf(sampleOutline, "def tax-rate 0.0825")).toBe("0.0825");
    expect(valueOf(sampleOutline, "invoice-total 100")).toBe("108.25");
    expect(valueOf(sampleOutline, "map invoice-total [40 250 1200]")).toBe("[43.3 270.63 1299]");
    // The function body shows its last call.
    expect(valueOf(sampleOutline, "round (+ revenue tax) 2")).toBe("1299");
  });

  it("reports errors on the item that raised them", () => {
    const items = outline("(def a 1)\n(defn f [x]\n  (+ x missing))\n(f a)");
    const analysis = analyze(items);
    expect(analysis.evaluation.errors.get(byText(items, "+ x missing").id)).toBe(
      "missing is not defined",
    );
  });

  it("keeps evaluating a section past a failing form", () => {
    const items = outline('(section "S"\n  (+ 1 missing)\n  (+ 1 2))');
    expect(valueOf(items, "+ 1 2")).toBe("3");
    expect(analyze(items).evaluation.errors.get(byText(items, "+ 1 missing").id)).toBe(
      "missing is not defined",
    );
  });

  it("stops runaway recursion", () => {
    const { errors } = evaluate(readOutline(outline("(defn loop [x] (loop x))\n(loop 1)")).forms);
    expect([...errors.values()][0]).toMatch(/Stopped/);
  });
});

describe("workflow analysis", () => {
  it("warns when a step reads data before its writer runs", () => {
    const analysis = analyze(sampleOutline);
    const warned = [...analysis.warnings.keys()].map((id) => find(sampleOutline, id)?.text);
    expect(warned).toEqual(["background-check", "collect-i9"]);
    expect(valueOf(sampleOutline, "before? onboarding collect-i9 activate")).toBe("true");
    expect(valueOf(sampleOutline, "before? onboarding verify-identity collect-i9")).toBe("false");
  });
});

describe("refactoring", () => {
  const nextId = idSource("t", sampleOutline);

  it("wraps, joins, explodes, and renames", () => {
    const items = outline("(f\n  a\n  b\n  c)");
    const [a, b] = items[0]!.children;
    const wrapped = wrap(items, [a!.id, b!.id], "parallel", idSource("t", items))!;
    expect(printOutline(wrapped.items).text).toBe("(f\n  (parallel\n    a\n    b)\n  c)");
    expect(printOutline(join(wrapped.items, wrapped.id)!).text).toBe("(f\n  (parallel a b)\n  c)");
    const exploded = explode([item("t-1", "+ (* a 2) b")], "t-1", idSource("t", items))!;
    expect(exploded[0]!.children.map((node) => node.text)).toEqual(["* a 2", "b"]);
    expect(printOutline(rename(items, "a", "alpha")!).text).toContain("alpha");
  });

  it("extracts a form into a function with its free locals as parameters", () => {
    const analysis = analyze(sampleOutline);
    const target = byText(sampleOutline, "round (+ revenue tax) 2");
    const result = extract(sampleOutline, target.id, "with-tax", analysis, nextId)!;
    const source = printOutline(result.items).text;
    expect(source).toContain("(defn with-tax [revenue tax]\n    (round (+ revenue tax) 2))");
    expect(source).toContain("(with-tax revenue tax)");
    expect(valueOf(result.items, "invoice-total 100")).toBe("108.25");
  });
});

describe("assistant", () => {
  it("turns a request into a structural edit and reports what it fixes", () => {
    const steps = ["background-check", "collect-i9"].map((text) => byText(sampleOutline, text).id);
    const answer = propose(
      "Run these concurrently, but don't start the I-9 until identity verification succeeds",
      {
        items: sampleOutline,
        selection: steps,
        focusId: steps[0]!,
        nextId: idSource("lisp-outline", sampleOutline),
      },
    );
    expect(answer._tag).toBe("Proposal");
    if (answer._tag !== "Proposal") return;
    const workflow = byText(answer.proposal.items, "workflow onboarding");
    expect(printOutline([workflow]).text).toBe(
      [
        "(workflow onboarding",
        "  (parallel",
        "    background-check",
        "    (sequence",
        "      verify-identity",
        "      collect-i9))",
        "  create-payroll-record",
        "  activate)",
      ].join("\n"),
    );
    expect(answer.proposal.notes).toContain(
      "before? onboarding verify-identity collect-i9 is now true ✓.",
    );
    expect(answer.proposal.notes.some((note) => note.startsWith("Still: background-check"))).toBe(
      true,
    );

    const followUp = propose("Verify identity first", {
      items: answer.proposal.items,
      selection: [],
      focusId: null,
      nextId: idSource("lisp-outline", answer.proposal.items),
    });
    if (followUp._tag !== "Proposal") throw new Error("expected a proposal");
    expect(analyze(followUp.proposal.items).warnings.size).toBe(0);
    const moved = treeDiff(answer.proposal.items, followUp.proposal.items).map(
      (row) => `${"  ".repeat(row.depth)}${row.status} ${row.text}`,
    );
    expect(moved).toEqual([
      "Same workflow onboarding",
      "  Moved verify-identity",
      "  Same parallel",
      "    Same background-check",
      "    Moved collect-i9",
      "    Removed sequence",
      "  Same create-payroll-record",
      "  Same activate",
    ]);
    expect(printOutline([byText(followUp.proposal.items, "workflow onboarding")]).text).toBe(
      [
        "(workflow onboarding",
        "  verify-identity",
        "  (parallel",
        "    background-check",
        "    collect-i9)",
        "  create-payroll-record",
        "  activate)",
      ].join("\n"),
    );
  });

  it("diffs the proposal structurally", () => {
    const steps = ["background-check", "collect-i9"].map((text) => byText(sampleOutline, text).id);
    const answer = propose("in parallel", {
      items: sampleOutline,
      selection: steps,
      focusId: null,
      nextId: idSource("lisp-outline", sampleOutline),
    });
    if (answer._tag !== "Proposal") throw new Error("expected a proposal");
    const rows = treeDiff(sampleOutline, answer.proposal.items);
    expect(rows.map((row) => `${"  ".repeat(row.depth)}${row.status} ${row.text}`)).toEqual([
      "Same workflow onboarding",
      "  Added parallel",
      "    Moved background-check",
      "    Moved collect-i9",
      "  Same create-payroll-record",
      "  Same activate",
    ]);
  });
});

describe("language services for rows", () => {
  it("describes definitions, locals, built-ins, and keywords", () => {
    const items = sampleOutline;
    const analysis = analyze(items);
    const round = byText(items, "round (+ revenue tax) 2");
    expect(describeAt(items, analysis, round.id, 10)).toMatchObject({
      from: 9,
      to: 16,
      kind: "local",
      value: { type: "number", text: "1200", count: 4 },
    });
    expect(describeAt(items, analysis, round.id, 1)).toMatchObject({
      kind: "built-in",
      usage: "(round x digits)",
    });
    const call = byText(items, "invoice-total 100");
    expect(describeAt(items, analysis, call.id, 13)).toBeUndefined();
    expect(describeAt(items, analysis, call.id, 13, true)).toMatchObject({
      kind: "function",
      usage: "(invoice-total revenue)",
      summary: "Revenue plus sales tax, rounded to cents.",
    });
    const tax = byText(items, "def tax-rate 0.0825");
    expect(describeAt(items, analysis, tax.id, 5)).toMatchObject({
      kind: "definition",
      value: { type: "number", text: "0.0825" },
    });
    const step = byText(items, 'defstep verify-identity {:system "Persona" :writes [:identity]}');
    expect(describeAt(items, analysis, step.id, step.text.indexOf(":identity") + 1)).toMatchObject({
      kind: "keyword",
      facts: [
        ["Written by", "verify-identity"],
        ["Read by", "background-check, collect-i9"],
      ],
    });
  });

  it("places errors on the expression that raised them", () => {
    const items: Items = [item("a", "(+ 1 tax-rat)"), item("b", "(+ 1 (")];
    const analysis = analyze(items);
    expect(diagnosticsOf(analysis, byText(items, "(+ 1 tax-rat)"))).toEqual([
      { from: 5, to: 12, severity: "error", message: "tax-rat is not defined" },
    ]);
    expect(diagnosticsOf(analysis, byText(items, "(+ 1 ("))).toEqual([
      { from: 5, to: 6, severity: "error", message: "Missing )" },
    ]);
  });
});
