import './style.css';
import { tokenize } from './diff/tokenize';
import { myersDiff } from './diff/myers';
import { buildSegments } from './diff/classify';
import type { Segment, TokenizeMode } from './diff/types';
import { renderManuscript } from './render/manuscript';
import { layoutMarks } from './render/marks';
import { exportManuscriptPNG } from './export/pngExport';
import { SAMPLE_AFTER, SAMPLE_BEFORE } from './sample';

const app = document.getElementById('app');
if (!app) throw new Error('root element #app not found');

app.innerHTML = `
  <div class="page">
    <header class="masthead">
      <div class="masthead-top">
        <span class="kicker">PROOFMARK DIFF / 校正記号diffビューア</span>
        <span class="badge">app-factory 自律生成プロトタイプ</span>
      </div>
      <h1 class="title">校正記号diffビューア</h1>
      <p class="lede">
        改稿前後の原稿を並べると、色分けハイライトの代わりに、紙の校正で使われてきた朱色の記号——
        トルツメ・キャレット・ルビ訂正・移動矢印——で赤入れした一枚の校正刷りを作ります。
      </p>
    </header>

    <main class="layout">
      <section class="workspace">
        <div class="input-row">
          <div class="slip" data-role="before">
            <label class="slip-label" for="beforeText"><span class="dot"></span>改稿前</label>
            <textarea id="beforeText" spellcheck="false" placeholder="ここに改稿前の原稿を貼り付け、または直接入力してください。"></textarea>
          </div>
          <div class="slip" data-role="after">
            <label class="slip-label" for="afterText"><span class="dot"></span>改稿後</label>
            <textarea id="afterText" spellcheck="false" placeholder="ここに改稿後の原稿を貼り付け、または直接入力してください。"></textarea>
          </div>
        </div>

        <div class="controls">
          <button id="sampleBtn" class="btn btn-ghost" type="button">サンプル原稿を読み込む</button>

          <div class="granularity-toggle" role="radiogroup" aria-label="差分の粒度">
            <button class="toggle-opt is-active" data-mode="char" type="button" aria-pressed="true">文字単位</button>
            <button class="toggle-opt" data-mode="word" type="button" aria-pressed="false">単語単位</button>
          </div>

          <button id="diffBtn" class="btn btn-primary" type="button">校正刷りを作成</button>
          <button id="exportBtn" class="btn btn-ghost" type="button" disabled>PNGで保存</button>
        </div>

        <p class="form-error" id="formError" hidden></p>

        <div class="result-wrap">
          <div class="result-heading">
            <span class="dot"></span>校正刷り
            <span class="result-meta" id="resultMeta"></span>
          </div>
          <div class="manuscript-sheet" id="manuscriptSheet">
            <p class="manuscript-empty" id="manuscriptEmpty">
              まだ校正刷りがありません。改稿前・改稿後を入力し「校正刷りを作成」を押してください。
            </p>
            <div class="manuscript-text" id="manuscriptText" hidden></div>
            <svg class="marks-overlay" id="marksOverlay" aria-hidden="true"></svg>
            <div class="annotation-layer" id="annotationLayer" aria-hidden="true"></div>
            <div class="manuscript-loading" id="manuscriptLoading" hidden>
              <span class="spinner" aria-hidden="true"></span>校正中…
            </div>
          </div>
        </div>
      </section>

      <aside class="legend-pane">
        <div class="legend-card">
          <div class="legend-title">校正記号の凡例</div>
          <ul class="legend-list">
            <li class="legend-item">
              <svg class="legend-glyph" viewBox="0 0 40 30" aria-hidden="true">
                <path d="M4 15 Q 14 13 20 15 T 34 15" class="lg-strike"/>
                <path d="M27 10 C 28 5 35 4 36 9 C 37 14 30 16 27 13 C 25 11 29 8 32 9" class="lg-loop"/>
              </svg>
              <div class="legend-text">
                <span class="legend-label">削除（トルツメ）</span>
                <span class="legend-desc">取り消し線とループ記号で、その一節が丸ごと取れることを示します。</span>
              </div>
            </li>
            <li class="legend-item">
              <svg class="legend-glyph" viewBox="0 0 40 30" aria-hidden="true">
                <path d="M14 22 L20 10 L26 22" class="lg-caret"/>
              </svg>
              <div class="legend-text">
                <span class="legend-label">挿入（キャレット）</span>
                <span class="legend-desc">∧ の位置に、上の手書き注記の語句を差し込むことを示します。</span>
              </div>
            </li>
            <li class="legend-item">
              <svg class="legend-glyph" viewBox="0 0 40 30" aria-hidden="true">
                <path d="M4 17 Q 14 15 20 17 T 34 17" class="lg-strike"/>
                <text x="20" y="9" text-anchor="middle" class="lg-ruby">語</text>
              </svg>
              <div class="legend-text">
                <span class="legend-label">置換（ルビ訂正）</span>
                <span class="legend-desc">取り消し線の直上に、訂正後の語句を朱色の手書き文字で添えます。</span>
              </div>
            </li>
            <li class="legend-item">
              <svg class="legend-glyph" viewBox="0 0 40 30" aria-hidden="true">
                <ellipse cx="9" cy="10" rx="7" ry="5" class="lg-lasso"/>
                <ellipse cx="31" cy="20" rx="7" ry="5" class="lg-lasso"/>
                <path d="M15 12 Q 22 4 26 17" class="lg-arrow" marker-end="url(#legendArrow)"/>
              </svg>
              <div class="legend-text">
                <span class="legend-label">移動</span>
                <span class="legend-desc">丸で囲んだ二箇所を、揺らぎのある矢印で結び、文の移動先を示します。</span>
              </div>
            </li>
          </ul>
        </div>
        <p class="legend-note">すべての処理はブラウザ内で完結し、入力テキストは送信・保存されません。</p>
      </aside>
    </main>

    <svg width="0" height="0" style="position:absolute">
      <defs>
        <marker id="legendArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 L 3 5 Z" fill="var(--vermillion)" />
        </marker>
      </defs>
    </svg>
  </div>
`;

const beforeText = document.getElementById('beforeText') as HTMLTextAreaElement;
const afterText = document.getElementById('afterText') as HTMLTextAreaElement;
const sampleBtn = document.getElementById('sampleBtn') as HTMLButtonElement;
const diffBtn = document.getElementById('diffBtn') as HTMLButtonElement;
const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
const formError = document.getElementById('formError') as HTMLParagraphElement;
const resultMeta = document.getElementById('resultMeta') as HTMLSpanElement;
const manuscriptSheet = document.getElementById('manuscriptSheet') as HTMLDivElement;
const manuscriptEmpty = document.getElementById('manuscriptEmpty') as HTMLParagraphElement;
const manuscriptText = document.getElementById('manuscriptText') as HTMLDivElement;
const marksOverlay = document.getElementById('marksOverlay') as unknown as SVGSVGElement;
const annotationLayer = document.getElementById('annotationLayer') as HTMLDivElement;
const manuscriptLoading = document.getElementById('manuscriptLoading') as HTMLDivElement;
const toggleButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.toggle-opt'));

let mode: TokenizeMode = 'char';
let currentSegments: Segment[] = [];
let currentAnchors: Map<string, HTMLElement> = new Map();
let hasResult = false;

sampleBtn.addEventListener('click', () => {
  beforeText.value = SAMPLE_BEFORE;
  afterText.value = SAMPLE_AFTER;
  hideError();
});

toggleButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    mode = (btn.dataset.mode as TokenizeMode) ?? 'char';
    toggleButtons.forEach((b) => {
      const active = b === btn;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  });
});

function showError(message: string) {
  formError.textContent = message;
  formError.hidden = false;
}

function hideError() {
  formError.hidden = true;
  formError.textContent = '';
}

function describeCounts(segments: Segment[]): string {
  const counts = { delete: 0, insert: 0, replace: 0, move: 0 };
  const seenMoves = new Set<string>();
  for (const seg of segments) {
    if (seg.kind === 'delete') counts.delete += 1;
    else if (seg.kind === 'insert') counts.insert += 1;
    else if (seg.kind === 'replace') counts.replace += 1;
    else if (seg.kind === 'move-out' && seg.moveId && !seenMoves.has(seg.moveId)) {
      seenMoves.add(seg.moveId);
      counts.move += 1;
    }
  }
  const hasAnyChange = counts.delete + counts.insert + counts.replace + counts.move > 0;
  if (!hasAnyChange) return '差分なし・改稿前後は同一です';
  return `削除 ${counts.delete} / 挿入 ${counts.insert} / 置換 ${counts.replace} / 移動 ${counts.move}`;
}

function runDiff() {
  const before = beforeText.value;
  const after = afterText.value;

  if (before.trim().length === 0 && after.trim().length === 0) {
    showError('改稿前・改稿後の少なくとも一方にテキストを入力してください。');
    return;
  }
  hideError();

  manuscriptLoading.hidden = false;
  manuscriptEmpty.hidden = true;
  diffBtn.disabled = true;

  // Let the loading state paint before running the (synchronous) diff so
  // the UI never appears to freeze on larger inputs.
  window.setTimeout(() => {
    try {
      const aTokens = tokenize(before, mode);
      const bTokens = tokenize(after, mode);
      const ops = myersDiff(aTokens, bTokens);
      const segments = buildSegments(ops);

      currentSegments = segments;
      currentAnchors = renderManuscript(manuscriptText, segments);
      manuscriptText.hidden = false;

      manuscriptText.classList.remove('is-revealed');
      // force reflow so the reveal transition restarts on every generation
      void manuscriptText.offsetWidth;
      manuscriptText.classList.add('is-revealed');

      layoutMarks({ wrapper: manuscriptSheet, svg: marksOverlay, annotationLayer }, segments, currentAnchors, true);

      resultMeta.textContent = describeCounts(segments);
      exportBtn.disabled = false;
      hasResult = true;
    } catch (err) {
      console.error(err);
      manuscriptText.hidden = true;
      manuscriptEmpty.hidden = false;
      manuscriptEmpty.textContent = '校正刷りの生成中にエラーが発生しました。テキストを見直して再度お試しください。';
      exportBtn.disabled = true;
      hasResult = false;
    } finally {
      manuscriptLoading.hidden = true;
      diffBtn.disabled = false;
    }
  }, 30);
}

diffBtn.addEventListener('click', runDiff);

exportBtn.addEventListener('click', async () => {
  if (!hasResult || currentSegments.length === 0) return;
  const originalLabel = exportBtn.textContent;
  exportBtn.disabled = true;
  exportBtn.textContent = '書き出し中…';
  try {
    const width = Math.round(manuscriptSheet.getBoundingClientRect().width) || 900;
    const filename = `proofmark-diff-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    await exportManuscriptPNG(currentSegments, width, filename);
    exportBtn.textContent = '保存しました';
  } catch (err) {
    console.error(err);
    exportBtn.textContent = '保存に失敗しました';
  } finally {
    window.setTimeout(() => {
      exportBtn.textContent = originalLabel;
      exportBtn.disabled = false;
    }, 1600);
  }
});

const resizeObserver = new ResizeObserver(() => {
  if (!hasResult || currentAnchors.size === 0) return;
  layoutMarks({ wrapper: manuscriptSheet, svg: marksOverlay, annotationLayer }, currentSegments, currentAnchors, false);
});
resizeObserver.observe(manuscriptSheet);
window.addEventListener('resize', () => {
  if (!hasResult || currentAnchors.size === 0) return;
  layoutMarks({ wrapper: manuscriptSheet, svg: marksOverlay, annotationLayer }, currentSegments, currentAnchors, false);
});
