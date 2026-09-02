/**
 * 12 の型（4 系統 × 3 レア度）を並べたコンタクトシートを書き出す。
 * 生成ロジックの見た目を目視で確かめるための開発用スクリプト。
 *
 *   npx vite-node scripts/contact-sheet.ts -- <出力先.html> [シード]
 */
import { writeFileSync } from "node:fs";
import { FAMILIES, FAMILY_LABEL, RARITIES } from "../src/lib/constants.ts";
import { patternSvg } from "../src/lib/patterns/index.ts";

const ACCENT: Record<string, string> = {
  COMMON: "#8b8b90",
  RARE: "#8fc4e0",
  EPIC: "#e0b56a",
};

const outPath = process.argv[2] ?? "contact-sheet.html";
const baseSeed = Number(process.argv[3] ?? 20260902);

const cells: string[] = [];
for (const family of FAMILIES) {
  for (const rarity of RARITIES) {
    const seed = (baseSeed + family.length * 7919 + rarity.length * 104729) >>> 0;
    cells.push(`
      <figure style="color:${ACCENT[rarity]}">
        <div class="frame">${patternSvg(family, rarity, seed)}</div>
        <figcaption>${family} / ${FAMILY_LABEL[family].ja} — ${rarity}</figcaption>
      </figure>`);
  }
}

writeFileSync(
  outPath,
  `<!doctype html><html lang="ja"><meta charset="utf-8">
<title>tilt-gacha contact sheet</title>
<style>
  body{background:#0b0b0c;color:#eceae6;font:12px ui-monospace,monospace;margin:24px}
  .sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:900px}
  figure{margin:0}
  .frame{background:#131315;border:1px solid #232326;aspect-ratio:1}
  svg{width:100%;height:100%;display:block}
  figcaption{margin-top:6px;color:#8b8b90;letter-spacing:.08em}
</style>
<div class="sheet">${cells.join("")}</div>
</html>`,
  "utf8",
);

console.log(`wrote ${outPath} (${cells.length} cells, baseSeed=${baseSeed})`);
