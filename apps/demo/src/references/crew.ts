import { Mentions } from "@foldworks/text-intelligence";

/** Demo fixtures; production hosts supply their own lookup data. */
export const CREW: ReadonlyArray<Mentions.Entity> = [
  { id: "crew-maya", kind: "mention", name: "maya", label: "Maya Chen", description: "Trail lead" },
  {
    id: "crew-jonah",
    kind: "mention",
    name: "jonah",
    label: "Jonah Park",
    description: "Design and print",
  },
  { id: "crew-ada", kind: "mention", name: "ada", label: "Ada Ruiz", description: "Birding guide" },
  {
    id: "crew-sam",
    kind: "mention",
    name: "sam",
    label: "Sam Okafor",
    description: "Volunteer coordinator",
  },
];
export const crewData = (tags: ReadonlyArray<string>): Mentions.Data => ({
  entities: CREW,
  tags,
  unknownMention: (name) => `No one on the crew is called @${name}.`,
});
