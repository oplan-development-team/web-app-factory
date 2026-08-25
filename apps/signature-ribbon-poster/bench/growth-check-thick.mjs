// Worst-case fill test: force every segment to the *slow* end of the speed
// mapping, which the app renders at MAX_RIBBON_WIDTH (34px) — the widest,
// most fill-expensive ribbon the renderer ever draws. Checks whether append
// cost scales with total points once every segment pays the maximum fill cost.
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4397;
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

// Monkeypatch: run the same runBench, but force every point's speed to 0 by
// injecting a variant stroke generator inline via page.evaluate.
console.log("total points | thick-append ms (median, last 200) | thick-repaint ms (median full)");
for (const total of TOTALS) {
  const result = await page.evaluate(
    async ([pointCount, cssWidth]) => {
      const { LiveRenderer } = await import("/src/render/live-renderer.ts");
      const { domCanvasFactory } = await import("/src/render/types.ts");
      const { POSTER_WIDTH, POSTER_HEIGHT } = await import("/src/core/poster.ts");

      const display = document.querySelector("#new-canvas");
      const points = [];
      let t = 0;
      for (let i = 0; i < pointCount; i++) {
        const u = i / (pointCount - 1);
        const x = POSTER_WIDTH * (0.1 + 0.8 * u);
        const y = POSTER_HEIGHT * (0.5 + 0.3 * Math.sin(u * Math.PI * 8));
        t += 50; // large dt per point -> speed stays near 0 -> forces MAX_RIBBON_WIDTH
        points.push({ x, y, t, speed: 0 });
      }
      const stroke = { colorId: "gold", points };

      const renderer = new LiveRenderer({
        display,
        createCanvas: domCanvasFactory,
        backgroundHex: "#0a0908",
        maxSpeed: 3.2,
        cssWidth,
        pixelRatio: window.devicePixelRatio || 1,
      });

      renderer.setStrokes([stroke], false);
      renderer.render();

      const APPEND_SAMPLES = 200;
      const start = Math.max(2, pointCount - APPEND_SAMPLES);
      const live = { colorId: stroke.colorId, points: stroke.points.slice(0, start) };
      renderer.invalidate();
      renderer.setStrokes([live], true);
      renderer.render();

      const appendSamples = [];
      for (let n = start; n < pointCount; n++) {
        live.points.push(stroke.points[n]);
        const t0 = performance.now();
        renderer.setStrokes([live], true);
        renderer.render();
        appendSamples.push(performance.now() - t0);
      }
      appendSamples.sort((a, b) => a - b);
      const median = (arr) =>
        arr.length % 2 === 0
          ? (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2
          : arr[(arr.length - 1) / 2];

      const repaintSamples = [];
      for (let i = 0; i < 30; i++) {
        renderer.invalidate();
        renderer.setStrokes([stroke], false);
        const t0 = performance.now();
        renderer.render();
        repaintSamples.push(performance.now() - t0);
      }
      repaintSamples.sort((a, b) => a - b);

      return {
        appendMs: median(appendSamples),
        repaintMs: median(repaintSamples),
      };
    },
    [total, CSS_WIDTH]
  );
  console.log(
    `${String(total).padStart(12)} | ${result.appendMs.toFixed(3).padStart(35)} | ${result.repaintMs.toFixed(3).padStart(30)}`
  );
}

await browser.close();
server.kill();
