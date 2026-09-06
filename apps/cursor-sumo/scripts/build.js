// ビルドツール不使用のプロジェクトのための最小ビルドスクリプト。
// index.html / style.css / src/ を dist/ にそのままコピーする（GitHub Pages配信用）。

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");

const ENTRIES = ["index.html", "style.css", "src"];

async function rmDist() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
}

async function copyRecursive(src, dest) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const items = await fs.readdir(src);
    for (const item of items) {
      await copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    await fs.copyFile(src, dest);
  }
}

async function build() {
  await rmDist();
  for (const entry of ENTRIES) {
    const src = path.join(rootDir, entry);
    const dest = path.join(distDir, entry);
    await copyRecursive(src, dest);
  }
  console.log(`[build] dist/ を生成しました (${ENTRIES.join(", ")})`);
}

build().catch((err) => {
  console.error("[build] 失敗:", err);
  process.exit(1);
});
