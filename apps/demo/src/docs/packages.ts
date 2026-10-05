import type { LucideIconData as IconData } from "@lucide/icons";
import {
  Bot,
  Boxes,
  Component,
  FileDiff,
  FileSearch,
  FileText,
  FolderGit2,
  Grid3x3,
  Highlighter,
  History,
  Keyboard,
  ListFilter,
  ListTree,
  Network,
  PanelLeft,
  PenLine,
  Sparkles,
  SquareCode,
  Table2,
  TextCursorInput,
  Workflow,
} from "@lucide/icons";
import type { PackageDoc } from "./catalog";

const icons: Readonly<Record<string, IconData>> = {
  agent: Bot,
  "code-editor": SquareCode,
  codebase: FolderGit2,
  "data-grid": Grid3x3,
  "data-table": Table2,
  diagram: Network,
  "diff-viewer": FileDiff,
  editor: PenLine,
  "form-builder": TextCursorInput,
  "generative-ui": Sparkles,
  history: History,
  keyboard: Keyboard,
  outliner: ListTree,
  pdf: FileText,
  "pdf-annotator": Highlighter,
  "pdf-viewer": FileSearch,
  "query-builder": ListFilter,
  sidebar: PanelLeft,
  ui: Component,
  workflow: Workflow,
};

const groups: ReadonlyArray<Readonly<{ id: string; title: string; packageIds: string[] }>> = [
  { id: "foundations", title: "Foundations", packageIds: ["ui", "sidebar", "keyboard", "history"] },
  {
    id: "editors",
    title: "Editors",
    packageIds: ["editor", "code-editor", "outliner", "form-builder", "query-builder"],
  },
  {
    id: "data",
    title: "Data & review",
    packageIds: ["data-grid", "data-table", "diff-viewer", "codebase"],
  },
  { id: "diagrams", title: "Diagrams & flow", packageIds: ["diagram", "workflow"] },
  { id: "documents", title: "Documents", packageIds: ["pdf", "pdf-viewer", "pdf-annotator"] },
  { id: "ai", title: "AI", packageIds: ["agent", "generative-ui"] },
];

export const packageIcon = (id: string): IconData => icons[id] ?? Boxes;

/** Curated groups for known packages; newly generated packages land in "More packages". */
export const groupPackages = (
  packages: ReadonlyArray<PackageDoc>,
): ReadonlyArray<Readonly<{ id: string; title: string; packages: ReadonlyArray<PackageDoc> }>> => {
  const known = new Set(groups.flatMap((group) => group.packageIds));
  return [
    ...groups.map((group) => ({
      id: group.id,
      title: group.title,
      packages: group.packageIds.flatMap((id) => packages.filter((pkg) => pkg.id === id)),
    })),
    { id: "more", title: "More packages", packages: packages.filter((pkg) => !known.has(pkg.id)) },
  ].filter((group) => group.packages.length > 0);
};
