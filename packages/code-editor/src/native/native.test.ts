import { describe, expect, it } from "vitest";
import { applyEdits, validOffset } from "../document";
import { init, type Model } from "./model";
import { Message } from "./message";
import { update } from "./update";
import { difference, invert, editingPlan, pairPlan, findMatches, completions } from "./operations";
import { historyPlan } from "./history";
import { tokenize, lineStarts, lineAt } from "./tokenize";
import { visibleLines } from "./view";

const ready = (text = "", languageId = "text") => update(init({ id: "native", text, languageId }), Message.Mounted({ session: 0, lease: "test" })).model;
const edit = (model: Model, text: string, kind = "input", time = 0) => update(model, Message.Edited({
  session: model.document.session, lease: model.lease, baseRevision: model.document.revision,
  edits: difference(model.document.text, text), before: model.selection,
  selection: { anchor: text.length, head: text.length }, kind, time, groupId: 0,
})).model;
const travel = (model: Model, direction: "undo" | "redo") => {
  const plan = historyPlan(model, direction)!;
  return update(model, Message.Edited({ ...plan, session: model.document.session, lease: model.lease,
    baseRevision: model.document.revision, before: model.selection, kind: direction, time: 1000,
  })).model;
};

describe("native document and history", () => {
  it("diffs Unicode replacements without splitting surrogate pairs", () => {
    for (const before of ["", "😀", "😁", "a😀b", "a😃b", "👩‍💻é", "abc"]) {
      for (const after of ["", "😀", "😃", "a😁b", "👩‍💻é", "abc"]) {
        const edits = difference(before, after);
        expect(applyEdits(before, edits)).toBe(after);
        expect(applyEdits(after, invert(before, edits))).toBe(before);
        expect(edits.every((edit) => validOffset(before, edit.from) && validOffset(before, edit.to))).toBe(true);
      }
    }
  });
  it("inverts disjoint replacements in their resulting coordinates", () => {
    const before = "alpha bravo charlie";
    const edits = [{ from: 0, to: 5, insert: "A" }, { from: 12, to: 19, insert: "CCCC" }];
    const after = applyEdits(before, edits);
    expect(after).toBe("A bravo CCCC");
    expect(applyEdits(after, invert(before, edits))).toBe(before);
  });
  it("groups contiguous typing, restores selection, and redoes the group", () => {
    const model = edit(edit(ready(), "a", "insertText", 10), "ab", "insertText", 20);
    expect(model.past).toHaveLength(1);
    expect(model.past[0]!.steps).toHaveLength(2);
    const undone = travel(model, "undo");
    expect(undone.document.text).toBe("");
    expect(undone.selection).toEqual({ anchor: 0, head: 0 });
    expect(travel(undone, "redo").document.text).toBe("ab");
  });
  it("breaks history groups after pauses and discards redo after branching", () => {
    const model = edit(edit(ready(), "a", "insertText", 0), "ab", "insertText", 1000);
    expect(model.past).toHaveLength(2);
    const branch = edit(travel(model, "undo"), "ac");
    expect(branch.future).toHaveLength(0);
    expect(travel(branch, "undo").document.text).toBe("a");
  });
  it("groups a composition session independently of elapsed time", () => {
    const model = edit(edit(ready(), "に", "composition:lease:1", 1), "日本", "composition:lease:1", 5000);
    expect(model.past).toHaveLength(1);
    expect(travel(model, "undo").document.text).toBe("");
    expect(edit(model, "日本語", "composition:lease:2", 5001).past).toHaveLength(2);
  });
  it("rejects stale revisions and ignores messages from an old mount", () => {
    const model = edit(ready(), "new");
    const event = Message.Edited({ session: 0, lease: "test", baseRevision: 0, edits: [{ from: 0, to: 0, insert: "old" }], before: model.selection, selection: { anchor: 0, head: 0 }, kind: "input", time: 0, groupId: 0 });
    expect(update(model, event).model.document.text).toBe("new");
    expect(update(model, event).outMessage?._tag).toBe("RejectedOperation");
    expect(update(model, { ...event, lease: "old" }).model).toBe(model);
  });
  it("resets document history and rejects diagnostics from previous sessions", () => {
    const model = edit(ready("{}", "json"), '{"x":1}');
    const next = update(model, Message.ReplaceDocument({ uri: model.document.uri, text: "{}", languageId: "json" })).model;
    expect(next.past).toHaveLength(0);
    expect(next.document.session).toBe(1);
    expect(update(next, Message.SetDiagnostics({ ...model.document, source: "lsp", diagnostics: [{ from: 0, to: 1, severity: "error", message: "stale" }] })).model).toBe(next);
  });
  it("validates JSON and preserves independent current diagnostic sources", () => {
    let model = ready('{"x": }', "json");
    expect(model.diagnostics[0]!.diagnostics).toHaveLength(1);
    model = update(model, Message.SetDiagnostics({ ...model.document, source: "lsp", diagnostics: [{ from: 0, to: 1, severity: "warning", message: "example" }] })).model;
    expect(model.diagnostics).toHaveLength(2);
    const changed = edit(model, '{"x": true}');
    expect(changed.diagnostics.flatMap((batch) => batch.diagnostics)).toHaveLength(0);
  });
});

describe("native editing commands", () => {
  it("indents selected lines without including the next line at a newline boundary", () => {
    const plan = editingPlan("one\ntwo\nthree", { anchor: 0, head: 8 }, "indent");
    expect(applyEdits("one\ntwo\nthree", plan.edits)).toBe("  one\n  two\nthree");
    expect(plan.selection).toEqual({ anchor: 2, head: 12 });
  });
  it("handles an empty first line and a backward selection", () => {
    const plan = editingPlan("\nabc", { anchor: 0, head: 0 }, "indent");
    expect(applyEdits("\nabc", plan.edits)).toBe("  \nabc");
    const backward = editingPlan("a\nb", { anchor: 3, head: 0 }, "indent");
    expect(backward.selection).toEqual({ anchor: 7, head: 2 });
  });
  it("inserts an indented line inside a pair and keeps the caret inside", () => {
    const plan = editingPlan("{}", { anchor: 1, head: 1 }, "newline");
    expect(applyEdits("{}", plan.edits)).toBe("{\n  \n}");
    expect(plan.selection.head).toBe(4);
    expect(pairPlan("", { anchor: 0, head: 0 }, "(")?.selection.head).toBe(1);
    expect(pairPlan(")", { anchor: 0, head: 0 }, ")")?.edits).toEqual([]);
  });
  it("toggles line comments and deletes the final line without leaving a blank line", () => {
    const text = "  one\n  two";
    const commented = editingPlan(text, { anchor: 0, head: text.length }, "comment");
    const after = applyEdits(text, commented.edits);
    expect(after).toBe("  // one\n  // two");
    expect(applyEdits(after, editingPlan(after, commented.selection, "comment").edits)).toBe(text);
    expect(applyEdits(text, editingPlan(text, { anchor: 9, head: 9 }, "deleteLine").edits)).toBe("  one");
  });
  it("searches literal expressions in original UTF-16 coordinates", () => {
    expect(findMatches("😀A.a İa", "a", false)).toEqual([{ from: 2, to: 3 }, { from: 4, to: 5 }, { from: 7, to: 8 }]);
    expect(findMatches("a.a", ".", true)).toEqual([{ from: 1, to: 2 }]);
    expect(findMatches("anything", "", false)).toEqual([]);
    expect(findMatches("x ".repeat(1200), "x", true)).toHaveLength(1000);
    expect(findMatches("x ".repeat(1200), "x", true, Infinity)).toHaveLength(1200);
  });
  it("suggests document words and keywords from the cursor prefix", () => {
    const text = "const customWidget = 1;\ncust";
    expect(completions(text, { anchor: text.length, head: text.length })).toEqual({ from: text.length - 4, items: ["customWidget"] });
    expect(completions("ret", { anchor: 3, head: 3 }).items).toContain("return");
  });
});

describe("native incremental highlighting and rendering", () => {
  it("propagates multiline lexical state and reuses the converged suffix", () => {
    const first = tokenize("/*\ninside\n*/\nconst n = 1;", "typescript");
    expect(first[1]!.tokens[0]!.kind).toBe("comment");
    const next = tokenize("//\ninside\n*/\nconst n = 1;", "typescript", first);
    expect(next[1]!.tokens[0]!.kind).toBe("plain");
    expect(next[3]).toBe(first[3]);
    const shifted = tokenize("// added\n//\ninside\n*/\nconst n = 1;", "typescript", next);
    expect(shifted[4]).toBe(next[3]);
  });
  it("keeps multiline templates intact and never splits an emoji token", () => {
    const lines = tokenize("const x = `hello\nworld`; 😀", "typescript");
    expect(lines[0]!.outgoing).toBe("template");
    expect(lines[1]!.outgoing).toBe("code");
    for (const line of lines) {
      expect(line.tokens.map((token) => line.text.slice(token.from, token.to)).join("")).toBe(line.text);
      expect(line.tokens.every((token) => validOffset(line.text, token.from) && validOffset(line.text, token.to))).toBe(true);
    }
  });
  it("computes line coordinates and renders a bounded window in large documents", () => {
    const model = ready(Array.from({ length: 2000 }, (_, i) => String(i)).join("\n"));
    const starts = lineStarts(model.lines);
    expect(lineAt(starts, starts[999]!)).toBe(999);
    const range = visibleLines({ ...model, viewport: { top: 22012, left: 0, height: 352 } });
    expect(range.from).toBe(992);
    expect(range.to - range.from).toBeLessThan(40);
    expect(visibleLines({ ...model, options: { ...model.options, lineWrapping: true } })).toEqual({ from: 0, to: 2000 });
  });
});
