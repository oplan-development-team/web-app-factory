/**
 * 生成結果を一覧するコンタクトシートを書き出す開発用スクリプト。
 * 「面が主役になっているか」「中心が噛み合っているか」を目視で確かめるために使う。
 *
 *   npx vite-node scripts/contact-sheet.ts -- <出力先html> [シード数]
 */

import { writeFileSync } from "node:fs";
import { buildKamonStructure, motifExtentOf } from "../src/lib/kamon";
import { enclosureById } from "../src/lib/enclosure";
import { PALETTES } from "../src/lib/palette";
import { renderKamonSVG } from "../src/lib/render";

const args = process.argv.slice(2).filter((a) => a !== "--");
const outPath = args[0] ?? "contact-sheet.html";
const seedCount = Number(args[1] ?? 40);

const seeds = Array.from({ length: seedCount }, (_, i) => `見本 ${i} / ${1980 + i}-0${(i % 9) + 1}-1${i % 9}`);

const cells = seeds.map((seed, i) => {
  const variant = i % 3;
  const structure = buildKamonStructure(seed, variant);
  const svg = renderKamonSVG(structure, PALETTES[0]!).replace(
    'width="400" height="400"',
    'width="150" height="150"',
  );
  const inner = enclosureById(structure.enclosureId).innerRadius;
  const ratio = (motifExtentOf(structure) / inner).toFixed(2);
  return `<figure>
    ${svg}
    <figcaption><b>${structure.name}</b><br>${structure.composition.kind} n=${structure.composition.count}
    <br>充填 ${ratio} / 要素 ${structure.primitiveCount}</figcaption>
  </figure>`;
});

writeFileSync(
  outPath,
  `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:16px;background:#efe6d2;
  font:11px/1.5 -apple-system,sans-serif;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px">
  ${cells.join("")}</body>`,
);

console.log(`wrote ${outPath} (${cells.length} cells)`);
