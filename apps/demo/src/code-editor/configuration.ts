import { Schema as S } from "effect";
import { CodeEditor } from "@foldworks/code-editor";
import { withSchema } from "@foldworks/code-editor/structured";

export const Configuration = S.Struct({
  name: S.String.check(S.isMinLength(1)),
  environment: S.Literals(["development", "production"]),
  features: S.Struct({ syntaxHighlighting: S.Boolean, validation: S.Boolean }),
  retryAttempts: S.Number.check(S.isInt(), S.isBetween({ minimum: 0, maximum: 10 })),
});

export const ConfigurationEditor = withSchema(CodeEditor.implementation, Configuration);

export const yamlSample = `# The same configuration schema as the JSON example.
name: Welcome to Foldworks
environment: development
features:
  syntaxHighlighting: true
  validation: true
retryAttempts: 3
`;
