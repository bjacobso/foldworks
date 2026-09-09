import { Schema as S } from "effect";
import { CodeEditor } from "@foldworks/code-editor";
import { ConfigurationEditor } from "./configuration";

export const jsonSample = `{
  "name": "Welcome to Foldworks",
  "environment": "development",
  "features": {
    "syntaxHighlighting": true,
    "validation": true
  },
  "retryAttempts": 3
}`;
export const typescriptSample = `type Environment = "development" | "production";

interface Configuration {
  name: string;
  environment: Environment;
  retryAttempts: number;
}

export function describe(config: Configuration): string {
  return \`\${config.name} · \${config.environment}\`;
}
`;
export const Model = S.Struct({
  editor: CodeEditor.Model,
  reference: CodeEditor.Model,
  savedText: S.String,
  savedSession: S.Number,
  announcement: S.String,
});
export type Model = typeof Model.Type;
export const init = (): Model => ({
  editor: ConfigurationEditor.init({ id: "native-working", uri: "file:///configuration.json", languageId: "json", text: jsonSample }),
  reference: CodeEditor.init({ id: "native-reference", uri: "file:///configuration.ts", languageId: "typescript", text: typescriptSample, readOnly: true }),
  savedText: jsonSample, savedSession: 0, announcement: "Ready to edit.",
});
