import { describe, expect, it } from "vitest";
import { read } from "@foldworks/code-editor/lisp";
import { createImage, evaluateRanges, imageFor } from "./interpreter";
import { ledgerSample } from "./sample";

const run = (source: string) => {
  const outcomes = evaluateRanges(createImage(), source, [{ from: 0, to: source.length }], {
    skipCommentBlocks: true,
  });
  return outcomes.map((outcome) =>
    outcome.status === "error" ? `error: ${outcome.pretty}` : outcome.inline,
  );
};

describe("demo lisp interpreter", () => {
  it("evaluates core forms, destructuring, recursion, and short functions", () => {
    expect(run("(+ 1 2 3)")).toEqual(["6"]);
    expect(run("(let [[a b & more] [1 2 3 4] {:keys [x]} {:x 5}] [a b more x])")).toEqual([
      "[1 2 (3 4) 5]",
    ]);
    expect(
      run(
        "(defn fact [n] (loop [n n acc 1] (if (zero? n) acc (recur (dec n) (* acc n))))) (fact 10)",
      ),
    ).toEqual(["#'user/fact", "3628800"]);
    expect(run("(map #(* % %) (range 4))")).toEqual(["(0 1 4 9)"]);
    expect(run("(defn f ([] :none) ([x] x)) [(f) (f 1)]")).toEqual(["#'user/f", "[:none 1]"]);
    expect(run("(-> {:a 1} (assoc :b 2) (update :a inc))")).toEqual(["{:a 2, :b 2}"]);
    expect(run("(frequencies [:a :b :a])")).toEqual(["{:a 2, :b 1}"]);
    expect(run('(str/join ", " (map str/upper-case ["a" "b"]))')).toEqual(['"A, B"']);
  });
  it("locates errors and stops runaway evaluation", () => {
    const [outcome] = evaluateRanges(createImage(), "(+ 1 (inc nil))", [{ from: 0, to: 15 }], {
      skipCommentBlocks: true,
    });
    expect(outcome!.status).toBe("error");
    expect(outcome!.pretty).toBe("inc expects numbers, got nil.");
    expect(run("(loop [] (recur))")).toEqual(["error: Evaluation stopped after 200,000 steps."]);
    expect(run("(undefined-thing)")).toEqual(["error: Unable to resolve symbol: undefined-thing."]);
  });
  it("evaluates the ledger sample, skipping the rich comment block", () => {
    const outcomes = evaluateRanges(createImage(), ledgerSample, read(ledgerSample).forms, {
      skipCommentBlocks: true,
    });
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      "var",
      "var",
      "var",
      "var",
      "value",
      "value",
    ]);
    expect(outcomes[4]!.inline).toBe("118");
    expect(outcomes[5]!.table?.columns).toEqual([":category", ":count", ":spent"]);
    expect(outcomes[5]!.table?.rows[0]).toEqual([":groceries", "2", "85.5"]);
  });
  it("keeps definitions in a persistent image between evaluations", () => {
    const image = createImage();
    evaluateRanges(image, "(def x 41)", [{ from: 0, to: 10 }], { skipCommentBlocks: false });
    const [outcome] = evaluateRanges(image, "(inc x)", [{ from: 0, to: 7 }], {
      skipCommentBlocks: false,
    });
    expect(outcome!.inline).toBe("42");
    const [printed] = evaluateRanges(image, '(println "hi" x)', [{ from: 0, to: 16 }], {
      skipCommentBlocks: false,
    });
    expect(printed!.output).toEqual(["hi 41"]);
  });
});

describe("demo lisp images", () => {
  it("loads the file into a missing image before evaluating against it", () => {
    const image = imageFor("restored-after-reload", "(def answer 41)\n(comment (def ignored 1))");
    const [outcome] = evaluateRanges(image, "(inc answer)", [{ from: 0, to: 12 }], {
      skipCommentBlocks: false,
    });
    expect(outcome!.inline).toBe("42");
    expect(image.globals.lookup("ignored")).toBeUndefined();
  });
});
