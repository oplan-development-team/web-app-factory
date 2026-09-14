import '@fontsource/noto-sans-jp/500.css';
import '@fontsource/noto-sans-jp/700.css';
import '@fontsource/noto-sans-jp/900.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';
import './style.css';

import { analyze } from './analysis';
import { buildSegments } from './highlight';
import type { CategoryResult, DiagnosisReport, Finding, Verdict } from './types';
import { CATEGORY_COLORS, CATEGORY_LABELS } from './types';

const VERDICT_CLASS: Record<Verdict, string> = {
  異常なし: 'ok',
  軽度: 'mild',
  要注意: 'warn',
  要精査: 'critical',
};

const app = document.getElementById('app')!;

// ---------------------------------------------------------------------------
// shell
// ---------------------------------------------------------------------------
app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="topbar__brand">
        <span class="topbar__kicker">PROSE HABIT X-RAY</span>
        <h1 class="topbar__title">文章クセのカルテ</h1>
      </div>
      <div class="topbar__actions" id="topbarActions"></div>
    </header>
    <main class="stage" id="stage"></main>
    <footer class="footer">
      本ツールの解析はすべて正規表現・文字列処理によるルールベースの簡易診断であり、形態素解析等の厳密な文法判定は行っていません。誤検出があり得ます。入力テキストは外部送信されず、この端末内のメモリ上でのみ処理されます。
    </footer>
  </div>
`;

const stage = document.getElementById('stage')!;
const topbarActions = document.getElementById('topbarActions')!;

let lastText = '';

renderIntake();

// ---------------------------------------------------------------------------
// intake view
// ---------------------------------------------------------------------------
function renderIntake(): void {
  topbarActions.innerHTML = '';
  stage.innerHTML = `
    <section class="intake">
      <div class="intake__panel">
        <label class="intake__label" for="inputText">日本語の文章を貼り付けてください</label>
        <textarea
          id="inputText"
          class="intake__textarea"
          placeholder="診断したい日本語の文章をここに貼り付けてください。数文以上あると診断精度が上がります。"
          spellcheck="false"
        ></textarea>
        <div class="intake__row">
          <p class="intake__hint">
            句点（。／！／？）を基準にした簡易的な文分割で解析します。鍵括弧内の句点などでも分割されてしまう場合がある、ルールベースの割り切り仕様です。解析はこの端末内で完結し、外部には一切送信されません。
          </p>
          <button id="diagnoseBtn" class="btn btn--primary" disabled>診断する</button>
        </div>
        <p id="intakeError" class="intake__error" role="alert" hidden></p>
      </div>
    </section>
  `;

  const textarea = document.getElementById('inputText') as HTMLTextAreaElement;
  const diagnoseBtn = document.getElementById('diagnoseBtn') as HTMLButtonElement;
  const errorEl = document.getElementById('intakeError') as HTMLParagraphElement;

  textarea.value = lastText;
  diagnoseBtn.disabled = textarea.value.trim().length === 0;

  textarea.addEventListener('input', () => {
    diagnoseBtn.disabled = textarea.value.trim().length === 0;
    if (!errorEl.hidden) errorEl.hidden = true;
  });

  diagnoseBtn.addEventListener('click', () => {
    const text = textarea.value;
    if (text.trim().length === 0) {
      showIntakeError(errorEl, '診断するテキストを入力してください。');
      return;
    }
    const report = analyze(text);
    if (report.sentenceCount === 0) {
      showIntakeError(
        errorEl,
        '句点（。／！／？）で区切られた文が見つかりませんでした。文章を見直してください。',
      );
      return;
    }
    if (report.sentenceCount === 1) {
      showIntakeError(
        errorEl,
        '文が1文しかないため、連続使用やばらつきといった指標を診断できません。数文以上の文章を貼り付けてください。',
      );
      return;
    }
    lastText = text;
    renderChart(report);
  });

  textarea.focus();
}

function showIntakeError(el: HTMLParagraphElement, message: string): void {
  el.textContent = message;
  el.hidden = false;
}

// ---------------------------------------------------------------------------
// chart (result) view
// ---------------------------------------------------------------------------
function renderChart(report: DiagnosisReport): void {
  topbarActions.innerHTML = '';
  const resetBtnTop = document.createElement('button');
  resetBtnTop.className = 'btn btn--ghost';
  resetBtnTop.textContent = '別のテキストを診断する';
  resetBtnTop.addEventListener('click', () => renderIntake());
  topbarActions.appendChild(resetBtnTop);

  stage.innerHTML = `
    <section class="chart">
      <div class="chart__summary">
        <div class="grade-badge grade-badge--${report.grade}">
          <span class="grade-badge__label">総合判定</span>
          <span class="grade-badge__letter">${report.grade}</span>
          <span class="grade-badge__score">SCORE ${report.totalScore}/${report.maxScore}</span>
        </div>
        <div class="chart__meta">
          <p class="chart__type">診断タイプ：<strong id="diagType"></strong></p>
          <dl class="chart__stats">
            <div><dt>文字数</dt><dd>${report.charCount}</dd></div>
            <div><dt>文数</dt><dd>${report.sentenceCount}</dd></div>
            <div><dt>平均文長</dt><dd>${(report.charCount / report.sentenceCount).toFixed(1)}字</dd></div>
          </dl>
        </div>
      </div>
      <div class="chart__body">
        <div class="chart__original">
          <div class="chart__original-head">
            <span>原文フィルム</span>
            <span class="chart__original-note">6項目の所見を常時ハイライト表示中</span>
          </div>
          <div class="chart__original-scroll" id="originalScroll">
            <div class="chart__original-text" id="originalText"></div>
          </div>
        </div>
        <div class="chart__cards" id="cardsList"></div>
      </div>
    </section>
  `;

  (document.getElementById('diagType') as HTMLElement).textContent = report.diagnosisType;

  const allFindings: Finding[] = report.categories.flatMap((c) => c.findings);
  renderOriginalText(report.text, allFindings);
  renderCards(report.categories);

  wireBidirectional();
}

function renderOriginalText(text: string, findings: Finding[]): void {
  const container = document.getElementById('originalText')!;
  container.innerHTML = '';
  const segments = buildSegments(text, findings);

  segments.forEach((seg) => {
    const slice = text.slice(seg.start, seg.end);
    if (seg.categories.length === 0) {
      container.appendChild(document.createTextNode(slice));
      return;
    }
    const span = document.createElement('span');
    span.className = 'hl';
    span.dataset.findings = seg.findingIds.join(',');
    span.dataset.categories = seg.categories.join(',');
    const shadows = seg.categories
      .map((c, i) => `inset 0 -${3 + i * 3}px 0 0 ${CATEGORY_COLORS[c]}`)
      .join(', ');
    span.style.boxShadow = shadows;
    span.style.background = `${CATEGORY_COLORS[seg.categories[0]]}22`;
    span.textContent = slice;
    container.appendChild(span);
  });
}

function renderCards(categories: CategoryResult[]): void {
  const list = document.getElementById('cardsList')!;
  list.innerHTML = '';

  categories.forEach((cat) => {
    const card = document.createElement('article');
    card.className = `card card--${VERDICT_CLASS[cat.verdict]}`;
    card.dataset.category = cat.key;

    const head = document.createElement('header');
    head.className = 'card__head';

    const chip = document.createElement('span');
    chip.className = 'card__chip';
    chip.style.background = CATEGORY_COLORS[cat.key];
    chip.style.color = CATEGORY_COLORS[cat.key];
    head.appendChild(chip);

    const title = document.createElement('h2');
    title.className = 'card__title';
    title.textContent = CATEGORY_LABELS[cat.key];
    head.appendChild(title);

    const verdictTag = document.createElement('span');
    verdictTag.className = `card__verdict card__verdict--${VERDICT_CLASS[cat.verdict]}`;
    verdictTag.textContent = cat.verdict;
    head.appendChild(verdictTag);

    card.appendChild(head);

    const summary = document.createElement('p');
    summary.className = 'card__summary';
    summary.textContent = cat.summary;
    card.appendChild(summary);

    const metrics = document.createElement('dl');
    metrics.className = 'card__metrics';
    cat.metrics.forEach((m) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = m.label;
      const dd = document.createElement('dd');
      dd.textContent = m.value;
      row.appendChild(dt);
      row.appendChild(dd);
      metrics.appendChild(row);
    });
    card.appendChild(metrics);

    if (cat.histogram) {
      const maxCount = Math.max(1, ...cat.histogram.map((h) => h.count));
      const hist = document.createElement('div');
      hist.className = 'histogram';
      cat.histogram.forEach((h) => {
        const bar = document.createElement('div');
        bar.className = 'histogram__bar';
        const countEl = document.createElement('span');
        countEl.className = 'histogram__count';
        countEl.textContent = String(h.count);
        const track = document.createElement('div');
        track.className = 'histogram__track';
        const fill = document.createElement('div');
        fill.className = 'histogram__fill';
        fill.style.height = `${(h.count / maxCount) * 100}%`;
        track.appendChild(fill);
        const label = document.createElement('span');
        label.className = 'histogram__label';
        label.textContent = h.label;
        bar.appendChild(countEl);
        bar.appendChild(track);
        bar.appendChild(label);
        hist.appendChild(bar);
      });
      card.appendChild(hist);
    }

    if (cat.findings.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'card__empty';
      empty.textContent = '該当箇所はありません。';
      card.appendChild(empty);
    } else {
      const ul = document.createElement('ul');
      ul.className = 'card__findings';
      cat.findings.forEach((f) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.className = 'finding-btn';
        btn.type = 'button';
        btn.dataset.findingId = f.id;
        btn.style.setProperty('--finding-color', CATEGORY_COLORS[f.category]);

        const excerpt = document.createElement('span');
        excerpt.className = 'finding-btn__excerpt';
        excerpt.textContent = f.excerpt;
        const note = document.createElement('span');
        note.className = 'finding-btn__note';
        note.textContent = f.note;

        btn.appendChild(excerpt);
        btn.appendChild(note);
        li.appendChild(btn);
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }

    list.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// bidirectional link: card <-> original text
// ---------------------------------------------------------------------------
function wireBidirectional(): void {
  const cardsList = document.getElementById('cardsList')!;
  const originalText = document.getElementById('originalText')!;

  cardsList.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.finding-btn');
    if (!btn || !btn.dataset.findingId) return;
    focusFinding(btn.dataset.findingId, { scrollOriginal: true, scrollCard: false });
  });

  originalText.addEventListener('click', (e) => {
    const span = (e.target as HTMLElement).closest<HTMLSpanElement>('.hl');
    if (!span || !span.dataset.findings) return;
    const firstId = span.dataset.findings.split(',')[0];
    if (!firstId) return;
    focusFinding(firstId, { scrollOriginal: false, scrollCard: true });
  });
}

function focusFinding(
  findingId: string,
  opts: { scrollOriginal: boolean; scrollCard: boolean },
): void {
  document.querySelectorAll('.hl-focus').forEach((elz) => elz.classList.remove('hl-focus'));
  document
    .querySelectorAll('.finding-btn--active')
    .forEach((elz) => elz.classList.remove('finding-btn--active'));

  // data-findings holds a comma-separated id list, so matching is done manually
  // rather than via an attribute selector (which only supports whitespace tokens).
  const matchingSpans = Array.from(document.querySelectorAll<HTMLSpanElement>('.hl')).filter(
    (s) => (s.dataset.findings || '').split(',').includes(findingId),
  );
  matchingSpans.forEach((s) => s.classList.add('hl-focus'));

  const btn = document.querySelector<HTMLButtonElement>(
    `.finding-btn[data-finding-id="${cssEscapeAttr(findingId)}"]`,
  );
  if (btn) btn.classList.add('finding-btn--active');

  if (opts.scrollOriginal && matchingSpans[0]) {
    matchingSpans[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (opts.scrollCard && btn) {
    btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function cssEscapeAttr(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}
