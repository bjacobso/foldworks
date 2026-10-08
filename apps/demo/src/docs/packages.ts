import type { LucideIconData as IconData } from "@lucide/icons";
import {
  AtSign,
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
import { layerOf, layers } from "../stack";
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
  "text-intelligence": AtSign,
  ui: Component,
  workflow: Workflow,
};

export const packageIcon = (id: string): IconData => icons[id] ?? Boxes;

/** Groups packages by stack layer; packages not yet placed in the stack land in "More packages". */
export const groupPackages = (
  packages: ReadonlyArray<PackageDoc>,
): ReadonlyArray<Readonly<{ id: string; title: string; packages: ReadonlyArray<PackageDoc> }>> =>
  [
    ...layers.map((layer) => ({
      id: layer.id,
      title: layer.title,
      packages: layer.packageIds.flatMap((id) => packages.filter((pkg) => pkg.id === id)),
    })),
    {
      id: "more",
      title: "More packages",
      packages: packages.filter((pkg) => layerOf(pkg.id) === undefined),
    },
  ].filter((group) => group.packages.length > 0);
