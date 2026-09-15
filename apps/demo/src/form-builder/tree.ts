import { Tree } from "@foldworks/ui";
import type { FormDocument } from "./model";

export const initOutline = (document: FormDocument): Tree.Model => Tree.init({
  id: "form-tree", expandedIds: document.sections.map(section => `section:${section.id}`),
  ...(document.sections[0]?.pages[0] ? { selectedId: `page:${document.sections[0].pages[0].id}` } : {}),
});

export const outlineNodes = (document: FormDocument) => document.sections.flatMap(section => [
  { id: `section:${section.id}`, sourceId: section.id, kind: "Section" as const, label: section.title,
    parentId: null, branch: true, renamable: true, movable: true },
  ...section.pages.map(page => ({ id: `page:${page.id}`, sourceId: page.id, kind: "Page" as const,
    label: page.title, parentId: `section:${section.id}`, branch: false, renamable: true, movable: true })),
]);
export const outlineConfig = (document: FormDocument): Tree.Config => ({
  nodes: outlineNodes(document),
  canMove: move => move.id.startsWith("section:") ? move.parentId === null : move.parentId?.startsWith("section:") === true,
});
