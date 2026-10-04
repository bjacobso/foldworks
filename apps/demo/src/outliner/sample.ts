import { parseOutline, setCollapsed, walk, type Items } from "@foldworks/outliner";

export const OUTLINE_ID = "foldworks-outline";

const source = `
- Spring field guide
  - Why we're writing it
    - New volunteers keep asking the same twenty questions
    - The old binder is out of date and lives in one closet
  - Chapters
    - [x] Getting to the trailheads
    - [x] What to pack
      - Water, two liters at least
      - Layers — mornings start near freezing
      - Paper map; phones lose signal past the ridge
    - [ ] Reading the weather
    - [ ] Birds you'll hear before you see
      - Varied thrush
      - Pacific wren
      - Sooty grouse
    - [ ] Leave-no-trace basics
  - Open questions
    - Print run: 200 or 500?
    - Who owns updates after the first season?
- Volunteer day, April 12
  - Trail crew
  - Signage
  - Lunch
- Someday
  - A night-sky chapter
  - Audio recordings of each bird call
`;

const sample = (): Items => {
  let counter = 0;
  const items = parseOutline(source, () => `${OUTLINE_ID}-${++counter}`);
  const collapsedTitles = new Set(["Birds you'll hear before you see", "Volunteer day, April 12"]);
  return walk(items)
    .filter((node) => collapsedTitles.has(node.text))
    .reduce((current, node) => setCollapsed(current, node.id, true), items);
};

export const sampleOutline = sample();
