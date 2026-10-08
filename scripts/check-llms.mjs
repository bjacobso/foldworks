import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

// Inspect actual build assets: an HTML SPA fallback cannot satisfy these checks.
const siteRoot = resolve(process.argv[2] ?? "apps/demo/dist");
const text = await readFile(resolve(siteRoot, "llms.txt"), "utf8");
assert.match(text, /^# Foldworks\r?\n/, "llms.txt must start with the project H1");
assert.match(text, /^> .+$/m, "llms.txt must include a summary");
assert.match(text, /^> .*pre-1\.0.*pnpm add/im, "Summary must state maturity and installation");
const sections = text.split(/^## .+$/m).slice(1);
assert.ok(sections.length > 0, "llms.txt must have H2 sections");
for (const section of sections) {
  assert.match(section, /^- \[[^\]]+\]\(https:\/\/[^)]+\): .+$/m, "Sections need annotated links");
}

const links = [...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)];
assert.ok(links.length > 0, "llms.txt must link to documentation");
for (const [, href] of links) {
  const url = new URL(href);
  // All current links are generated local assets, so check without relying on the live deployment.
  assert.equal(url.origin, "https://foldworks.dev", `Unmapped documentation URL: ${href}`);
  const path = resolve(siteRoot, "." + decodeURIComponent(url.pathname));
  assert.ok(path.startsWith(siteRoot + sep), `Link escapes the site output: ${href}`);
  assert.ok((await stat(path)).isFile(), `Missing documentation asset: ${href}`);
  const content = await readFile(path, "utf8");
  assert.doesNotMatch(content, /^\s*(?:<!doctype html|<html[\s>])/i, `HTML fallback at ${href}`);
  if (path.endsWith(".md")) assert.match(content, /^# /m, `Invalid Markdown at ${href}`);
  else if (path.endsWith(".json")) JSON.parse(content);
  else assert.fail(`Expected a Markdown or JSON documentation asset: ${href}`);
}

console.log(`Validated built llms.txt structure and ${links.length} documentation links.`);
