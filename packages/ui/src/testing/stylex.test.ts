import * as aliased from "@stylexjs/stylex";
import { describe, expect, it } from "vitest";

import * as stylex from "./stylex";

describe("StyleX test runtime", () => {
  it("replaces @stylexjs/stylex through foldworksStylexTest", () => {
    expect(aliased.create).toBe(stylex.create);
  });

  it("uses style keys as class names and skips falsy styles", () => {
    const styles = stylex.create({ root: { color: "red" }, active: { color: "blue" } });
    const isActive = false;

    expect(styles.root).toBe("root");
    expect(stylex.props(styles.root, isActive && styles.active, null, [styles.active])).toEqual({
      className: "root active",
    });
  });

  it("keeps dynamic style keys and exposes primitive values inline", () => {
    const styles = stylex.create({
      box: (width: number, color: string) => ({
        backgroundColor: { default: color, ":hover": "black" },
        color,
        width,
      }),
    });

    expect(stylex.props(styles.box(40, "red"))).toEqual({
      className: "box",
      style: { color: "red", width: 40 },
    });
    expect(stylex.attrs(styles.box(40, "red"))).toEqual({
      class: "box",
      style: "color:red;width:40",
    });
  });

  it("stands in for the other compile-time APIs", () => {
    expect(stylex.defineConsts({ gap: "8px" })).toEqual({ gap: "8px" });
    expect(stylex.defineVars({ accent: "red" })).toEqual({ accent: "var(--accent)" });
    expect(stylex.firstThatWorks("100dvh", "100vh")).toBe("100dvh");
    expect(stylex.types.color("red")).toBe("red");
    expect(typeof stylex.keyframes({ from: { opacity: 0 } })).toBe("string");
    expect(typeof stylex.when.ancestor(":hover")).toBe("string");
  });
});
