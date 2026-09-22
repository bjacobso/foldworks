import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const mode = process.argv[2];

if (mode !== "--check" && mode !== "--write") {
  console.error("Usage: node scripts/format-changed.mjs <--check|--write>");
  process.exit(2);
}

const git = (args, allowFailure = false) => {
  const result = spawnSync("git", args, { encoding: "utf8" });

  if (result.status !== 0 && !allowFailure) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return result.status === 0 ? result.stdout.trim() : "";
};

const defaultBranch = process.env.CONDUCTOR_DEFAULT_BRANCH ?? "main";
const baseCandidates = [`origin/${defaultBranch}`, defaultBranch];
const baseRef = baseCandidates.find((candidate) =>
  Boolean(git(["rev-parse", "--verify", "--quiet", candidate], true)),
);
const mergeBase = baseRef ? git(["merge-base", "HEAD", baseRef]) : "HEAD";

const files = new Set([
  ...git(["diff", "--name-only", "--diff-filter=ACMR", mergeBase]).split("\n"),
  ...git(["ls-files", "--others", "--exclude-standard"]).split("\n"),
]);

const supportedExtension = /\.(?:css|html|js|jsx|json|jsonc|md|mdx|mjs|cjs|ts|tsx|yaml|yml)$/u;
const formatTargets = [...files]
  .filter((file) => file && supportedExtension.test(file) && existsSync(file))
  .sort();

if (formatTargets.length === 0) {
  console.log("No changed files supported by Oxfmt.");
  process.exit(0);
}

const result = spawnSync("oxfmt", [mode, ...formatTargets], { stdio: "inherit" });

if (result.error) {
  console.error(`Could not start Oxfmt: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
