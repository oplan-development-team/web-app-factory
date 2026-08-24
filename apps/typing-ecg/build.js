// build.js — this app has no bundler step (plain HTML/CSS/ES modules).
// "npm run build" instead performs a sanity check: verify required files
// exist and that every JS module is syntactically valid, so CI / the
// pipeline has a real command to run that can actually fail.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));

const requiredFiles = ["index.html", "styles.css", "app.js", "ecg-canvas.js", "diagnosis.js"];
const jsFiles = ["app.js", "ecg-canvas.js", "diagnosis.js"];

let ok = true;

for (const file of requiredFiles) {
  const full = path.join(dir, file);
  if (!existsSync(full)) {
    console.error(`[build] missing required file: ${file}`);
    ok = false;
  }
}

for (const file of jsFiles) {
  const full = path.join(dir, file);
  if (!existsSync(full)) continue;
  try {
    execFileSync(process.execPath, ["--check", full], { stdio: "pipe" });
    console.log(`[build] syntax OK: ${file}`);
  } catch (err) {
    console.error(`[build] syntax error in ${file}:\n${err.stderr?.toString() || err.message}`);
    ok = false;
  }
}

if (!ok) {
  console.error("[build] FAILED");
  process.exit(1);
}

console.log("[build] OK — static site, no bundling required. Deploy the files as-is (see Dockerfile).");
