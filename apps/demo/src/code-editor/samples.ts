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
