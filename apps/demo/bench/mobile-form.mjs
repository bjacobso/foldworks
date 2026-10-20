#!/usr/bin/env node
/**
 * Benchmarks the mobile candidate form on an emulated mid-range phone.
 *
 *   node bench/mobile-form.mjs [--runs 5] [--cpu 4] label=path/to/entry.html [label=http://…]
 *
 * Each target must implement the form described in `src/mobile-form` with the
 * same element ids and button text, so one scripted session drives any
 * implementation. Files are served from their directory with Brotli, the page
 * loads over emulated Slow 4G, and the whole session runs with the CPU slowed
 * by `--cpu` (Lighthouse's mobile default is 4x).
 *
 * The session covers every step: text, masks, the state sheet, choice controls,
 * conditional follow-up questions that animate open, and the one-time code.
 *
 * Reported per target (median across runs):
 *   - transfer: compressed bytes for the first load
 *   - FCP and form-ready: first paint, and the moment `#first-name` exists
 *   - key → paint: keydown to the next painted frame, for every keystroke
 *   - tap → paint: click to the next painted frame, for every tap
 *   - INP: the slowest interaction (Event Timing, grouped by interactionId), and how
 *     many interactions took 50ms or more
 *   - script: main-thread JavaScript time for the entire scripted session
 */
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { readFile, stat } from "node:fs/promises";
import { brotliCompressSync, constants } from "node:zlib";
import { dirname, extname, join, resolve, basename } from "node:path";
import { chromium, devices } from "playwright";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : Number(args.splice(index, 2)[1]);
};
const runs = option("runs", 5);
const cpu = option("cpu", 4);
const targets = args.map((arg) => {
  const at = arg.indexOf("=");
  if (at === -1) throw new Error(`Expected label=path-or-url, got ${arg}`);
  return { label: arg.slice(0, at), location: arg.slice(at + 1) };
});
if (targets.length === 0) {
  console.error("Usage: node bench/mobile-form.mjs [--runs 5] [--cpu 4] label=entry.html …");
  process.exit(1);
}

const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};

/** Serves a build directory with Brotli, like a CDN would. */
const serve = async (entry) => {
  const root = dirname(resolve(entry));
  const cache = new Map();
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://x").pathname;
    const file = join(root, path === "/" ? basename(entry) : path);
    try {
      if (!(await stat(file)).isFile()) throw new Error("not a file");
      let body = cache.get(file);
      if (body === undefined) {
        body = brotliCompressSync(await readFile(file), {
          params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
        });
        cache.set(file, body);
      }
      response.writeHead(200, {
        "content-type": types[extname(file)] ?? "application/octet-stream",
        "content-encoding": "br",
        "cache-control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}/${basename(entry)}`, close: () => server.close() };
};

/** Framework-neutral probes, installed before any application code runs. */
const probe = () => {
  const bench = { keys: [], taps: [], interactions: {}, ready: 0 };
  window.__bench = bench;
  const toPaint = (list) => (event) => {
    const start = event.timeStamp;
    requestAnimationFrame(() => setTimeout(() => list.push(performance.now() - start), 0));
  };
  addEventListener("keydown", toPaint(bench.keys), true);
  addEventListener("click", toPaint(bench.taps), true);
  new MutationObserver((_, observer) => {
    if (document.getElementById("first-name") !== null) {
      bench.ready = performance.now();
      observer.disconnect();
    }
  }).observe(document, { childList: true, subtree: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      if (entry.interactionId > 0)
        bench.interactions[entry.interactionId] = Math.max(
          bench.interactions[entry.interactionId] ?? 0,
          entry.duration,
        );
  }).observe({ type: "event", buffered: true, durationThreshold: 16 });
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? 0 : sorted[Math.floor(sorted.length / 2)];
};
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0
    ? 0
    : sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

const typing = { delay: 60 };

/** One scripted application: every step, the state sheet, and the code. */
const session = async (page) => {
  // Center the field first, as a person scrolls to a field before tapping it.
  const type = async (selector, text) => {
    await page.locator(selector).evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.tap(selector);
    await page.locator(selector).pressSequentially(text, typing);
  };
  await type("#first-name", "Ada");
  await type("#last-name", "Lovelace");
  await type("#email", "ada@example.com");
  await type("#phone", "5551234567");
  await type("#dob", "07041990");
  await page.tap("text=Continue");
  await page.waitForSelector("#street");
  await type("#street", "1 Main Street");
  await type("#city", "Oakland");
  await type("#zip", "94612");
  await page.tap("#state");
  await page.waitForSelector("#state-search");
  await page.locator("#state-search").pressSequentially("cal", typing);
  await page.tap('dialog[open] button:has-text("California")');
  await page.waitForSelector("dialog[open]", { state: "detached", timeout: 2000 }).catch(() => {});
  await page.tap("text=Continue");
  await page.waitForSelector("#hours");
  await page.tap("label:has(#employment-part-time)");
  for (let index = 0; index < 5; index++) {
    await page.tap('[aria-label="More hours"]');
    await page.waitForTimeout(80);
  }
  await page.fill("#start-date", "2031-01-15");
  await page.tap("label:has(#shift-evenings)");
  await page.tap("label:has(#shift-weekends)");
  await page.tap("text=Continue");
  // Conditional questions: each "Yes" animates follow-up fields open.
  await page.waitForSelector("#license-yes", { state: "attached" });
  await page.tap("label:has(#license-yes)");
  await type("#license-number", "D1234567");
  await page.tap("label:has(#cdl-yes)");
  await page.tap("label:has(#cdl-class-b)");
  await page.tap("label:has(#rehire-yes)");
  await type("#previous-location", "Oakland");
  await type("#previous-end", "062022");
  await page.tap("text=Continue");
  await page.waitForSelector("#otp");
  await page.locator("#otp").pressSequentially("123456", typing);
  // Implementations may submit a complete code themselves; otherwise press Verify.
  if (!(await page.waitForSelector("text=You're all set", { timeout: 500 }).catch(() => null)))
    await page.tap("button[type=submit]");
  await page.waitForSelector("text=You're all set");
};

const metric = (metrics, name) => metrics.find((entry) => entry.name === name)?.value ?? 0;

const runOnce = async (browser, url) => {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  await context.addInitScript(probe);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  let transfer = 0;
  cdp.on("Network.loadingFinished", (event) => {
    transfer += event.encodedDataLength;
  });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForSelector("#first-name");
  await page.waitForFunction(
    () => performance.getEntriesByName("first-contentful-paint").length > 0,
  );
  const load = await page.evaluate(() => ({
    fcp: performance.getEntriesByName("first-contentful-paint")[0].startTime,
    ready: window.__bench.ready,
  }));
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  const before = (await cdp.send("Performance.getMetrics")).metrics;
  await session(page).catch(async (error) => {
    await page.screenshot({ path: join(tmpdir(), "mobile-form-bench-failure.png") });
    throw error;
  });
  await page.waitForTimeout(300);
  const after = (await cdp.send("Performance.getMetrics")).metrics;
  const probes = await page.evaluate(() => window.__bench);
  await context.close();
  return {
    transferKB: transfer / 1024,
    fcp: load.fcp,
    ready: load.ready,
    keys: probes.keys,
    taps: probes.taps,
    inp: Math.max(0, ...Object.values(probes.interactions)),
    slow: Object.values(probes.interactions).filter((duration) => duration >= 50).length,
    scriptMs: (metric(after, "ScriptDuration") - metric(before, "ScriptDuration")) * 1000,
    heapMB: metric(after, "JSHeapUsedSize") / 1024 / 1024,
  };
};

const browser = await chromium.launch({ channel: process.env.BENCH_CHANNEL ?? "chrome" });
const rows = [];
for (const target of targets) {
  const server = /^https?:/.test(target.location) ? undefined : await serve(target.location);
  const url = server?.url ?? target.location;
  const results = [];
  for (let run = 0; run < runs; run++) {
    results.push(await runOnce(browser, url));
    process.stderr.write(`${target.label}: run ${run + 1}/${runs}\n`);
  }
  server?.close();
  const keys = results.flatMap((result) => result.keys);
  const taps = results.flatMap((result) => result.taps);
  rows.push({
    label: target.label,
    transferKB: median(results.map((result) => result.transferKB)),
    fcp: median(results.map((result) => result.fcp)),
    ready: median(results.map((result) => result.ready)),
    keyP50: percentile(keys, 50),
    keyP95: percentile(keys, 95),
    keyMax: Math.max(...keys),
    tapP50: percentile(taps, 50),
    tapP95: percentile(taps, 95),
    inp: median(results.map((result) => result.inp)),
    slow: median(results.map((result) => result.slow)),
    scriptMs: median(results.map((result) => result.scriptMs)),
    heapMB: median(results.map((result) => result.heapMB)),
    samples: `${keys.length} keys, ${taps.length} taps`,
  });
}
await browser.close();

const fixed = (value, digits = 0) => value.toFixed(digits);
console.log(
  `\nPixel 7 emulation, ${cpu}x CPU slowdown, Slow 4G for the first load, ${runs} runs each.\n`,
);
console.log(
  "| Target | Transfer | FCP | Form ready | Key → paint p50 / p95 / max | Tap → paint p50 / p95 | INP | Interactions ≥ 50ms | Script time | JS heap |",
);
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const row of rows)
  console.log(
    `| ${row.label} | ${fixed(row.transferKB, 1)} KB | ${fixed(row.fcp)} ms | ${fixed(row.ready)} ms | ${fixed(row.keyP50, 1)} / ${fixed(row.keyP95, 1)} / ${fixed(row.keyMax, 1)} ms | ${fixed(row.tapP50, 1)} / ${fixed(row.tapP95, 1)} ms | ${fixed(row.inp)} ms | ${row.slow} | ${fixed(row.scriptMs)} ms | ${fixed(row.heapMB, 1)} MB |`,
  );
console.log(
  `\nSamples per target: ${rows.map((row) => `${row.label}: ${row.samples}`).join("; ")}`,
);
