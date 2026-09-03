import type { FormDocument } from "./form-builder/model";
import type { WorkflowDocument } from "./workflow/model";

const numericSuffix = (id: string, prefix: string): number => {
  if (!id.startsWith(prefix)) return 0;
  const value = Number(id.slice(prefix.length));
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
};

export const nextWorkflowId = (document: WorkflowDocument): number => {
  let maximum = 0;
  const visit = (nodes: typeof document.root.elements) => {
    for (const node of nodes) {
      maximum = Math.max(maximum, numericSuffix(node.id, "node-"));
      for (const branch of node.branches) visit(branch.elements);
    }
  };
  visit(document.root.elements);
  return maximum + 1;
};

export const nextFormId = (document: FormDocument): number => {
  let maximum = 0;
  for (const section of document.sections) {
    maximum = Math.max(maximum, numericSuffix(section.id, "form-section-"));
    for (const page of section.pages) {
      maximum = Math.max(maximum, numericSuffix(page.id, "form-page-"));
      for (const field of page.fields) {
        maximum = Math.max(maximum, numericSuffix(field.id, "form-field-"));
      }
    }
  }
  return maximum + 1;
};
