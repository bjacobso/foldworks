import { Schema as S } from "effect";

const EmploymentStatus = S.Literals(["Active", "On leave", "Contractor"]);
type EmploymentStatus = typeof EmploymentStatus.Type;

export const Person = S.Struct({
  id: S.String, name: S.String, email: S.String, status: EmploymentStatus,
  department: S.String, role: S.String, location: S.String,
  startDate: S.String, salary: S.Number, equipmentIssued: S.Boolean,
});
export type Person = typeof Person.Type;

const firstNames = [
  "Maya", "Noah", "Iris", "Leo", "Ava", "Theo", "Nina", "Ezra",
  "Sofia", "Miles", "Lina", "Owen", "Zoe", "Jules", "Amara", "Kai",
];
const lastNames = [
  "Chen", "Williams", "Patel", "Martinez", "Kim", "Johnson", "Okafor", "Silva",
];
const departments = ["Engineering", "Design", "Operations", "Sales", "People"];
const roles = [
  "Software engineer", "Product designer", "Operations lead", "Account executive",
  "People partner", "Data analyst", "Product manager",
];
const locations = ["San Francisco", "New York", "Austin", "London", "Remote"];
const statuses: ReadonlyArray<EmploymentStatus> = ["Active", "Active", "Active", "On leave", "Contractor"];

export const people: ReadonlyArray<Person> = Array.from({ length: 120 }, (_, index) => {
  const firstName = firstNames[index % firstNames.length] ?? "Alex";
  const lastName = lastNames[(index * 3) % lastNames.length] ?? "Morgan";
  const year = 2019 + (index % 7);
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 24) + 1).padStart(2, "0");
  return {
    id: `person-${index + 1}`,
    name: `${firstName} ${lastName}`,
    email: `${firstName}.${lastName}${index + 1}@example.com`.toLowerCase(),
    status: statuses[index % statuses.length] ?? "Active",
    department: departments[(index * 2) % departments.length] ?? "Operations",
    role: roles[(index * 5) % roles.length] ?? "Specialist",
    location: locations[(index * 3) % locations.length] ?? "Remote",
    startDate: `${year}-${month}-${day}`,
    salary: 72_000 + (index % 18) * 4_500,
    equipmentIssued: index % 3 !== 0,
  };
});
