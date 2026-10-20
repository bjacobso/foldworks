/**
 * Pure formatting and validation for the mobile candidate form. Masks keep
 * only digits in the model's source of truth and derive the display string, so
 * autofill, paste, and mid-string edits all converge on the same value.
 */

export const digitsOf = (value: string): string => value.replace(/\D/g, "");

/** Accepts autofilled `+1 (555) 123-4567` and `15551234567` as ten national digits. */
export const phoneDigits = (value: string): string => {
  const digits = digitsOf(value);
  return (digits.length > 10 && digits.startsWith("1") ? digits.slice(1) : digits).slice(0, 10);
};

export const formatPhone = (value: string): string => {
  const d = phoneDigits(value);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

export const formatDate = (value: string): string => {
  const d = digitsOf(value).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

export const formatMonth = (value: string): string => {
  const d = digitsOf(value).slice(0, 6);
  return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
};

/** ZIP+4 from autofill keeps the five-digit ZIP. */
export const formatZip = (value: string): string => digitsOf(value).slice(0, 5);

export const formatOtp = (value: string): string => digitsOf(value).slice(0, 6);

export const MaskKind = ["Phone", "Date", "Month", "Zip", "Otp"] as const;
export type MaskKind = (typeof MaskKind)[number];

export const formatMask = (kind: MaskKind, value: string): string => {
  switch (kind) {
    case "Phone":
      return formatPhone(value);
    case "Date":
      return formatDate(value);
    case "Month":
      return formatMonth(value);
    case "Zip":
      return formatZip(value);
    case "Otp":
      return formatOtp(value);
  }
};

/** The caret index in `formatted` just after its `digitCount`-th digit. */
export const caretAfterDigits = (formatted: string, digitCount: number): number => {
  if (digitCount <= 0) return formatted.search(/\d/) === -1 ? 0 : formatted.search(/\d/);
  let seen = 0;
  for (let index = 0; index < formatted.length; index++) {
    if (/\d/.test(formatted[index]!)) seen++;
    if (seen === digitCount) return index + 1;
  }
  return formatted.length;
};

const domainTypos: Readonly<Record<string, string>> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
};

/** A corrected address for a well-known misspelled domain, if any. */
export const emailSuggestion = (email: string): string | undefined => {
  const at = email.lastIndexOf("@");
  if (at < 1) return undefined;
  const fix = domainTypos[email.slice(at + 1).toLowerCase()];
  return fix === undefined ? undefined : `${email.slice(0, at)}@${fix}`;
};

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

export type CalendarDate = Readonly<{ year: number; month: number; day: number }>;

export const parseDate = (value: string): CalendarDate | undefined => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (match === null) return undefined;
  const [month, day, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? { year, month, day }
    : undefined;
};

/** A MM/YYYY month as a comparable `YYYY-MM` string. */
export const parseMonth = (value: string): string | undefined => {
  const match = /^(\d{2})\/(\d{4})$/.exec(value);
  if (match === null) return undefined;
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? `${match[2]}-${match[1]}` : undefined;
};

export const ageOn = (birth: CalendarDate, today: CalendarDate): number =>
  today.year -
  birth.year -
  (today.month < birth.month || (today.month === birth.month && today.day < birth.day) ? 1 : 0);
