/**
 * Measures the new layered renderer against the prototype's shadowBlur renderer
 * in a real browser, and writes a comparison table to stdout.
 *
 *   npm run bench
 *
 * Both renderers draw the same synthetic signature, so the numbers describe the
 * rendering strategy rather than the input.
 */
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4399;
const POINT_COUNTS = [200, 500, 1000];
const CSS_WIDTH = 520;

function startDevServer() {
  const child = spawn(
    "npx",
    ["vite", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"],
    { stdio: ["ignore", "pipe", "pipe"] }
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dev server did not start")), 30_000);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("ready in") || String(chunk).includes("Local:")) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.on("exit", (code) => reject(new Error(`dev server exited with ${code}`)));
  });
}

const server = await startDevServer();
// Headed, so the canvas is GPU-accelerated. Headless Chromium rasterises canvas
// in software, where `shadowBlur` is so much slower that the comparison stops
// describing anything a real user would experience.
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on("pageerror", (error) => console.error("page error:", error.message));

await page.goto(`http://127.0.0.1:${PORT}/bench/`, { waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.runBench === "function");

const results = [];
for (const points of POINT_COUNTS) {
  process.stdout.write(`measuring ${points} points… `);
  const started = Date.now();
  const result = await page.evaluate(
    ([count, width]) => window.runBench(count, width),
    [points, CSS_WIDTH]
  );
  console.log(`${Math.round((Date.now() - started) / 1000)}s`);
  results.push(result);
}

const round = (value) => Math.round(value * 1000) / 1000;

const gpu = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl");
  const info = gl?.getExtension("WEBGL_debug_renderer_info");
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
});

console.log("");
console.log(`renderer: ${gpu}`);
console.log(`viewport width: ${CSS_WIDTH}px CSS, dpr ${await page.evaluate(() => devicePixelRatio)}`);
console.log(
  `backing store: new ${results[0].newBackingPx.toLocaleString()}px vs prototype ${results[0].legacyBackingPx.toLocaleString()}px ` +
    `(${round(results[0].legacyBackingPx / results[0].newBackingPx)}x fewer pixels)`
);
console.log("");
console.log("| points | new: 1点追加 | new: 全再描画 | prototype: 全再描画 | 全再描画の比 |");
console.log("|--------|-------------|--------------|---------------------|-------------|");
for (const r of results) {
  console.log(
    `| ${r.points} | ${round(r.newAppendMs)} ms | ${round(r.newRepaintMs)} ms | ${round(r.legacyRepaintMs)} ms | ${round(r.legacyRepaintMs / r.newRepaintMs)}x |`
  );
}
console.log("");
console.log("prototype raw samples (ms):");
for (const r of results) {
  console.log(`  ${r.points} points: ${r.legacySamples.map(round).join(", ")}`);
}
console.log("");

await browser.close();
server.kill("SIGTERM");
