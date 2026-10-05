import { describe, expect, it } from "vitest";
import { applyEdits, type Selection } from "../document";
import { mapAnnotations, type Annotation } from "../annotations";
import { tokenize } from "../native/tokenize";
import { evaluationTarget, read } from "./reader";
import {
  closePlan,
  deletePlan,
  newlinePlan,
  reindentPlan,
  structuralPlan,
  type StructuralAction,
} from "./structure";

/** "|" marks a caret; "«" and "»" mark a selection's anchor and head. */
const parse = (marked: string): { text: string; selection: Selection } => {
  if (marked.includes("|")) {
    const head = marked.indexOf("|");
    return { text: marked.replace("|", ""), selection: { anchor: head, head } };
  }
  const anchor = marked.indexOf("«");
  const head = marked.replace("«", "").indexOf("»");
  return { text: marked.replace("«", "").replace("»", ""), selection: { anchor, head } };
};
const show = (text: string, selection: Selection) =>
  selection.anchor === selection.head
    ? `${text.slice(0, selection.head)}|${text.slice(selection.head)}`
    : `${text.slice(0, selection.anchor)}«${text.slice(selection.anchor, selection.head)}»${text.slice(selection.head)}`;
const run = (marked: string, action: StructuralAction) => {
  const { text, selection } = parse(marked);
  const plan = structuralPlan(text, selection, action);
  return plan ? show(applyEdits(text, plan.edits), plan.selection) : undefined;
};
const typed = (
  marked: string,
  plan: typeof closePlan | typeof newlinePlan | typeof reindentPlan,
) => {
  const { text, selection } = parse(marked);
  const result = plan(text, selection);
  return result ? show(applyEdits(text, result.edits), result.selection) : undefined;
};
const deleted = (marked: string, direction: "backward" | "forward") => {
  const { text, selection } = parse(marked);
  const result = deletePlan(text, selection, direction);
  return result ? show(applyEdits(text, result.edits), result.selection) : undefined;
};

describe("lisp reader", () => {
  it("reads nested collections, reader macros, strings, and comments with ranges", () => {
    const text = `(defn f [x] ; comment\n  #{:a 'b} "s)" #"re" \\( @x)`;
    const { forms, problems } = read(text);
    expect(problems).toEqual([]);
    expect(forms).toHaveLength(1);
    const kinds = forms[0]!.children.map((form) => form.kind);
    expect(kinds).toEqual([
      "symbol",
      "symbol",
      "vector",
      "set",
      "string",
      "regex",
      "char",
      "prefix",
    ]);
    expect(text.slice(forms[0]!.children[3]!.from, forms[0]!.children[3]!.to)).toBe("#{:a 'b}");
  });
  it("recovers from unclosed and stray delimiters", () => {
    expect(read("(a (b").problems).toHaveLength(2);
    const stray = read("a) (b]");
    expect(stray.problems.map((problem) => problem.message)).toEqual([
      "Unexpected ).",
      "Expected ) but found ].",
    ]);
    expect(stray.forms.map((form) => form.kind)).toEqual(["symbol", "list"]);
  });
  it("targets top-level forms, and forms inside rich comment blocks", () => {
    const text = "(def a 1)\n\n(comment\n  (inc a)\n  (dec a))";
    const at = (needle: string) => {
      const form = evaluationTarget(text, text.indexOf(needle) + 1)!;
      return text.slice(form.from, form.to);
    };
    expect(at("def")).toBe("(def a 1)");
    expect(at("inc")).toBe("(inc a)");
    expect(at("dec")).toBe("(dec a)");
  });
});

describe("structural editing", () => {
  it("expands and contracts selection by form", () => {
    expect(run("(a (b c|d) e)", "expandSelection")).toBe("(a (b «cd») e)");
    expect(run("(a (b «cd») e)", "expandSelection")).toBe("(a («b cd») e)");
    expect(run("(a («b cd») e)", "expandSelection")).toBe("(a «(b cd)» e)");
    expect(run("(a «(b cd)» e)", "expandSelection")).toBe("(«a (b cd) e»)");
    expect(run("(a «(b cd)» e)", "contractSelection")).toBe("(a («b cd») e)");
  });
  it("moves over whole forms and out of collections", () => {
    expect(run("(a| (b c) d)", "forwardForm")).toBe("(a (b c)| d)");
    expect(run("(a (b c) d|)", "forwardForm")).toBe("(a (b c) d)|");
    expect(run("(a (b c) |d)", "backwardForm")).toBe("(a |(b c) d)");
    expect(run("(|a)", "backwardForm")).toBe("|(a)");
  });
  it("slurps and barfs", () => {
    expect(run("(a |b) c d", "slurp")).toBe("(a |b c) d");
    expect(run("(|) c", "slurp")).toBe("(|c)");
    expect(run("[(a |b)] c", "slurp")).toBe("[(a |b) c]");
    expect(run("(a |b c)", "barf")).toBe("(a |b) c");
    expect(run("(a b |c)", "barf")).toBe("(a b) |c");
    expect(run("{:a |1}", "barf")).toBe("{:a} |1");
  });
  it("raises, splices, and wraps", () => {
    expect(run("(f (g |x) y)", "raise")).toBe("(f |x y)");
    expect(run("(f «(g x)» y)", "raise")).toBe("«(g x)»");
    expect(run("(a (b |c) d)", "splice")).toBe("(a b |c d)");
    expect(run("(a #{|b} d)", "splice")).toBe("(a |b d)");
    expect(run("(map |inc xs)", "wrap")).toBe("(map (| inc) xs)");
  });
  it("leaves forms with a closer, removing whitespace before it", () => {
    expect(typed("(a (b c|  ) d)", closePlan)).toBe("(a (b c)| d)");
    expect(typed("(a (b| c) d)", closePlan)).toBe("(a (b c)| d)");
    expect(typed('(a "b|)")', closePlan)).toBeUndefined();
  });
  it("deletes empty pairs together and steps over nonempty delimiters", () => {
    expect(deleted("(a (|))", "backward")).toBe("(a |)");
    expect(deleted("(a ()|)", "backward")).toBe("(a |)");
    expect(deleted("(a (b)|)", "backward")).toBe("(a (b|))");
    expect(deleted("(a (|b))", "backward")).toBe("(a |(b))");
    expect(deleted('(a "|")', "backward")).toBe("(a |)");
    expect(deleted("(a |(b))", "forward")).toBe("(a (|b))");
    expect(deleted("(a| b)", "backward")).toBeUndefined();
  });
  it("indents new lines by form", () => {
    expect(typed("(defn f [x]|  (inc x))", newlinePlan)).toBe("(defn f [x]\n  |(inc x))");
    expect(typed("(foo bar|baz)", newlinePlan)).toBe("(foo bar\n     |baz)");
    expect(typed("{:a 1|:b 2}", newlinePlan)).toBe("{:a 1\n |:b 2}");
    expect(typed("(let [a 1|b 2])", newlinePlan)).toBe("(let [a 1\n      |b 2])");
  });
  it("reindents a document, accounting for lines it already moved", () => {
    const text = "(defn f [x]\n(let [y (inc x)\nz 2]\n(+ y\nz)))|";
    expect(typed(text, reindentPlan)).toBe(
      "(defn f [x]\n  (let [y (inc x)\n        z 2]\n    (+ y\n       z)))|",
    );
  });
});

describe("lisp highlighting and annotations", () => {
  it("highlights specials, call heads, keywords, and strings across lines", () => {
    const [first, second] = tokenize('(defn f [x] (str :a "multi\nline"))', "clojure");
    const kind = (word: string) =>
      first!.tokens.find((token) => first!.text.slice(token.from, token.to) === word)?.kind;
    expect(kind("defn")).toBe("keyword");
    expect(kind("str")).toBe("property");
    expect(kind(":a")).toBe("type");
    expect(kind("x")).toBe("plain");
    expect(first!.outgoing).toBe("lisp-string");
    expect(second!.tokens[0]).toEqual({ from: 0, to: 5, kind: "string" });
  });
  it("maps annotations through edits and marks touched ranges stale", () => {
    const item: Annotation = { from: 4, to: 9, label: "2", tone: "value", stale: false };
    expect(mapAnnotations([item], [{ from: 0, to: 0, insert: "xx" }])).toEqual([
      { ...item, from: 6, to: 11 },
    ]);
    expect(mapAnnotations([item], [{ from: 9, to: 9, insert: "\n" }])).toEqual([item]);
    expect(mapAnnotations([item], [{ from: 4, to: 4, insert: " " }])).toEqual([
      { ...item, from: 5, to: 10 },
    ]);
    expect(mapAnnotations([item], [{ from: 6, to: 7, insert: "3" }])).toEqual([
      { ...item, stale: true },
    ]);
  });
});
