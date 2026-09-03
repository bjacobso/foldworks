import { describe, expect, it } from "vitest";

import { DEFAULT_ACTIVATION_THRESHOLD, init } from "./interaction";

describe("workflow drag interaction", () => {
  it("defaults to an eight-pixel threshold and passes through orientation", () => {
    expect(init({ id: "workflow" })).toMatchObject({
      activationThreshold: DEFAULT_ACTIVATION_THRESHOLD,
      orientation: "Vertical",
    });
    expect(init({ id: "workflow", orientation: "Horizontal" }).orientation)
      .toBe("Horizontal");
  });

  it("allows consumers to override the activation threshold", () => {
    expect(init({ id: "workflow", activationThreshold: 12 }).activationThreshold)
      .toBe(12);
  });
});
