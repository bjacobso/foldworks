export type DiffLineKind = "context" | "addition" | "deletion";
export type DiffFileStatus = "added" | "deleted" | "modified" | "renamed" | "binary";
export type DiffViewMode = "Unified" | "Split";
export type DiffSide = "old" | "new";

export interface DiffLine {
  readonly kind: DiffLineKind;
  readonly content: string;
  readonly oldLine: number | null;
  readonly newLine: number | null;
}

export interface DiffHunk {
  readonly id: string;
  readonly header: string;
  readonly label: string;
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  readonly lines: readonly DiffLine[];
}

export interface DiffFile {
  readonly oldPath: string;
  readonly path: string;
  readonly status: DiffFileStatus;
  readonly language: string;
  readonly additions: number;
  readonly deletions: number;
  readonly hunks: readonly DiffHunk[];
}

export interface DiffSelection {
  readonly path: string;
  readonly side: DiffSide;
  readonly line: number;
}

export interface DiffThreadMarker extends DiffSelection {
  readonly count: number;
  readonly resolved?: boolean;
}

export interface SplitRow {
  readonly left?: DiffLine;
  readonly right?: DiffLine;
}

const cleanPath = (path: string): string => {
  const value = path.trim().replace(/^"|"$/g, "");
  return value === "/dev/null" ? "" : value.replace(/^[ab]\//, "");
};

export const languageFromPath = (path: string): string => {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return ({
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    json: "json", css: "css", scss: "scss", html: "html", md: "markdown",
    yml: "yaml", yaml: "yaml", py: "python", rs: "rust", go: "go",
    sh: "shell", toml: "toml",
  } as Record<string, string>)[extension] ?? "text";
};

type MutableFile = {
  oldPath: string;
  path: string;
  status: DiffFileStatus;
  hunks: DiffHunk[];
};

export const parseUnifiedDiff = (patch: string): readonly DiffFile[] => {
  const files: DiffFile[] = [];
  let file: MutableFile | undefined;
  let lines: DiffLine[] | undefined;
  let hunkMeta: Omit<DiffHunk, "lines"> | undefined;
  let oldLine = 0;
  let newLine = 0;

  const finishHunk = () => {
    if (file !== undefined && hunkMeta !== undefined && lines !== undefined) {
      file.hunks.push({ ...hunkMeta, lines });
    }
    hunkMeta = undefined;
    lines = undefined;
  };
  const finishFile = () => {
    finishHunk();
    if (file === undefined) return;
    const additions = file.hunks.reduce((sum, hunk) => sum + hunk.lines.filter((line) => line.kind === "addition").length, 0);
    const deletions = file.hunks.reduce((sum, hunk) => sum + hunk.lines.filter((line) => line.kind === "deletion").length, 0);
    const path = file.path || file.oldPath;
    files.push({ ...file, path, language: languageFromPath(path), additions, deletions });
    file = undefined;
  };

  for (const rawLine of patch.replace(/\r\n/g, "\n").split("\n")) {
    const fileHeader = /^diff --git (?:"?a\/(.+?)"?) (?:"?b\/(.+?)"?)$/.exec(rawLine);
    if (fileHeader !== null) {
      finishFile();
      file = {
        oldPath: cleanPath(fileHeader[1] ?? ""),
        path: cleanPath(fileHeader[2] ?? ""),
        status: "modified",
        hunks: [],
      };
      continue;
    }
    if (file === undefined && rawLine.startsWith("--- ")) {
      file = { oldPath: cleanPath(rawLine.slice(4)), path: "", status: "modified", hunks: [] };
      continue;
    }
    if (file === undefined) continue;
    if (rawLine.startsWith("new file mode ")) file.status = "added";
    else if (rawLine.startsWith("deleted file mode ")) file.status = "deleted";
    else if (rawLine.startsWith("rename from ")) {
      file.oldPath = cleanPath(rawLine.slice("rename from ".length));
      file.status = "renamed";
    } else if (rawLine.startsWith("rename to ")) {
      file.path = cleanPath(rawLine.slice("rename to ".length));
      file.status = "renamed";
    } else if (rawLine.startsWith("Binary files ")) file.status = "binary";
    else if (rawLine.startsWith("--- ")) file.oldPath = cleanPath(rawLine.slice(4));
    else if (rawLine.startsWith("+++ ")) file.path = cleanPath(rawLine.slice(4));

    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@\s?(.*)$/.exec(rawLine);
    if (hunk !== null) {
      finishHunk();
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[3]);
      const index = file.hunks.length;
      hunkMeta = {
        id: `${file.path || file.oldPath}:${index}:${oldLine}:${newLine}`,
        header: rawLine,
        label: hunk[5] ?? "",
        oldStart: oldLine,
        oldCount: Number(hunk[2] ?? "1"),
        newStart: newLine,
        newCount: Number(hunk[4] ?? "1"),
      };
      lines = [];
      continue;
    }
    if (lines === undefined || rawLine === "" || rawLine === "\\ No newline at end of file") continue;
    if (rawLine.startsWith("+")) {
      lines.push({ kind: "addition", content: rawLine.slice(1), oldLine: null, newLine });
      newLine += 1;
    } else if (rawLine.startsWith("-")) {
      lines.push({ kind: "deletion", content: rawLine.slice(1), oldLine, newLine: null });
      oldLine += 1;
    } else {
      const content = rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine;
      lines.push({ kind: "context", content, oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    }
  }
  finishFile();
  return files;
};

export const splitRows = (hunk: DiffHunk): readonly SplitRow[] => {
  const rows: SplitRow[] = [];
  let index = 0;
  while (index < hunk.lines.length) {
    const line = hunk.lines[index]!;
    if (line.kind === "context") {
      rows.push({ left: line, right: line });
      index += 1;
      continue;
    }
    const deletions: DiffLine[] = [];
    const additions: DiffLine[] = [];
    while (index < hunk.lines.length && hunk.lines[index]!.kind !== "context") {
      const change = hunk.lines[index]!;
      if (change.kind === "deletion") deletions.push(change);
      else additions.push(change);
      index += 1;
    }
    for (let row = 0; row < Math.max(deletions.length, additions.length); row += 1) {
      const left = deletions[row];
      const right = additions[row];
      rows.push({ ...(left === undefined ? {} : { left }), ...(right === undefined ? {} : { right }) });
    }
  }
  return rows;
};

export const diffTotals = (files: readonly DiffFile[]): Readonly<{ additions: number; deletions: number }> => ({
  additions: files.reduce((sum, file) => sum + file.additions, 0),
  deletions: files.reduce((sum, file) => sum + file.deletions, 0),
});
