#!/usr/bin/env node
import { startCodebaseServer } from "./server";
import { pathToFileURL } from "node:url";

interface CliOptions {
  root?: string;
  title?: string;
  baseRef?: string;
  host?: string;
  port?: number;
  maxFileSize?: number;
}

const help = `foldworks-codebase [options]

Start a live, read-only codebase workbench.

Options:
  --root <path>             Repository root (default: current directory)
  --title <text>            Workbench title (default: package or directory name)
  --base-ref <ref>          Base branch for branch diffs (default: origin/main)
  --host <address>          Listen address (default: 127.0.0.1)
  --port <number>           Listen port (default: 4310)
  --max-file-size <bytes>   Largest readable file (default: 1048576)
  -h, --help                Show this help
`;

const takeValue = (args: readonly string[], index: number, flag: string): string => {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
};

export const parseCliOptions = (args: readonly string[]): CliOptions => {
  const options: CliOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === undefined || arg === "--") continue;
    if (arg === "--root") options.root = takeValue(args, index++, arg);
    else if (arg === "--title") options.title = takeValue(args, index++, arg);
    else if (arg === "--base-ref") options.baseRef = takeValue(args, index++, arg);
    else if (arg === "--host") options.host = takeValue(args, index++, arg);
    else if (arg === "--port") options.port = Number(takeValue(args, index++, arg));
    else if (arg === "--max-file-size") options.maxFileSize = Number(takeValue(args, index++, arg));
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write(help);
      process.exit(0);
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return options;
};

const main = async (): Promise<void> => {
  const server = await startCodebaseServer(parseCliOptions(process.argv.slice(2)));
  process.stdout.write(`\n  Foldworks Codebase\n  ${server.config.root}\n  ${server.origin}\n\n`);
  const stop = (): void => {
    void server.close().finally(() => process.exit(0));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    process.stderr.write(`foldworks-codebase: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
