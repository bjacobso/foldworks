import { Schema as S } from "effect";

export const ContactStatus = S.Literals(["Customer", "Prospect", "Partner"]);
export type ContactStatus = typeof ContactStatus.Type;
export const Relationship = S.Literals(["Strong", "Warm", "Weak"]);
export type Relationship = typeof Relationship.Type;

export const Contact = S.Struct({
  id: S.String,
  name: S.String,
  initials: S.String,
  email: S.String,
  company: S.String,
  title: S.String,
  city: S.String,
  status: ContactStatus,
  relationship: Relationship,
  lastContactMinutes: S.Number,
});
export type Contact = typeof Contact.Type;

const names = [
  "Landon Ziemke", "Robby Peters", "Colin Tobias", "Jessica Paddock",
  "Chris Smith", "Jason Battles", "Angela Monaghan", "Amanda Patrick",
  "Maya Chen", "Noah Williams", "Iris Patel", "Leo Martinez",
  "Ava Kim", "Theo Johnson", "Nina Okafor", "Ezra Silva",
];
const companies = [
  "Helpstone", "SemperVirens Ventures", "MorganFranklin Consulting", "Asymbl",
  "Northstar Labs", "Arc Systems", "Cedar & Co.", "Linear Works",
];
const titles = [
  "Founder and CEO", "Co-founder", "Partner", "VP of Operations",
  "Product lead", "Account executive", "People director", "Engineering manager",
];
const cities = ["San Francisco", "New York", "Austin", "London", "Toronto"];
const statuses: ReadonlyArray<ContactStatus> = ["Customer", "Prospect", "Partner"];
const relationships: ReadonlyArray<Relationship> = ["Strong", "Warm", "Strong", "Weak"];

export const contacts: ReadonlyArray<Contact> = Array.from({ length: 64 }, (_, index) => {
  const name = names[index % names.length] ?? "Alex Morgan";
  const company = companies[(index * 3) % companies.length] ?? "Acme";
  const [first = "alex", last = "morgan"] = name.toLowerCase().split(" ");
  return {
    id: `contact-${index + 1}`,
    name,
    initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2),
    email: `${first}.${last}${index + 1}@example.com`,
    company,
    title: titles[(index * 5) % titles.length] ?? "Operations lead",
    city: cities[(index * 2) % cities.length] ?? "Remote",
    status: statuses[index % statuses.length] ?? "Prospect",
    relationship: relationships[index % relationships.length] ?? "Warm",
    lastContactMinutes: index === 0 ? 4 : (index + 1) * 73,
  };
});

export const formatLastContact = (minutes: number): string => {
  if (minutes < 60) return `${minutes} minutes ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} hours ago`;
  const days = Math.floor(minutes / (60 * 24));
  return `${days} day${days === 1 ? "" : "s"} ago`;
};
