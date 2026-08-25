import type { Fragment, Poem } from './types';

/** Static chassis chrome — no user data is ever interpolated into this
 * string, so it's safe as an innerHTML template. Pasted text is always
 * inserted separately via textContent (see appendFragmentEntry / appendPoemStamp). */
export const CHASSIS_MARKUP = `
  <div class="chassis">
    <div class="chassis__brandplate">
      <div class="brandplate__title">CLIPBOARD POET</div>
      <div class="brandplate__model">MODEL PB-90 &middot; FOUND-VERSE THERMAL UNIT</div>
      <div class="brandplate__privacy">この端末は貼り付け内容を保存・送信しません &mdash; NO STORE / NO TRANSMIT / SESSION ONLY</div>
    </div>

    <div class="chassis__controls">
      <div class="led-unit">
        <div class="led-unit__label">PASTE COUNTER</div>
        <div class="led-screen" id="led-screen">
          <div class="led-screen__digits" id="led-digits">00</div>
          <div class="led-screen__status" id="led-status">PASTE TO BEGIN</div>
        </div>
      </div>

      <div class="switch-bank" role="group" aria-label="組版ルールの切り替え">
        <button type="button" class="toggle-switch toggle-switch--amber" id="toggle-lineBreak" aria-pressed="true">
          <span class="toggle-switch__led" aria-hidden="true"></span>
          <span class="toggle-switch__track" aria-hidden="true"><span class="toggle-switch__nub"></span></span>
          <span class="toggle-switch__label">LINE BREAK<br /><span class="toggle-switch__label-jp">行分割</span></span>
        </button>
        <button type="button" class="toggle-switch toggle-switch--amber" id="toggle-trim" aria-pressed="true">
          <span class="toggle-switch__led" aria-hidden="true"></span>
          <span class="toggle-switch__track" aria-hidden="true"><span class="toggle-switch__nub"></span></span>
          <span class="toggle-switch__label">TRIM<br /><span class="toggle-switch__label-jp">トリミング</span></span>
        </button>
        <button type="button" class="toggle-switch toggle-switch--green" id="toggle-shuffle" aria-pressed="true">
          <span class="toggle-switch__led" aria-hidden="true"></span>
          <span class="toggle-switch__track" aria-hidden="true"><span class="toggle-switch__nub"></span></span>
          <span class="toggle-switch__label">SHUFFLE<br /><span class="toggle-switch__label-jp">シャッフル</span></span>
        </button>
      </div>
    </div>

    <div class="chassis__action">
      <button type="button" class="aux-button" id="cut-button" disabled>
        &#9986; オールカット<br /><span class="aux-button__sub">CUT &amp; CLEAR</span>
      </button>
      <button type="button" class="print-button" id="print-button" disabled aria-label="詩を刷る">
        <span class="print-button__face">詩を刷る<span class="print-button__sub">PRINT POEM</span></span>
      </button>
    </div>
    <div class="chassis__slot" aria-hidden="true"></div>
  </div>

  <div class="paper-feed" id="paper-feed">
    <div class="paper-feed__tear" aria-hidden="true"></div>
    <div class="paper-feed__content" id="paper-content">
      <p class="paper-empty" id="paper-empty">紙はまだ送られていません<br />PASTE (CTRL/CMD+V) SOMETHING TO BEGIN PRINTING</p>
    </div>
  </div>
`;

export function charCountLabel(fragment: Fragment): string {
  return `${fragment.fullText.length} CH`;
}

export function appendFragmentEntry(
  container: HTMLElement,
  fragment: Fragment,
  index: number,
): { textEl: HTMLElement; onDone: () => void } {
  const entry = document.createElement('div');
  entry.className = 'receipt-entry';

  const meta = document.createElement('div');
  meta.className = 'receipt-entry__meta';
  meta.textContent = `FRAGMENT #${String(index).padStart(2, '0')} · ${charCountLabel(fragment)}`;
  entry.appendChild(meta);

  const textEl = document.createElement('div');
  textEl.className = 'receipt-entry__text is-printing';
  entry.appendChild(textEl);

  container.appendChild(entry);

  const onDone = () => {
    textEl.classList.remove('is-printing');
    if (fragment.truncated) {
      const note = document.createElement('div');
      note.className = 'receipt-entry__note';
      note.textContent = '※ 紙送り制限のため一部のみ印字（詩の生成には全文を使用）';
      entry.appendChild(note);
    }
    const perf = document.createElement('div');
    perf.className = 'perforation';
    container.appendChild(perf);
  };

  return { textEl, onDone };
}

export function appendPoemStamp(
  container: HTMLElement,
  poem: Poem,
  callbacks: { onCopy: () => void; onPng: () => void },
): HTMLElement {
  const stamp = document.createElement('div');
  stamp.className = 'poem-stamp';

  const header = document.createElement('div');
  header.className = 'poem-stamp__header';
  header.textContent = `◆ FOUND POEM No.${String(poem.id).padStart(2, '0')} ◆`;
  stamp.appendChild(header);

  const body = document.createElement('div');
  body.className = 'poem-stamp__body';
  poem.lines.forEach((line, i) => {
    const lineEl = document.createElement('div');
    lineEl.className = line === '' ? 'poem-stamp__line is-blank' : 'poem-stamp__line';
    lineEl.style.animationDelay = `${Math.min(i * 45, 900)}ms`;
    if (line !== '') lineEl.textContent = line;
    body.appendChild(lineEl);
  });
  stamp.appendChild(body);

  const toolbar = document.createElement('div');
  toolbar.className = 'poem-stamp__toolbar';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'コピー / COPY';
  copyBtn.addEventListener('click', () => {
    callbacks.onCopy();
    const original = copyBtn.textContent;
    copyBtn.textContent = 'COPIED ✓';
    window.setTimeout(() => {
      copyBtn.textContent = original;
    }, 1400);
  });
  toolbar.appendChild(copyBtn);

  const pngBtn = document.createElement('button');
  pngBtn.type = 'button';
  pngBtn.textContent = '切り取る / PNG';
  pngBtn.addEventListener('click', () => {
    callbacks.onPng();
  });
  toolbar.appendChild(pngBtn);

  stamp.appendChild(toolbar);
  container.appendChild(stamp);

  const perf = document.createElement('div');
  perf.className = 'perforation';
  container.appendChild(perf);

  return stamp;
}

/** Reveals text a few characters at a time to read as a dot-matrix print
 * head sweeping across the receipt, regardless of fragment length. */
export function typewriterReveal(el: HTMLElement, text: string): Promise<void> {
  return new Promise((resolve) => {
    const chars = Array.from(text);
    if (chars.length === 0) {
      resolve();
      return;
    }
    const perFrame = Math.max(1, Math.ceil(chars.length / 50));
    let i = 0;
    const step = () => {
      i = Math.min(chars.length, i + perFrame);
      el.textContent = chars.slice(0, i).join('');
      if (i < chars.length) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}
