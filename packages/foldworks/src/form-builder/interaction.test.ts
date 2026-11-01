import { describe, expect, it } from "vitest";

import { DEFAULT_ACTIVATION_THRESHOLD, DEFAULT_ID, init } from "./interaction";

describe("form builder drag interaction", () => {
  it("uses a forgiving pointer activation threshold by default", () => {
    expect(init({ id: "form" }).activationThreshold).toBe(DEFAULT_ACTIVATION_THRESHOLD);
    expect(DEFAULT_ACTIVATION_THRESHOLD).toBe(8);
  });

  it("allows consumers to override the activation threshold", () => {
    expect(init({ id: "form", activationThreshold: 12 }).activationThreshold).toBe(12);
  });

  it("provides an id and orientation while allowing orientation overrides", () => {
    expect(init()).toMatchObject({ id: DEFAULT_ID, orientation: "Vertical" });
    expect(init({ orientation: "Horizontal" }).orientation).toBe("Horizontal");
  });
});
