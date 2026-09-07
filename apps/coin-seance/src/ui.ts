import type { LogEntry, Settings } from './types';

interface SliderDef {
  key: keyof Settings;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDERS: SliderDef[] = [
  {
    key: 'idleSeconds',
    label: 'アイドル判定時間',
    min: 1,
    max: 6,
    step: 0.5,
    format: (v) => `${v.toFixed(1)}秒`,
  },
  {
    key: 'driftSpeed',
    label: 'ドリフト速度',
    min: 0.1,
    max: 1,
    step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'driftStrength',
    label: 'ドリフト強度',
    min: 60,
    max: 500,
    step: 10,
    format: (v) => v.toFixed(0),
  },
  {
    key: 'attractionRadius',
    label: '吸引半径',
    min: 80,
    max: 320,
    step: 10,
    format: (v) => `${v.toFixed(0)}`,
  },
  {
    key: 'attractionStrength',
    label: '吸引強度',
    min: 100,
    max: 1000,
    step: 20,
    format: (v) => v.toFixed(0),
  },
];

export function buildSettingsPanel(container: HTMLElement, settings: Settings, onChange: () => void): void {
  container.innerHTML = `
    <h2>設定</h2>
    <p class="panel-note">数値はセッション中いつでも調整できます。ブラウザのメモリ上のみで保持され、リロードで初期値に戻ります。</p>
    <div class="fields"></div>
  `;
  const fields = container.querySelector('.fields')!;

  for (const def of SLIDERS) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    wrap.innerHTML = `
      <div class="field-label"><span>${def.label}</span><span class="value">${def.format(settings[def.key])}</span></div>
      <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${settings[def.key]}" />
    `;
    const input = wrap.querySelector('input') as HTMLInputElement;
    const valueEl = wrap.querySelector('.value') as HTMLElement;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      settings[def.key] = v;
      valueEl.textContent = def.format(v);
      onChange();
    });
    fields.appendChild(wrap);
  }
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function renderLogList(container: HTMLElement, entries: LogEntry[]): void {
  if (entries.length === 0) {
    container.innerHTML = '<p class="log-empty">まだ記録はありません。セッションを終えると、質問と着地シーケンスがここに時系列で残ります。</p>';
    return;
  }

  const items = entries
    .slice()
    .reverse()
    .map((entry) => {
      const durationSec = Math.max(0, Math.round((entry.endedAt - entry.startedAt) / 1000));
      const question = escapeHtml(entry.question || '（無題の問い）');
      const sequence = escapeHtml(entry.sequence || '（無回答）');
      return `
        <li class="log-item">
          <p class="log-question">${question}</p>
          <p class="log-sequence">${sequence}</p>
          <div class="log-meta">
            <span>${formatTimestamp(entry.endedAt)}</span>
            <span>所要 ${durationSec}秒</span>
            <span>試行 ${entry.attempts}回</span>
          </div>
        </li>
      `;
    })
    .join('');

  container.innerHTML = `<ul class="log-list">${items}</ul>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
