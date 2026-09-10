import { describe, expect, it } from "vitest";

import { virtualWindow } from "./virtualization";

describe("virtualWindow", () => {
  it("renders the visible rows plus overscan at the top", () => {
    expect(virtualWindow(
      100,
      50,
      { scrollTop: 0, height: 250 },
      2,
    )).toEqual({
      startIndex: 0,
      endIndex: 7,
      paddingTop: 0,
      paddingBottom: 4_650,
    });
  });

  it("accounts for the sticky header while scrolling", () => {
    expect(virtualWindow(
      100,
      50,
      { scrollTop: 539, height: 250 },
      2,
    )).toEqual({
      startIndex: 8,
      endIndex: 17,
      paddingTop: 400,
      paddingBottom: 4_150,
    });
  });

  it("keeps a selected row mounted and handles an empty grid", () => {
    expect(virtualWindow(
      100,
      50,
      { scrollTop: 0, height: 250 },
      2,
      80,
    )).toEqual({
      startIndex: 0,
      endIndex: 81,
      paddingTop: 0,
      paddingBottom: 950,
    });
    expect(virtualWindow(0, 50, { scrollTop: 0, height: 250 })).toEqual({
      startIndex: 0,
      endIndex: 0,
      paddingTop: 0,
      paddingBottom: 0,
    });
  });
});
