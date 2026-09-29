import './style.css';
import { Band, InkDef, MAX_DROPS, PRESETS, RGB, Sim, analyze, blendInk, inkSwatch, radiusOf, rgb2hex } from './sim';
import { CEN, InkLayers, R_PAPER, W, drawPaper, makeDishLayer, makePaperTex, ACCENT, INK } from './render';
import { CARD_H, CARD_W, CardData, renderCard } from './card';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mobileMq = window.matchMedia('(max-width: 860px)');

/* ---------- state ---------- */
const sim = new Sim();
const layers = new InkLayers();
const tex = makePaperTex(W, 7);
const dish = makeDishLayer();

let paused = false;
let speed = 1;
let dried = false;
let dryDone = false;
let dry = 0;
let exported = false;
let bands: Band[] = [];
let specSeq = 380 + Math.floor(Math.random() * 90);
let specNo = '';
let inkId = 'black';
let sampleEdited = false;
let dirty = true;
const blend = { c: 50, m: 40, y: 60 };
const suctions: { x: number; y: number; r: number; color: string; t: number }[] = [];
const cur = { x: 0, y: 0, visible: false, pressing: false, cancelled: false, outside: false };

const canvas = $<HTMLCanvasElement>('plate');
const ctx = canvas.getContext('2d')!;
const volume = () => parseFloat($<HTMLInputElement>('vol').value);

function currentInk(): InkDef {
  if (inkId === 'blend') return blendInk(blend.c, blend.m, blend.y);
  return PRESETS.find((p) => p.id === inkId)!;
}
const swatchOf = (ink: InkDef) => rgb2hex(inkSwatch(ink));

type Stage = 'empty' | 'running' | 'front' | 'dry';
const stage = (): Stage => (!sim.drops.length ? 'empty' : dried ? 'dry' : sim.reached ? 'front' : 'running');

/* ---------- toast ---------- */
let toastTimer = 0;
function toast(msg: string, ms = 3600) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('on');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('on'), ms);
}

/* ---------- chips ---------- */
const chipsEl = $('chips');
function buildChips() {
  chipsEl.textContent = '';
  const all: { id: string; label: string; ink: InkDef }[] = [
    ...PRESETS.map((p) => ({ id: p.id, label: p.label, ink: p })),
    { id: 'blend', label: '自作', ink: blendInk(blend.c, blend.m, blend.y) },
  ];
  for (const it of all) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.ink = it.id;
    b.setAttribute('role', 'radio');
    const sw = document.createElement('i');
    sw.className = 'sw';
    sw.style.background = swatchOf(it.ink);
    const t = document.createElement('span');
    t.textContent = it.label;
    b.append(sw, t);
    b.addEventListener('click', () => selectInk(it.id));
    chipsEl.append(b);
  }
  syncChips();
}
function syncChips() {
  chipsEl.querySelectorAll<HTMLButtonElement>('.chip').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.ink === inkId));
    if (b.dataset.ink === 'blend') (b.querySelector('.sw') as HTMLElement).style.background = swatchOf(blendInk(blend.c, blend.m, blend.y));
  });
  $('blendGroup').hidden = inkId !== 'blend';
}
function selectInk(id: string) {
  inkId = id;
  syncChips();
  dirty = true;
  const el = chipsEl.querySelector<HTMLElement>(`[data-ink="${id}"]`);
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/* ---------- sliders ---------- */
for (const [id, key] of [['blC', 'c'], ['blM', 'm'], ['blY', 'y']] as const) {
  const inp = $<HTMLInputElement>(id);
  inp.addEventListener('input', () => {
    blend[key] = parseInt(inp.value, 10);
    $(id + 'v').textContent = inp.value;
    syncChips();
  });
}
$<HTMLInputElement>('vol').addEventListener('input', () => {
  $('volv').textContent = volume().toFixed(1) + ' µL';
  dirty = true;
});

/* ---------- time controls ---------- */
$('btnPause').addEventListener('click', () => {
  paused = !paused;
  updateUI();
});
document.querySelectorAll<HTMLButtonElement>('.spd').forEach((b) =>
  b.addEventListener('click', () => {
    speed = parseInt(b.dataset.speed!, 10);
    updateUI();
  }));

/* ---------- drop handling ---------- */
function addDrop(x: number, y: number) {
  if (dried) { toast('乾燥済みのため滴を追加できません。新しい濾紙で再開できます'); return; }
  if (sim.reached) { toast('前線が縁に達しています。乾燥させて標本にできます'); return; }
  if (sim.drops.length >= MAX_DROPS) { toast(`滴は${MAX_DROPS}個までです`); return; }
  const ink = currentInk();
  sim.addDrop(x, y, volume(), ink);
  paused = false;
  if (!reduced.matches) suctions.push({ x, y, r: radiusOf(volume()), color: swatchOf(ink), t: performance.now() });
  dirty = true;
  updateUI();
}

function toNorm(e: { clientX: number; clientY: number }) {
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * W;
  const py = ((e.clientY - rect.top) / rect.height) * W;
  return { x: (px - CEN) / R_PAPER, y: (py - CEN) / R_PAPER };
}
const inside = (x: number, y: number) => x * x + y * y <= 0.97 * 0.97;

canvas.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  const p = toNorm(e);
  if (dried || sim.reached) {
    if (inside(p.x, p.y)) addDrop(p.x, p.y);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  cur.pressing = true;
  cur.cancelled = false;
  cur.visible = true;
  cur.x = p.x; cur.y = p.y;
  cur.outside = !inside(p.x, p.y);
  if (cur.outside) cur.cancelled = true;
  dirty = true;
});
canvas.addEventListener('pointermove', (e) => {
  const p = toNorm(e);
  cur.x = p.x; cur.y = p.y;
  cur.outside = !inside(p.x, p.y);
  if (e.pointerType === 'mouse' || cur.pressing) cur.visible = true;
  if (cur.pressing && cur.outside) cur.cancelled = true;
  dirty = true;
});
canvas.addEventListener('pointerup', (e) => {
  if (!cur.pressing) return;
  cur.pressing = false;
  const p = toNorm(e);
  if (!cur.cancelled && inside(p.x, p.y)) addDrop(p.x, p.y);
  if (e.pointerType !== 'mouse') cur.visible = false;
  dirty = true;
});
canvas.addEventListener('pointercancel', () => { cur.pressing = false; cur.visible = false; dirty = true; });
canvas.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse' && !cur.pressing) { cur.visible = false; dirty = true; }
});
canvas.addEventListener('focus', () => {
  if (canvas.matches(':focus-visible')) { cur.visible = true; dirty = true; }
});
canvas.addEventListener('blur', () => { cur.visible = false; dirty = true; });
canvas.addEventListener('keydown', (e) => {
  const step = e.shiftKey ? 0.15 : 0.04;
  let handled = true;
  if (e.key === 'ArrowLeft') cur.x -= step;
  else if (e.key === 'ArrowRight') cur.x += step;
  else if (e.key === 'ArrowUp') cur.y -= step;
  else if (e.key === 'ArrowDown') cur.y += step;
  else if (e.key === 'Enter' || e.key === ' ') {
    if (inside(cur.x, cur.y)) addDrop(cur.x, cur.y);
  } else handled = false;
  if (!handled) return;
  e.preventDefault();
  const m = Math.hypot(cur.x, cur.y);
  if (m > 0.95) { cur.x *= 0.95 / m; cur.y *= 0.95 / m; }
  cur.visible = true;
  cur.outside = false;
  dirty = true;
});

/* ---------- dry / new ---------- */
function doDry() {
  if (!sim.drops.length || dried) return;
  sim.freeze();
  dried = true;
  dry = 0;
  dryDone = false;
  specNo = 'PC-' + String(specSeq++).padStart(4, '0');
  bands = analyze(sim);
  const s = $<HTMLInputElement>('inSample');
  if (!sampleEdited) s.value = autoSampleName();
  exported = false;
  dirty = true;
  updateUI();
}
function autoSampleName() {
  const names: string[] = [];
  for (const d of sim.drops) if (!names.includes(d.inkEn)) names.push(d.inkEn);
  const s = names.length > 1 ? 'Mixed: ' + names.join(' + ') : names[0] ?? '';
  return s.slice(0, 40);
}
function resetPaper() {
  sim.reset();
  dried = false; dryDone = false; dry = 0; exported = false; bands = []; specNo = '';
  paused = false;
  sampleEdited = false;
  suctions.length = 0;
  $<HTMLInputElement>('inSample').value = '';
  closeExportSheet();
  clearPreview();
  dirty = true;
  updateUI();
}
function requestNew() {
  if (!sim.drops.length) return;
  if (exported) { resetPaper(); return; }
  ($('dlgExport') as HTMLButtonElement).hidden = !dryDone;
  $<HTMLDialogElement>('confirm').showModal();
}
$('btnNew').addEventListener('click', requestNew);
$('btnDry').addEventListener('click', doDry);
$('dlgCancel').addEventListener('click', () => $<HTMLDialogElement>('confirm').close());
$('dlgDiscard').addEventListener('click', () => { $<HTMLDialogElement>('confirm').close(); resetPaper(); });
$('dlgExport').addEventListener('click', async () => {
  $<HTMLDialogElement>('confirm').close();
  if (await exportPng()) resetPaper();
});

/* ---------- export ---------- */
const card = document.createElement('canvas');
let pvUrl = '';
let pvTimer = 0;
const pvImg = $<HTMLImageElement>('pvImg');
function cardData(): CardData {
  const d = new Date();
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  return {
    no: specNo, date, bands,
    sample: $<HTMLInputElement>('inSample').value.trim(),
    title: $<HTMLInputElement>('inTitle').value.trim(),
  };
}
function drawCard() {
  renderCard(card, cardData(), sim);
}
function clearPreview() {
  window.clearTimeout(pvTimer);
  if (pvUrl) URL.revokeObjectURL(pvUrl);
  pvUrl = '';
  pvImg.hidden = true;
  pvImg.removeAttribute('src');
  $('pvEmpty').hidden = false;
}
function schedulePreview(delay = 120) {
  if (!dryDone) return;
  window.clearTimeout(pvTimer);
  pvTimer = window.setTimeout(() => {
    try {
      drawCard();
    } catch (err) {
      console.error(err);
      return;
    }
    card.toBlob((blob) => {
      if (!blob) return;
      if (pvUrl) URL.revokeObjectURL(pvUrl);
      pvUrl = URL.createObjectURL(blob);
      pvImg.src = pvUrl;
      pvImg.hidden = false;
      $('pvEmpty').hidden = true;
    }, 'image/png');
  }, delay);
}
for (const id of ['inSample', 'inTitle']) {
  $<HTMLInputElement>(id).addEventListener('input', () => {
    if (id === 'inSample') sampleEdited = true;
    exported = false;
    schedulePreview();
    updateUI();
  });
}
function cardBlob(): Promise<Blob | null> {
  drawCard();
  return new Promise((res) => card.toBlob((b) => res(b), 'image/png'));
}
async function exportPng(): Promise<boolean> {
  if (!dryDone) return false;
  const blob = await cardBlob();
  if (!blob) { toast('書き出しに失敗しました。もう一度お試しください'); return false; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${specNo}.png`;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  exported = true;
  toast(`${specNo} を書き出しました（${CARD_W}×${CARD_H}px）`);
  updateUI();
  return true;
}
$('btnExport').addEventListener('click', () => { void exportPng(); });
const canShare = (() => {
  try {
    return typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [new File([new Blob()], 'x.png', { type: 'image/png' })] });
  } catch { return false; }
})();
$('btnShare').addEventListener('click', async () => {
  const blob = await cardBlob();
  if (!blob) return;
  try {
    await navigator.share({ files: [new File([blob], `${specNo}.png`, { type: 'image/png' })], title: specNo });
    exported = true;
    toast(`${specNo} を共有しました`);
    updateUI();
  } catch { /* キャンセル */ }
});

/* ---------- mobile layout: 要素の付け替え ---------- */
const homes = new Map<HTMLElement, Comment>();
function stash(el: HTMLElement) {
  const c = document.createComment(el.id);
  el.before(c);
  homes.set(el, c);
}
const movers = [$('fs1'), $('blendGroup'), $('volGroup'), $('timeGroup'), $('exportBlock')];
movers.forEach(stash);
function place(el: HTMLElement, target: HTMLElement | null) {
  if (target) target.append(el);
  else homes.get(el)!.after(el);
}
function applyLayout() {
  const m = mobileMq.matches;
  place($('fs1'), m ? $('dockChips') : null);
  place($('volGroup'), m ? $('sheetBody') : null);
  place($('timeGroup'), m ? $('sheetBody') : null);
  place($('blendGroup'), m ? $('sheetBody') : null);
  place($('exportBlock'), m ? $('exportSheetBody') : null);
  if (!m) { closeSheet(); closeExportSheet(); }
  $('btnShare').hidden = !(canShare && m);
  dirty = true;
}
mobileMq.addEventListener('change', applyLayout);

function closeSheet() {
  $('adjustSheet').classList.remove('open');
  $('btnAdjust').setAttribute('aria-expanded', 'false');
}
$('btnAdjust').addEventListener('click', () => {
  const open = !$('adjustSheet').classList.contains('open');
  $('adjustSheet').classList.toggle('open', open);
  $('btnAdjust').setAttribute('aria-expanded', String(open));
});
function openExportSheet() {
  closeSheet();
  $('exportSheet').classList.add('open');
  $('exportSheet').setAttribute('aria-hidden', 'false');
  schedulePreview(0);
}
function closeExportSheet() {
  $('exportSheet').classList.remove('open');
  $('exportSheet').setAttribute('aria-hidden', 'true');
}
$('btnCloseX').addEventListener('click', closeExportSheet);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSheet(); closeExportSheet(); }
});
$('dockCta').addEventListener('click', () => {
  const s = stage();
  if (s === 'running' || s === 'front') doDry();
  else if (s === 'dry') { if (exported) requestNew(); else openExportSheet(); }
});

/* ---------- UI update ---------- */
const STATUS: Record<Stage, string> = {
  empty: '濾紙に滴を落とすと、水が広がり始めます。',
  running: '展開中…色ごとの速さの違いで帯が分かれていきます。',
  front: '展開が完了しました。乾燥させて標本にできます',
  dry: '',
};
function setText(id: string, v: string) {
  const el = $(id);
  if (el.textContent !== v) el.textContent = v;
}
function updateUI() {
  const s = stage();
  const active = { empty: 2, running: 3, front: 4, dry: 5 }[s];
  document.querySelectorAll<HTMLElement>('.step').forEach((el) => {
    const n = parseInt(el.dataset.step!, 10);
    el.dataset.state = n === active ? 'active' : n < active ? 'done' : 'todo';
  });
  const dropLocked = s === 'dry';
  ($('fs1') as HTMLFieldSetElement).disabled = dropLocked;
  $<HTMLInputElement>('vol').disabled = dropLocked;
  (['blC', 'blM', 'blY'] as const).forEach((id) => ($<HTMLInputElement>(id).disabled = dropLocked));

  const live = s === 'running';
  const pause = $<HTMLButtonElement>('btnPause');
  pause.disabled = !live;
  pause.textContent = paused ? '再開' : '一時停止';
  document.querySelectorAll<HTMLButtonElement>('.spd').forEach((b) => {
    b.setAttribute('aria-pressed', String(parseInt(b.dataset.speed!, 10) === speed));
    b.disabled = s === 'front' || s === 'dry';
  });

  const btnDry = $<HTMLButtonElement>('btnDry');
  btnDry.disabled = !(s === 'running' || s === 'front');
  btnDry.classList.toggle('hot', s === 'front');
  setText('dryReason', s === 'empty' ? '1滴以上落とすと乾燥できます' : s === 'dry' ? '乾燥済みです' : '');

  const exportable = s === 'dry' && dryDone;
  ($('fs5') as HTMLFieldSetElement).disabled = !exportable;
  $<HTMLButtonElement>('btnExport').disabled = !exportable;
  $('btnExport').classList.toggle('hot', false);
  setText('exportReason', exportable ? (exported ? `${specNo}.png を書き出し済みです` : '') : s === 'dry' ? '乾燥中… 数秒お待ちください' : '乾燥させると書き出せます');
  setText('specNo', specNo || 'PC-----');
  $<HTMLButtonElement>('btnShare').disabled = !exportable;
  const btnNew = $<HTMLButtonElement>('btnNew');
  btnNew.hidden = s === 'empty';
  btnNew.classList.toggle('cta', s === 'dry' && exported);
  btnNew.classList.toggle('hot', false);
  $('btnExport').classList.toggle('cta', !(s === 'dry' && exported));

  $('guide').classList.toggle('gone', s !== 'empty');
  setText('stageTag', { empty: 'EMPTY', running: paused ? 'PAUSED' : 'DEVELOPING', front: 'FRONT REACHED', dry: dryDone ? 'DRIED' : 'DRYING' }[s]);
  let msg = STATUS[s];
  if (s === 'dry') msg = !dryDone ? '乾燥中…紙が生成りに落ち着いていきます。' : exported ? `標本 ${specNo} を書き出しました。新しい濾紙で続けられます。` : `標本 ${specNo} が乾燥しました。検出した帯: ${bands.length}本。ラベルを整えて書き出せます。`;
  if (s === 'running' && paused) msg = '一時停止中。再開すると展開が進みます。';
  setText('status', msg);

  // 固定バー
  const cta = $<HTMLButtonElement>('dockCta');
  let label = '乾燥させる', reason = '';
  cta.disabled = false;
  if (s === 'empty') { cta.disabled = true; reason = '1滴以上落とすと乾燥できます'; }
  else if (s === 'dry') {
    label = exported ? '新しい濾紙' : '標本を書き出す';
    cta.disabled = !dryDone;
    reason = !dryDone ? '乾燥中… 数秒お待ちください' : exported ? '' : '書き出さずに戻ると標本は失われます';
  }
  cta.textContent = label;
  cta.classList.toggle('hot', s === 'front');
  setText('dockReason', reason);
  ($('btnAdjust') as HTMLButtonElement).disabled = dropLocked;
  if (dropLocked) closeSheet();
}

function updateReadout() {
  setText('elapsed', sim.t.toFixed(1));
  const pct = Math.round(sim.progress() * 100);
  setText('frontPct', String(pct));
  $('frontBar').style.transform = `scaleX(${sim.progress()})`;
}

/* ---------- render ---------- */
function ring(x: number, y: number, r: number, color: string, dashed: boolean) {
  const px = CEN + x * R_PAPER, py = CEN + y * R_PAPER, pr = Math.max(9, r * R_PAPER);
  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(247,242,230,0.9)';
  ctx.beginPath(); ctx.arc(px, py, pr + 2, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.setLineDash(dashed ? [6, 5] : []);
  ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(px - pr - 9, py); ctx.lineTo(px - pr + 5, py); ctx.moveTo(px + pr - 5, py); ctx.lineTo(px + pr + 9, py);
  ctx.moveTo(px, py - pr - 9); ctx.lineTo(px, py - pr + 5); ctx.moveTo(px, py + pr - 5); ctx.lineTo(px, py + pr + 9);
  ctx.stroke();
  ctx.restore();
}
function render(now: number) {
  ctx.clearRect(0, 0, W, W);
  ctx.drawImage(dish, 0, 0);
  layers.update(sim, dry);
  drawPaper(ctx, CEN, CEN, R_PAPER, layers, tex, dry);

  // 滴下時の吸い込みモーション
  for (let i = suctions.length - 1; i >= 0; i--) {
    const s = suctions[i];
    const k = (now - s.t) / 900;
    if (k >= 1) { suctions.splice(i, 1); continue; }
    const e = 1 - Math.pow(1 - k, 3);
    const px = CEN + s.x * R_PAPER, py = CEN + s.y * R_PAPER;
    const rr = s.r * R_PAPER * (2.1 - 1.1 * e);
    ctx.save();
    ctx.globalAlpha = (1 - e) * 0.85;
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = (1 - e) * 0.7;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(px - rr * 0.3, py - rr * 0.32, rr * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // 産卵した原点の印(展開前の目印)は不要。カーソルリング
  if (cur.visible && !dried && !sim.reached) {
    if (cur.outside) {
      const px = CEN + cur.x * R_PAPER, py = CEN + cur.y * R_PAPER;
      if (Math.hypot(cur.x, cur.y) < 1.15) {
        ctx.save();
        ctx.strokeStyle = ACCENT; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(px - 9, py - 9); ctx.lineTo(px + 9, py + 9); ctx.moveTo(px + 9, py - 9); ctx.lineTo(px - 9, py + 9); ctx.stroke();
        ctx.restore();
      }
    } else {
      ring(cur.x, cur.y, radiusOf(volume()), swatchOf(currentInk()), cur.pressing);
    }
  }
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (stage() === 'running' && !paused) {
    // 時間加速はシミュレーションの進み幅を増やして実現
    sim.step(dt * speed);
    dirty = true;
    if (sim.reached) updateUI();
  }
  if (dried && dry < 1) {
    dry = Math.min(1, dry + dt / (reduced.matches ? 0.6 : 3.6));
    dirty = true;
    if (dry >= 1) { dryDone = true; updateUI(); schedulePreview(0); }
  }
  if (suctions.length) dirty = true;
  if (dirty) { dirty = false; render(now); updateReadout(); }
  requestAnimationFrame(frame);
}

buildChips();
applyLayout();
updateUI();
requestAnimationFrame(frame);

// デバッグ・自動検証用の最小フック
(window as unknown as { __lab: unknown }).__lab = { sim, addDrop, doDry, get bands() { return bands as RGB[] | Band[]; } };
