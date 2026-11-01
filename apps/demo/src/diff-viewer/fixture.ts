import { Schema as S } from "effect";
import { CodeEditor } from "foldworks/code-editor";
import { withSchema } from "foldworks/code-editor/structured";

export const Flags = S.Struct({
  checkout: S.Boolean,
  rollout: S.Number.check(S.isBetween({ minimum: 0, maximum: 100 })),
  retiredNote: S.optional(S.String),
  reviewedBy: S.optional(S.String),
});
export const Access = S.Struct({ admins: S.Array(S.String), requireApproval: S.Boolean });
const FlagsEditor = withSchema(CodeEditor.implementation, Flags);
const AccessEditor = withSchema(CodeEditor.implementation, Access);
export const editorFor = (path: string) =>
  path === "config/flags.json" ? FlagsEditor : AccessEditor;
export const savedFlags =
  '{\n  "checkout": false,\n  "rollout": 0,\n  "retiredNote": "remove after rollout"\n}\n';
export const proposedFlags = savedFlags
  .replace('"checkout": false', '"checkout": true')
  .replace('"rollout": 0', '"rollout": 100');
export const suggestedFlags = '  "rollout": 25,\n  "reviewedBy": "Local reviewer"';
export const initialFiles = [
  { path: "config/flags.json", baseText: savedFlags, text: savedFlags },
  {
    path: "config/access.json",
    baseText:
      JSON.stringify(
        {
          admins: [
            "author",
            "operations",
            "support",
            "billing",
            "security",
            "compliance",
            "analytics",
            "growth",
            "design",
            "engineering",
          ],
          requireApproval: false,
        },
        null,
        2,
      ) + "\n",
    text:
      JSON.stringify(
        {
          admins: [
            "author",
            "operations",
            "support",
            "billing",
            "security",
            "compliance",
            "analytics",
            "growth",
            "design",
            "engineering",
          ],
          requireApproval: true,
        },
        null,
        2,
      ) + "\n",
  },
];
export const author = { id: "author", name: "Local author" };
export const reviewer = { id: "reviewer", name: "Local reviewer" };
export const storageKey = "foldworks.change-request.v1";
