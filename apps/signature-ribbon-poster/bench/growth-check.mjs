// Standalone check: does the *new* renderer's per-point append cost grow with
// total accumulated points? Skips the legacy comparison entirely (it can hang
// the page at high point counts, which is not what's being investigated here).
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4398;
const CSS_WIDTH = 700;
const TOTALS = [200, 1000, 3000, 6000, 12000];

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
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}/bench/index.html`);
await page.waitForFunction(() => window.runBench !== undefined);

console.log("total points | newAppendMs (median, last 200) | newRepaintMs (median full redraw)");
for (const total of TOTALS) {
  const result = await page.evaluate(
    ([pointCount, cssWidth]) => window.runBench(pointCount, cssWidth),
    [total, CSS_WIDTH]
  );
  console.log(
    `${String(total).padStart(12)} | ${result.newAppendMs.toFixed(3).padStart(30)} | ${result.newRepaintMs.toFixed(3).padStart(28)}`
  );
}

await browser.close();
server.kill();
