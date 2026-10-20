import type { FieldId, Step, Values } from "./model";
import { ageOn, emailSuggestion, isEmail, parseDate, parseMonth, phoneDigits } from "./format";

/** Fields in visual order; Enter advances through them and errors focus the first. */
export const stepFields: Readonly<Record<Step, ReadonlyArray<FieldId>>> = {
  About: ["first-name", "last-name", "email", "phone", "dob"],
  Address: ["street", "apt", "city", "state", "zip"],
  Work: ["employment", "hours", "start-date", "shifts"],
  Background: [
    "license",
    "license-number",
    "cdl",
    "cdl-class",
    "rehire",
    "previous-location",
    "previous-end",
  ],
  Verify: ["otp"],
  Done: [],
};

/**
 * Follow-up questions exist only while the answer above them is "yes". Hidden
 * fields keep their values, so answering "yes" again restores them, but they
 * are never validated or required.
 */
export const isShown = (field: FieldId, values: Values): boolean => {
  switch (field) {
    case "license-number":
    case "cdl":
      return values.answers.license === "yes";
    case "cdl-class":
      return values.answers.license === "yes" && values.answers.cdl === "yes";
    case "previous-location":
    case "previous-end":
      return values.answers.rehire === "yes";
    default:
      return true;
  }
};

const required = (value: string, message: string) => (value.trim() === "" ? message : undefined);

export const fieldError = (field: FieldId, values: Values, today: string): string | undefined => {
  const text = values.text;
  if (!isShown(field, values)) return undefined;
  switch (field) {
    case "first-name":
      return required(text["first-name"], "Enter your first name.");
    case "last-name":
      return required(text["last-name"], "Enter your last name.");
    case "email":
      return (
        required(text.email, "Enter your email address.") ??
        (isEmail(text.email.trim()) ? undefined : "Enter an email like name@example.com.")
      );
    case "phone":
      return phoneDigits(text.phone).length === 10 ? undefined : "Enter a 10-digit mobile number.";
    case "dob": {
      const birth = parseDate(text.dob);
      if (birth === undefined) return "Enter a real date as MM/DD/YYYY.";
      const now = parseIso(today);
      if (now === undefined) return undefined;
      const age = ageOn(birth, now);
      return age < 16
        ? "You must be at least 16 to apply."
        : age > 100
          ? "Check the year you were born."
          : undefined;
    }
    case "street":
      return required(text.street, "Enter your street address.");
    case "apt":
      return undefined;
    case "city":
      return required(text.city, "Enter your city.");
    case "state":
      return values.state === "" ? "Choose your state." : undefined;
    case "zip":
      return /^\d{5}$/.test(text.zip) ? undefined : "Enter a 5-digit ZIP code.";
    case "employment":
      return values.employment === "" ? "Choose how you want to work." : undefined;
    case "hours":
      return values.hours >= 1 && values.hours <= 60 ? undefined : "Choose 1 to 60 hours.";
    case "start-date":
      return text["start-date"] === ""
        ? "Choose your earliest start date."
        : today !== "" && text["start-date"] < today
          ? "Choose today or a later date."
          : undefined;
    case "shifts":
      return values.shifts.length === 0 ? "Choose at least one shift." : undefined;
    case "license":
    case "cdl":
    case "rehire":
      return values.answers[field] === "" ? "Choose yes or no." : undefined;
    case "license-number":
      return required(text["license-number"], "Enter your license number.");
    case "cdl-class":
      return values.cdlClass === "" ? "Choose a CDL class." : undefined;
    case "previous-location":
      return required(text["previous-location"], "Enter the location.");
    case "previous-end": {
      const month = parseMonth(text["previous-end"]);
      return month === undefined
        ? "Enter a month as MM/YYYY."
        : today !== "" && month > today.slice(0, 7)
          ? "Choose a month that has passed."
          : undefined;
    }
    case "otp":
      return /^\d{6}$/.test(text.otp) ? undefined : "Enter the 6-digit code.";
  }
};

export const invalidFields = (step: Step, values: Values, today: string): ReadonlyArray<FieldId> =>
  stepFields[step].filter((field) => fieldError(field, values, today) !== undefined);

/** Only offer a correction once the address otherwise looks complete. */
export const emailFix = (email: string): string | undefined =>
  isEmail(email.trim()) ? emailSuggestion(email.trim()) : undefined;

const parseIso = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match === null
    ? undefined
    : { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};
