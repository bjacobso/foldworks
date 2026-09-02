import { Schema as S } from "effect";

export const FieldKind = S.Literals([
  "shortText",
  "longText",
  "singleSelect",
  "checkbox",
  "date",
  "content",
]);
export type FieldKind = typeof FieldKind.Type;

export const FormField = S.Struct({
  id: S.String,
  type: FieldKind,
  label: S.String,
  description: S.String,
  required: S.Boolean,
  options: S.Array(S.String),
  content: S.String,
});
export type FormField = typeof FormField.Type;

export const Actor = S.Struct({
  id: S.String,
  type: S.String,
  title: S.String,
});
export type Actor = typeof Actor.Type;

export const FormPage = S.Struct({
  id: S.String,
  title: S.String,
  description: S.String,
  fields: S.Array(FormField),
});
export type FormPage = typeof FormPage.Type;

export const FormSection = S.Struct({
  id: S.String,
  actorId: S.String,
  title: S.String,
  description: S.String,
  pages: S.Array(FormPage),
});
export type FormSection = typeof FormSection.Type;

export const FormDocument = S.Struct({
  id: S.String,
  title: S.String,
  description: S.String,
  actors: S.Array(Actor),
  sections: S.Array(FormSection),
});
export type FormDocument = typeof FormDocument.Type;

export const FormExampleId = S.Literals(["Simple", "Handoff", "Complex"]);
export type FormExampleId = typeof FormExampleId.Type;

export const FormMode = S.Literals(["Editor", "Preview"]);
export type FormMode = typeof FormMode.Type;

export const FormSelection = S.Struct({
  kind: S.Literals(["Section", "Page", "Field"]),
  id: S.String,
});
export type FormSelection = typeof FormSelection.Type;

export const FormAnswer = S.Struct({ fieldId: S.String, value: S.String });
export type FormAnswer = typeof FormAnswer.Type;

export const ContentView = S.Struct({
  actorId: S.String,
  sectionId: S.String,
  pageId: S.String,
  fieldId: S.String,
  viewedAt: S.String,
});
export type ContentView = typeof ContentView.Type;

const field = (
  id: string,
  type: FieldKind,
  label: string,
  config: Partial<Pick<FormField, "description" | "required" | "options" | "content">> = {},
): FormField => ({
  id,
  type,
  label,
  description: config.description ?? "",
  required: config.required ?? false,
  options: config.options ?? [],
  content: config.content ?? "",
});

const page = (
  id: string,
  title: string,
  fields: ReadonlyArray<FormField>,
  description = "",
): FormPage => ({ id, title, description, fields });

const section = (
  id: string,
  actorId: string,
  title: string,
  pages: ReadonlyArray<FormPage>,
  description = "",
): FormSection => ({ id, actorId, title, description, pages });

const employee: Actor = { id: "employee", type: "employee", title: "Employee" };
const employer: Actor = { id: "employer", type: "employer", title: "Employer" };
const representative: Actor = {
  id: "authorized-representative",
  type: "authorizedRepresentative",
  title: "Authorized representative",
};

const simple: FormDocument = {
  id: "simple-contact",
  title: "Contact details",
  description: "A compact, single-page employee form.",
  actors: [employee],
  sections: [
    section("simple-contact-section", employee.id, "Your details", [
      page("simple-contact-page", "Contact details", [
        field("simple-name", "shortText", "Full legal name", { required: true }),
        field("simple-email", "shortText", "Personal email", { required: true }),
        field("simple-note", "longText", "Anything else we should know?"),
      ], "Tell us how to reach you."),
    ]),
  ],
};

const handoff: FormDocument = {
  id: "new-hire-handoff",
  title: "New hire workflow",
  description: "Employee → Employer → Employee handoff.",
  actors: [employee, employer],
  sections: [
    section("handoff-employee-details", employee.id, "Employee details", [
      page("handoff-about-you", "About you", [
        field("handoff-name", "shortText", "Preferred name", { required: true }),
        field("handoff-start", "date", "Available start date", { required: true }),
        field("handoff-work-style", "singleSelect", "Preferred work style", {
          options: ["On-site", "Hybrid", "Remote"],
          required: true,
        }),
      ]),
      page("handoff-emergency", "Emergency contact", [
        field("handoff-emergency-name", "shortText", "Contact name", { required: true }),
        field("handoff-emergency-phone", "shortText", "Phone number", { required: true }),
      ]),
    ], "Information completed by the incoming employee."),
    section("handoff-employer-setup", employer.id, "Employment setup", [
      page("handoff-role", "Role and compensation", [
        field("handoff-role-title", "shortText", "Job title", { required: true }),
        field("handoff-department", "singleSelect", "Department", {
          options: ["Engineering", "Design", "Operations", "Sales"],
          required: true,
        }),
        field("handoff-manager", "shortText", "Manager", { required: true }),
      ]),
    ], "The employer confirms the role after employee submission."),
    section("handoff-employee-confirm", employee.id, "Employee confirmation", [
      page("handoff-policies", "Policies", [
        field("handoff-policy-content", "content", "Workplace policies", {
          content: "# Workplace policies\n\nPlease review the **handbook**, security expectations, and time-off policy before continuing.\n\n- Protect company and customer information.\n- Report suspected security issues promptly.",
        }),
        field("handoff-policy-check", "checkbox", "I agree to follow these policies", { required: true }),
      ]),
    ], "The employee returns to review and acknowledge policies."),
  ],
};

const complex: FormDocument = {
  id: "eligibility-verification",
  title: "Employment eligibility verification",
  description: "Employee → Authorized representative → Employer → Employee.",
  actors: [employee, representative, employer],
  sections: [
    section("complex-employee", employee.id, "Employee information", [
      page("complex-identity", "Identity", [
        field("complex-legal-name", "shortText", "Legal name", { required: true }),
        field("complex-birth-date", "date", "Date of birth", { required: true }),
        field("complex-address", "longText", "Home address", { required: true }),
      ]),
      page("complex-status", "Citizenship status", [
        field("complex-status-choice", "singleSelect", "Select your status", {
          options: ["Citizen", "Permanent resident", "Authorized to work"],
          required: true,
        }),
        field("complex-attestation", "checkbox", "I attest this information is correct", { required: true }),
      ]),
    ]),
    section("complex-representative", representative.id, "Document review", [
      page("complex-document-review", "Review identity documents", [
        field("complex-review-guide", "content", "Review instructions", {
          content: "# Document review\n\nInspect the original documents in person. Confirm they appear genuine and relate to the employee.",
        }),
        field("complex-document-type", "singleSelect", "Document presented", {
          options: ["Passport", "Driver license and Social Security card", "Other valid combination"],
          required: true,
        }),
        field("complex-document-notes", "longText", "Document notes"),
      ]),
    ]),
    section("complex-employer", employer.id, "Employer certification", [
      page("complex-certification", "Certification", [
        field("complex-first-day", "date", "Employee's first day", { required: true }),
        field("complex-employer-name", "shortText", "Employer representative", { required: true }),
        field("complex-employer-certify", "checkbox", "I certify this review is complete", { required: true }),
      ]),
    ]),
    section("complex-employee-receipt", employee.id, "Employee receipt", [
      page("complex-complete", "You're all set", [
        field("complex-complete-copy", "content", "Verification complete", {
          content: "# Verification complete\n\nYour employer has completed the eligibility review. Keep this confirmation for your records.",
        }),
      ]),
    ]),
  ],
};

export const exampleForms: Readonly<Record<FormExampleId, FormDocument>> = {
  Simple: simple,
  Handoff: handoff,
  Complex: complex,
};
