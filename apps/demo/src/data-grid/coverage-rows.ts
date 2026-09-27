// A synthetic I-9 coverage matrix at the size of the real one: 279 gated
// fields, each followed by its conditions, for 1,467 rows in total.

export const journeys = [
  "U.S. citizen, remote hire",
  "Lawful permanent resident",
  "Noncitizen national",
  "Authorized alien with I-94",
  "Preparer or translator assisted",
  "Rehire within three years",
  "Reverification after expiry",
  "Minor with parent attestation",
  "Authorized representative, Section 2",
] as const;

export type Outcome = "Holds" | "Fails" | "Skipped";

export type CoverageRow = Readonly<{
  id: string;
  kind: "Field" | "Condition";
  label: string;
  code: string;
  page: string;
  type: string;
  outcomes: ReadonlyArray<Outcome>;
  covered: number;
  isGap: boolean;
  gapCount: number;
  children?: ReadonlyArray<CoverageRow>;
}>;

export const FIELD_COUNT = 279;
export const CONDITION_COUNT = 1_188;

const pages = ["Section 1", "Section 2", "Supplement A", "Supplement B"] as const;
const subjects = [
  "Last name",
  "First name",
  "Middle initial",
  "Other last names",
  "Street address",
  "Apartment number",
  "City or town",
  "State",
  "ZIP code",
  "Date of birth",
  "Social Security number",
  "Email address",
  "Telephone number",
  "Citizenship status",
  "USCIS A-number",
  "Expiration date",
  "Form I-94 number",
  "Foreign passport number",
  "Country of issuance",
  "Employee signature",
  "Signature date",
  "Document title",
  "Issuing authority",
  "Document number",
  "First day of employment",
  "Employer name",
  "Employer title",
  "Business address",
  "Preparer name",
  "Preparer signature",
  "Rehire date",
  "New name",
  "Additional information",
  "Alternative procedure",
];
const types = ["Text", "Date", "Select", "Checkbox", "Signature", "Number"] as const;
const operators = ["equals", "is not", "is before", "is after", "is present", "is blank"] as const;
const answers = [
  "Citizen",
  "Permanent resident",
  "Noncitizen national",
  "Authorized alien",
  "Rehire",
  "Reverification",
  "Minor",
  "List A",
  "List B + C",
  "Remote",
];

// Deterministic pseudo-random values keep the fixture and screenshots stable.
const noise = (...values: ReadonlyArray<number>): number => {
  let hash = 2_166_136_261;
  for (const value of values) {
    hash ^= value;
    hash = Math.imul(hash, 16_777_619);
  }
  hash ^= hash >>> 13;
  return (hash >>> 0) / 4_294_967_296;
};

const conditionCounts = (): ReadonlyArray<number> => {
  const counts = Array.from(
    { length: FIELD_COUNT },
    (_, index) => 2 + Math.floor(noise(index, 17) * 6),
  );
  let difference = CONDITION_COUNT - counts.reduce((total, count) => total + count, 0);
  for (let index = 0; difference !== 0; index = (index + 7) % FIELD_COUNT) {
    const step = Math.sign(difference);
    const next = (counts[index] ?? 0) + step;
    if (next >= 1 && next <= 8) {
      counts[index] = next;
      difference -= step;
    }
  }
  return counts;
};

const coveredCount = (outcomes: ReadonlyArray<Outcome>): number =>
  outcomes.filter((outcome) => outcome === "Holds").length;

export const coverageRows: ReadonlyArray<CoverageRow> = conditionCounts().map(
  (count, fieldIndex) => {
    const subject = subjects[fieldIndex % subjects.length] ?? "Field";
    const page = pages[Math.floor((fieldIndex / FIELD_COUNT) * pages.length)] ?? "Section 1";
    const repeat = Math.floor(fieldIndex / subjects.length);
    const fieldId = `field-${String(fieldIndex + 1).padStart(3, "0")}`;
    const children = Array.from({ length: count }, (_, conditionIndex): CoverageRow => {
      const isGap = noise(fieldIndex, conditionIndex, 3) < 0.07;
      const outcomes = journeys.map((_, journeyIndex): Outcome => {
        const roll = noise(fieldIndex, conditionIndex, journeyIndex);
        if (isGap) return roll < 0.4 ? "Skipped" : "Fails";
        return roll < 0.38 ? "Holds" : roll < 0.8 ? "Fails" : "Skipped";
      });
      // Every non-gap condition holds in at least one journey.
      const adjusted =
        !isGap && coveredCount(outcomes) === 0
          ? outcomes.map((outcome, index) =>
              index === (fieldIndex + conditionIndex) % journeys.length ? "Holds" : outcome,
            )
          : outcomes;
      const operator = operators[(fieldIndex + conditionIndex) % operators.length] ?? "equals";
      const answer = answers[(fieldIndex * 3 + conditionIndex) % answers.length] ?? "Citizen";
      return {
        id: `${fieldId}:condition-${conditionIndex + 1}`,
        kind: "Condition",
        label:
          operator === "is present" || operator === "is blank"
            ? `${subjects[(fieldIndex + conditionIndex + 3) % subjects.length]} ${operator}`
            : `Status ${operator} ${answer}`,
        code: `c${conditionIndex + 1}`,
        page,
        type: "Condition",
        outcomes: adjusted,
        covered: coveredCount(adjusted),
        isGap,
        gapCount: isGap ? 1 : 0,
      };
    });
    const outcomes = journeys.map(
      (_, journeyIndex): Outcome =>
        children.some((child) => child.outcomes[journeyIndex] === "Holds") ? "Holds" : "Fails",
    );
    const covered = coveredCount(outcomes);
    const gapCount = children.filter((child) => child.isGap).length;
    return {
      id: fieldId,
      kind: "Field",
      label: repeat === 0 ? subject : `${subject} (${repeat + 1})`,
      code: `i9.${subject.toLowerCase().replaceAll(/[^a-z0-9]+/g, "_")}${repeat === 0 ? "" : `_${repeat + 1}`}`,
      page,
      type: types[fieldIndex % types.length] ?? "Text",
      outcomes,
      covered,
      isGap: covered === 0,
      gapCount,
      children,
    };
  },
);

export type CoverageFilter = Readonly<{ search: string; gapsOnly: boolean }>;

const matchesQuery = (row: CoverageRow, query: string): boolean =>
  query === "" || row.label.toLowerCase().includes(query) || row.code.includes(query);

let cache: Readonly<{ key: string; rows: ReadonlyArray<CoverageRow> }> | undefined;

/** Keeps a field when it or any of its conditions match. Rows are rebuilt
 * with filtered children, but IDs stay stable, so group expansion persists. */
export const filterCoverage = ({
  search,
  gapsOnly,
}: CoverageFilter): ReadonlyArray<CoverageRow> => {
  const query = search.trim().toLowerCase();
  const key = `${gapsOnly}:${query}`;
  if (cache?.key === key) return cache.rows;
  const rows =
    query === "" && !gapsOnly
      ? coverageRows
      : coverageRows.flatMap((field) => {
          const fieldMatches = matchesQuery(field, query);
          const children = (field.children ?? []).filter(
            (child) =>
              (!gapsOnly || child.isGap) &&
              ((query !== "" && fieldMatches) || matchesQuery(child, query)),
          );
          const keep = children.length > 0 || ((!gapsOnly || field.isGap) && fieldMatches);
          return keep ? [{ ...field, children }] : [];
        });
  cache = { key, rows };
  return rows;
};

export const countRows = (rows: ReadonlyArray<CoverageRow>): number =>
  rows.reduce((total, row) => total + 1 + (row.children?.length ?? 0), 0);

export const flattenedCoverage: ReadonlyMap<string, CoverageRow> = new Map(
  coverageRows.flatMap((field) => [field, ...(field.children ?? [])]).map((row) => [row.id, row]),
);
