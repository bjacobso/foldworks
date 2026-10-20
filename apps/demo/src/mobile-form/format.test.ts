import { describe, expect, it } from "vitest";

import {
  ageOn,
  caretAfterDigits,
  emailSuggestion,
  formatDate,
  formatMonth,
  formatPhone,
  formatZip,
  parseDate,
  parseMonth,
} from "./format";
import { filterStates } from "./states";

describe("mobile form formatting", () => {
  it("formats phone numbers as they are typed and accepts autofilled country codes", () => {
    expect(formatPhone("555")).toBe("555");
    expect(formatPhone("5551")).toBe("(555) 1");
    expect(formatPhone("5551234567")).toBe("(555) 123-4567");
    expect(formatPhone("+1 (555) 123-4567")).toBe("(555) 123-4567");
    expect(formatPhone("15551234567")).toBe("(555) 123-4567");
    expect(formatPhone("555123456789")).toBe("(555) 123-4567");
  });

  it("formats dates and ZIP codes from digits alone", () => {
    expect(formatDate("07")).toBe("07");
    expect(formatDate("0704")).toBe("07/04");
    expect(formatDate("07/04/1990")).toBe("07/04/1990");
    expect(formatDate("0704199012")).toBe("07/04/1990");
    expect(formatZip("94612-1234")).toBe("94612");
    expect(formatMonth("06")).toBe("06");
    expect(formatMonth("062022")).toBe("06/2022");
    expect(parseMonth("06/2022")).toBe("2022-06");
    expect(parseMonth("13/2022")).toBeUndefined();
  });

  it("places the caret after the same digit once separators move", () => {
    expect(caretAfterDigits("(555) 129-3456", 6)).toBe(9);
    expect(caretAfterDigits("(555) 123-4567", 3)).toBe(4);
    expect(caretAfterDigits("(555) 1", 0)).toBe(1);
    expect(caretAfterDigits("07/04", 4)).toBe(5);
  });

  it("validates real calendar dates and ages", () => {
    expect(parseDate("02/29/2024")).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseDate("02/29/2023")).toBeUndefined();
    expect(parseDate("13/01/2000")).toBeUndefined();
    expect(ageOn({ year: 2000, month: 7, day: 4 }, { year: 2016, month: 7, day: 3 })).toBe(15);
    expect(ageOn({ year: 2000, month: 7, day: 4 }, { year: 2016, month: 7, day: 4 })).toBe(16);
  });

  it("suggests corrections for common email domain typos only", () => {
    expect(emailSuggestion("ada@gmial.com")).toBe("ada@gmail.com");
    expect(emailSuggestion("ada@hotmial.com")).toBe("ada@hotmail.com");
    expect(emailSuggestion("ada@example.com")).toBeUndefined();
  });

  it("finds states by name, word prefix, or postal code", () => {
    expect(filterStates("cal").map((state) => state.code)).toEqual(["CA"]);
    expect(filterStates("york").map((state) => state.code)).toEqual(["NY"]);
    expect(filterStates("tx").map((state) => state.code)).toEqual(["TX"]);
    expect(filterStates("")).toHaveLength(51);
  });
});
