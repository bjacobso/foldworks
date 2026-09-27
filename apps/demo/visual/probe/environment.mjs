// Diagnostic probe: records which platform fonts Chromium actually used for every
// Polaris fixture, plus browser/launch details. Requires the demo on 127.0.0.1:4175.
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const out = process.argv[2] ?? "font-probe.json";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "light",
  locale: "en-US",
  timezoneId: "UTC",
  reducedMotion: "reduce",
});
const page = await context.newPage();
await page.goto("http://127.0.0.1:4175/ui-kit", { waitUntil: "networkidle" });
await page.getByLabel("Theme", { exact: true }).selectOption("Polaris");

const count = await page.evaluate(() => {
  let id = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (el && node.textContent.trim() && !el.hasAttribute("data-probe")) el.setAttribute("data-probe", String(id++));
  }
  return id;
});

const cdp = await context.newCDPSession(page);
await cdp.send("DOM.enable");
await cdp.send("CSS.enable");
const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "[data-probe]" });
const fonts = new Map();
const computed = new Map();
for (const nodeId of nodeIds) {
  const { fonts: used } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  const { computedStyle } = await cdp.send("CSS.getComputedStyleForNode", { nodeId });
  const family = computedStyle.find((p) => p.name === "font-family")?.value;
  computed.set(family, (computed.get(family) ?? 0) + 1);
  for (const f of used) {
    const key = `${f.familyName} | ${f.postScriptName} | custom=${f.isCustomFont}`;
    fonts.set(key, (fonts.get(key) ?? 0) + f.glyphCount);
  }
}
const version = await cdp.send("Browser.getVersion");
// Hash the binary that is actually running (headless runs use chrome-headless-shell).
const executable = execSync("ps -eo args", { encoding: "utf8" })
  .split("\n")
  .map((line) => line.split(" ")[0])
  .find((bin) => /ms-playwright\/.*\/(chrome|chrome-headless-shell)$/.test(bin));
const result = {
  browser: version,
  executable,
  executableSha256: createHash("sha256").update(readFileSync(executable)).digest("hex"),
  probedTextElements: count,
  devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
  platformFontsByGlyphCount: Object.fromEntries([...fonts].sort((a, b) => b[1] - a[1])),
  computedFontFamilies: Object.fromEntries(computed),
};
writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
