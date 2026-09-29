// Slit-scan camera: all processing stays on device (getUserMedia + Canvas 2D).
const $ = (id) => document.getElementById(id);
const el = {
  video: $('video'), pv: $('pv'), slitline: $('slitline'), out: $('out'), cbox: $('cbox'), stage: $('stage'),
  head: $('head'), empty: $('empty'), flash: $('flash'), toast: $('toast'), lamp: $('lamp'), lampText: $('lamp-text'),
  roHead: $('ro-head'), roTime: $('ro-time'), roSlit: $('ro-slit'),
  pos: $('pos'), speed: $('speed'), thick: $('thick'), vSpeed: $('v-speed'), vThick: $('v-thick'),
  main: $('btn-main'), save: $('btn-save'), cam: $('btn-cam'), mirror: $('mirror'),
  sheetToggle: $('sheet-toggle'), params: $('params'), presetLabel: $('preset-label'),
};
const ctx = el.out.getContext('2d', { alpha: false });

const PRESETS = {
  finish: { label: 'フォトフィニッシュ', dir: 'LR', pos: 0.5, speed: 1, thick: 1, mode: 'strip' },
  flow: { label: '流れる背景', dir: 'LR', pos: 0.08, speed: 6, thick: 2, mode: 'oneshot' },
  stripe: { label: '縞の風景', dir: 'BT', pos: 0.5, speed: 2, thick: 1, mode: 'oneshot' },
};
const cfg = { dir: 'LR', pos: 0.5, speed: 1, thick: 1, mirror: true, mode: 'oneshot', facing: 'user' };
let preset = null;
const run = { state: 'idle', head: 0, t0: 0, elapsed: 0, dirty: false, activeMirror: true, W: 0, H: 0 };
let stream = null;
let toastTimer = 0;

const isHz = () => cfg.dir === 'TB' || cfg.dir === 'BT';
const isFwd = () => cfg.dir === 'LR' || cfg.dir === 'TB';
const viewMirror = () => (run.state === 'scanning' ? run.activeMirror : cfg.mirror);
const isMobile = () => matchMedia('(max-width:899px)').matches;

function toast(msg, warn = false) {
  el.toast.textContent = msg;
  el.toast.classList.toggle('warn', warn);
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
}
function flash() {
  el.flash.classList.remove('go'); void el.flash.offsetWidth; el.flash.classList.add('go');
}

/* ---------- canvas ---------- */
function orient() {
  if (isHz()) return 'portrait';
  return innerHeight > innerWidth ? 'portrait' : 'landscape';
}
function allocCanvas() {
  const long = isMobile() ? 800 : 1600, short = isMobile() ? 450 : 900;
  const portrait = orient() === 'portrait';
  run.W = portrait ? short : long; run.H = portrait ? long : short;
  el.out.width = run.W; el.out.height = run.H;
  ctx.fillStyle = '#070706'; ctx.fillRect(0, 0, run.W, run.H);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  fitCanvas();
}
function fitCanvas() {
  const r = el.stage.getBoundingClientRect();
  const aw = Math.max(40, r.width - 16), ah = Math.max(40, r.height - 16);
  const s = Math.min(aw / el.out.width, ah / el.out.height);
  el.cbox.style.width = Math.floor(el.out.width * s) + 'px';
  el.cbox.style.height = Math.floor(el.out.height * s) + 'px';
}
new ResizeObserver(fitCanvas).observe(el.stage);
addEventListener('resize', () => { if (run.state === 'idle' && !run.dirty) { allocCanvas(); renderUI(); } });

/* ---------- scan engine ---------- */
function writeSlit() {
  const v = el.video;
  const vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || v.readyState < 2) return;
  const hz = isHz(), fwd = isFwd();
  const span = hz ? run.H : run.W;
  const t = Math.min(cfg.thick, hz ? vh : vw);
  let n = cfg.speed;
  let offset;
  if (run.head >= span) {
    if (cfg.mode === 'oneshot') return finish('done');
    // strip: shift existing content away from the writing edge
    if (!hz) {
      if (fwd) ctx.drawImage(el.out, n, 0, run.W - n, run.H, 0, 0, run.W - n, run.H);
      else ctx.drawImage(el.out, 0, 0, run.W - n, run.H, n, 0, run.W - n, run.H);
    } else if (fwd) ctx.drawImage(el.out, 0, n, run.W, run.H - n, 0, 0, run.W, run.H - n);
    else ctx.drawImage(el.out, 0, 0, run.W, run.H - n, 0, n, run.W, run.H - n);
    offset = fwd ? span - n : 0;
  } else {
    n = Math.min(n, span - run.head);
    offset = fwd ? run.head : span - run.head - n;
    run.head += n;
  }
  if (!hz) {
    const f = run.activeMirror ? 1 - cfg.pos : cfg.pos;
    const sx = Math.round(f * (vw - t));
    ctx.drawImage(v, sx, 0, t, vh, offset, 0, n, run.H);
  } else {
    const sy = Math.round(cfg.pos * (vh - t));
    if (run.activeMirror) {
      ctx.save(); ctx.translate(run.W, 0); ctx.scale(-1, 1);
      ctx.drawImage(v, 0, sy, vw, t, 0, offset, run.W, n); ctx.restore();
    } else ctx.drawImage(v, 0, sy, vw, t, 0, offset, run.W, n);
  }
  run.dirty = true;
  if (run.head >= span && cfg.mode === 'oneshot') finish('done');
}

function start() {
  if (!stream || !el.video.videoWidth) return;
  allocCanvas();
  run.head = 0; run.dirty = false; run.t0 = performance.now(); run.elapsed = 0;
  run.activeMirror = cfg.mirror; run.state = 'scanning';
  renderUI();
}
function finish(state) {
  if (run.state !== 'scanning') return;
  run.elapsed = (performance.now() - run.t0) / 1000;
  run.state = state; flash();
  toast(state === 'done' ? '撮影完了 — 保存できます' : '凍結しました — 保存できます');
  renderUI();
}
function resetToIdle() {
  run.state = 'idle'; run.head = 0; run.dirty = false; run.elapsed = 0;
  allocCanvas(); renderUI();
}
function loop() {
  if (run.state === 'scanning') {
    writeSlit();
    if (run.state === 'scanning') run.elapsed = (performance.now() - run.t0) / 1000;
    updateReadouts();
  }
  requestAnimationFrame(loop);
}

/* ---------- confirm / modals ---------- */
let modalResolve = null;
function ask() {
  return new Promise((res) => {
    modalResolve = res; $('modal').hidden = false; $('m-save').focus();
  });
}
function answer(v) { $('modal').hidden = true; if (modalResolve) { modalResolve(v); modalResolve = null; } }
$('m-save').onclick = () => answer('save');
$('m-discard').onclick = () => answer('discard');
$('m-cancel').onclick = () => answer('cancel');
async function guard() {
  if (!run.dirty) return true;
  const wasScanning = run.state === 'scanning';
  const r = await ask();
  if (r === 'cancel') return false;
  if (r === 'save') { if (wasScanning && run.state === 'scanning') finish('frozen'); return await saveImage(); }
  return true;
}

function showOverlay(title, node) {
  $('o-title').textContent = title;
  const b = $('o-body'); b.replaceChildren(node);
  $('overlay').hidden = false; $('o-close').focus();
}
$('o-close').onclick = () => { $('overlay').hidden = true; };
function helpNode() {
  const d = document.createElement('div');
  const lines = ['Space: 開始 / 停止', '矢印キー: スリット位置', 'S: 保存', '', 'カメラ映像から幅1pxのスリットだけを毎フレーム取り出し、キャンバスに並べています。映像は端末内のみで処理されます。'];
  lines.forEach((l) => { const p = document.createElement('p'); p.textContent = l; d.appendChild(p); });
  return d;
}
$('btn-help').onclick = () => showOverlay('ショートカット / 仕組み', helpNode());

/* ---------- save ---------- */
function fileName() {
  const d = new Date(), p = (x) => String(x).padStart(2, '0');
  return `slitscan_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}_${cfg.dir}.png`;
}
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
async function saveImage() {
  if (run.state === 'scanning' && cfg.mode === 'strip') finish('frozen');
  if (run.state !== 'done' && run.state !== 'frozen') return false;
  const blob = await new Promise((res) => { try { el.out.toBlob(res, 'image/png'); } catch { res(null); } });
  if (!blob) { toast('保存に失敗しました。ブラウザを変えて再試行してください', true); return false; }
  const name = fileName();
  const file = new File([blob], name, { type: 'image/png' });
  if (isIOS() && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); run.dirty = false; toast('保存しました'); renderUI(); return true; }
    catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  if (isIOS() || !('download' in document.createElement('a'))) {
    const url = URL.createObjectURL(blob);
    const img = new Image(); img.src = url; img.alt = '撮影した画像';
    const box = document.createElement('div');
    const p = document.createElement('p'); p.textContent = '画像を長押しして「写真に追加」または「保存」を選んでください。';
    box.append(p, img);
    showOverlay('画像を保存', box);
    run.dirty = false; renderUI(); return true;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  run.dirty = false; toast(`保存しました: ${name}`); renderUI();
  return true;
}

/* ---------- UI ---------- */
function setCustom() { preset = null; renderUI(); }
const LAMP = { idle: '待機', scanning: '走査中', done: '完了', frozen: '凍結' };
function updateReadouts() {
  const span = isHz() ? run.H : run.W;
  el.roHead.textContent = String(Math.min(run.head, span)).padStart(4, '0');
  el.roTime.innerHTML = '';
  el.roTime.append(run.elapsed.toFixed(1).padStart(4, '0'));
  const s = document.createElement('small'); s.textContent = 's'; el.roTime.append(s);
  positionHead(span);
}
function positionHead(span) {
  const frac = Math.min(1, run.head / span);
  const edge = isFwd() ? frac : 1 - frac;
  el.head.style[isHz() ? 'top' : 'left'] = (edge * 100) + '%';
  el.head.style[isHz() ? 'left' : 'top'] = isHz() ? '0' : '0';
}
function renderUI() {
  const hz = isHz(), st = run.state;
  el.pv.classList.toggle('hz', hz); el.cbox.classList.toggle('hz', hz);
  el.pv.classList.toggle('mir', viewMirror());
  el.cbox.classList.toggle('live', st === 'scanning');
  el.empty.hidden = st !== 'idle';
  el.lamp.dataset.s = st; el.lampText.textContent = LAMP[st];
  // main CTA and save state
  el.main.textContent = st === 'idle' ? '開始' : st === 'scanning' ? (cfg.mode === 'strip' ? '停止' : '中止') : '新規撮影';
  el.save.disabled = !(st === 'done' || st === 'frozen' || (st === 'scanning' && cfg.mode === 'strip'));
  el.pos.value = Math.round(cfg.pos * 100);
  el.roSlit.innerHTML = ''; el.roSlit.append(String(Math.round(cfg.pos * 100)));
  const s2 = document.createElement('small'); s2.textContent = '%'; el.roSlit.append(s2);
  el.vSpeed.textContent = cfg.speed; el.vThick.textContent = cfg.thick;
  el.speed.value = cfg.speed; el.thick.value = cfg.thick;
  el.mirror.setAttribute('aria-pressed', cfg.mirror); el.mirror.textContent = cfg.mirror ? '反転 ON' : '反転 OFF';
  document.querySelectorAll('[data-dir]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.dir === cfg.dir));
  document.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === cfg.mode));
  document.querySelectorAll('[data-preset]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.preset === preset));
  el.presetLabel.textContent = preset ? PRESETS[preset].label : 'カスタム';
  updateSlitLine(); updateReadouts();
}
function updateSlitLine() {
  const disp = cfg.pos * 100 + '%';
  if (isHz()) { el.slitline.style.top = disp; el.slitline.style.left = '0'; }
  else { el.slitline.style.left = disp; el.slitline.style.top = '0'; }
}

el.main.onclick = async () => {
  if (run.state === 'idle') start();
  else if (run.state === 'scanning') { finish('frozen'); if (cfg.mode === 'oneshot') toast('中止しました', true); }
  else if (await guard()) resetToIdle();
};
el.save.onclick = () => saveImage();
el.sheetToggle.onclick = () => {
  const o = el.params.classList.toggle('open');
  el.sheetToggle.setAttribute('aria-expanded', o);
  document.body.classList.toggle('sheet-open', o);
};

document.querySelectorAll('[data-dir]').forEach((b) => (b.onclick = async () => {
  if (b.dataset.dir === cfg.dir) return;
  if (!(await guard())) return;
  cfg.dir = b.dataset.dir; preset = null; resetToIdle();
}));
document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => {
  cfg.mode = b.dataset.mode; setCustom();
  if (run.state === 'scanning' && cfg.mode === 'oneshot' && run.head >= (isHz() ? run.H : run.W)) finish('done');
}));
document.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = async () => {
  if (!(await guard())) return;
  const p = PRESETS[b.dataset.preset];
  Object.assign(cfg, { dir: p.dir, pos: p.pos, speed: p.speed, thick: p.thick, mode: p.mode });
  run.state = 'idle'; run.dirty = false; preset = b.dataset.preset;
  allocCanvas(); start();
}));
el.pos.oninput = () => { cfg.pos = el.pos.value / 100; setCustom(); };
el.speed.oninput = () => { cfg.speed = +el.speed.value; setCustom(); };
el.thick.oninput = () => { cfg.thick = +el.thick.value; setCustom(); };
el.mirror.onclick = () => {
  cfg.mirror = !cfg.mirror; preset = null;
  if (run.state === 'scanning') toast('反転は次の撮影から適用されます', true);
  renderUI();
};

// drag on preview to move slit
let dragging = false;
function dragTo(e) {
  const r = el.pv.getBoundingClientRect();
  const f = isHz() ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
  cfg.pos = Math.min(1, Math.max(0, Math.round(f * 100) / 100));
  preset = null; renderUI();
}
el.pv.addEventListener('pointerdown', (e) => { dragging = true; el.pv.setPointerCapture(e.pointerId); dragTo(e); });
el.pv.addEventListener('pointermove', (e) => { if (dragging) dragTo(e); });
['pointerup', 'pointercancel'].forEach((t) => el.pv.addEventListener(t, () => { dragging = false; }));

// keyboard
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!$('modal').hidden) { if (e.key === 'Escape') answer('cancel'); return; }
  if (!$('overlay').hidden) { if (e.key === 'Escape') $('o-close').click(); return; }
  if (document.querySelector('.gate:not([hidden])')) return;
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'textarea' || (tag === 'input' && e.target.type !== 'range');
  if (typing) return;
  const widget = tag === 'input' || tag === 'button' || tag === 'select' || tag === 'summary';
  const k = e.key;
  if (k === 's' || k === 'S') { e.preventDefault(); if (!el.save.disabled) saveImage(); return; }
  if (widget) return;
  if (k === ' ') { e.preventDefault(); el.main.click(); }
  else if (k.startsWith('Arrow')) {
    e.preventDefault();
    const d = k === 'ArrowLeft' || k === 'ArrowUp' ? -0.01 : 0.01;
    cfg.pos = Math.min(1, Math.max(0, Math.round((cfg.pos + d) * 100) / 100)); setCustom();
  } else if (k === '?') $('btn-help').click();
});

/* ---------- camera ---------- */
const gates = { intro: $('gate-intro'), loading: $('gate-loading'), error: $('gate-error') };
function showGate(name) { Object.entries(gates).forEach(([k, g]) => (g.hidden = k !== name)); }
function showError(err) {
  const n = err && err.name;
  let title = 'カメラを使えません', cause, steps;
  if (err === 'unsupported') {
    cause = 'このブラウザ、またはこの接続(HTTPでの表示など)ではカメラ機能を使えません。';
    steps = '1. HTTPSまたはlocalhostでページを開き直す\n2. Chrome / Safari / Firefox / Edge の最新版で開く';
  } else if (n === 'NotAllowedError' || n === 'SecurityError') {
    title = 'カメラが許可されていません'; cause = 'ブラウザでカメラの使用がブロックされています。';
    steps = '1. アドレスバー左の鍵(またはカメラ)アイコンを開く\n2. カメラを「許可」に変更する\n3. 下の「もう一度試す」を押す(iOSは設定 > Safari > カメラ)';
  } else if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') {
    title = 'カメラが見つかりません'; cause = '使えるカメラが接続されていません。';
    steps = '1. カメラが接続・有効になっているか確認する\n2. 他のアプリがカメラを使用していれば閉じる\n3. 「もう一度試す」を押す';
  } else if (n === 'NotReadableError' || n === 'AbortError') {
    title = 'カメラを起動できません'; cause = '他のアプリがカメラを使用中の可能性があります。';
    steps = '1. ビデオ会議など、カメラを使うアプリを閉じる\n2. 「もう一度試す」を押す';
  } else { cause = 'カメラの起動中に予期しないエラーが起きました。'; steps = '1. ページを再読み込みする\n2. 「もう一度試す」を押す'; }
  $('err-title').textContent = title; $('err-cause').textContent = cause; $('err-steps').textContent = steps;
  showGate('error');
}
async function openCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return showError('unsupported');
  showGate('loading');
  if (stream) stream.getTracks().forEach((t) => t.stop());
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: cfg.facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
    });
    el.video.srcObject = stream;
    await el.video.play().catch(() => {});
    await new Promise((res) => { if (el.video.videoWidth) res(); else el.video.onloadedmetadata = () => res(); });
    el.pv.style.setProperty('--ar', `${el.video.videoWidth}/${el.video.videoHeight}`);
    await refreshDevices();
    showGate(null);
    allocCanvas(); renderUI();
  } catch (e) { stream = null; showError(e); }
}
async function refreshDevices() {
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    el.cam.hidden = list.filter((d) => d.kind === 'videoinput').length < 2;
  } catch { el.cam.hidden = true; }
}
$('btn-allow').onclick = openCamera;
$('btn-retry').onclick = openCamera;
el.cam.onclick = async () => {
  if (!(await guard())) return;
  cfg.facing = cfg.facing === 'user' ? 'environment' : 'user';
  cfg.mirror = cfg.facing === 'user';
  run.state = 'idle'; run.dirty = false;
  await openCamera();
};
navigator.mediaDevices && navigator.mediaDevices.addEventListener &&
  navigator.mediaDevices.addEventListener('devicechange', refreshDevices);

showGate('intro');
allocCanvas(); renderUI();
requestAnimationFrame(loop);
