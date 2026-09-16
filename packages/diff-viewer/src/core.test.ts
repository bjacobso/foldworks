import { describe, expect, it } from "vitest";

import { diffTotals, parseUnifiedDiff, splitRows } from "./core";

const patch = `diff --git a/src/old.ts b/src/new.ts
similarity index 70%
rename from src/old.ts
rename to src/new.ts
--- a/src/old.ts
+++ b/src/new.ts
@@ -2,4 +2,5 @@ export function greet(name: string) {
   const prefix = "Hello";
-  return prefix + name;
+  const punctuation = "!";
+  return \`\${prefix}, \${name}\${punctuation}\`;
 }
${" "}
diff --git a/src/created.ts b/src/created.ts
new file mode 100644
--- /dev/null
+++ b/src/created.ts
@@ -0,0 +1,2 @@
+export const ready = true;
+export const count = 2;
`;

describe("parseUnifiedDiff", () => {
  it("parses paths, statuses, hunks, counts, and line numbers", () => {
    const files = parseUnifiedDiff(patch);
    expect(files).toHaveLength(2);
    expect(files[0]).toMatchObject({
      oldPath: "src/old.ts",
      path: "src/new.ts",
      status: "renamed",
      language: "typescript",
      additions: 2,
      deletions: 1,
    });
    expect(files[0]!.hunks[0]!.lines.map((line) => [line.kind, line.oldLine, line.newLine])).toEqual([
      ["context", 2, 2],
      ["deletion", 3, null],
      ["addition", null, 3],
      ["addition", null, 4],
      ["context", 4, 5],
      ["context", 5, 6],
    ]);
    expect(files[1]).toMatchObject({ status: "added", additions: 2, deletions: 0 });
    expect(files[1]!.hunks[0]!.lines).toHaveLength(2);
    expect(diffTotals(files)).toEqual({ additions: 4, deletions: 1 });
  });

  it("aligns deletion and addition blocks for a split view", () => {
    const rows = splitRows(parseUnifiedDiff(patch)[0]!.hunks[0]!);
    expect(rows).toHaveLength(5);
    expect(rows[1]).toMatchObject({
      left: { kind: "deletion", oldLine: 3 },
      right: { kind: "addition", newLine: 3 },
    });
    expect(rows[2]).toMatchObject({ right: { kind: "addition", newLine: 4 } });
    expect(rows[2]!.left).toBeUndefined();
  });
});
