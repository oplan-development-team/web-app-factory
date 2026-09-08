import type { ToolId } from '../store';
import { store } from '../store';
import { el, svgEl } from './dom';

const TOOL_META: Record<ToolId, { label: string; hint: string; icon: () => SVGSVGElement }> = {
  triangle: { label: '三角ノッチ', hint: '辺または内部に配置', icon: iconTriangle },
  semicircle: { label: '半円', hint: '辺=スクープ／内部=丸穴', icon: iconSemicircle },
  wave: { label: '波線', hint: '辺をドラッグして範囲指定', icon: iconWave },
  notch: { label: 'ノッチ', hint: '辺をクリックで連打配置', icon: iconNotch },
};

function iconBase(children: SVGElement[]): SVGSVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 28 28', width: '22', height: '22', fill: 'none' });
  for (const c of children) svg.append(c);
  return svg;
}

function iconTriangle(): SVGSVGElement {
  const p = svgEl('path', { d: 'M5 21 L14 6 L23 21 Z', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linejoin': 'round' });
  return iconBase([p]);
}
function iconSemicircle(): SVGSVGElement {
  const p = svgEl('path', { d: 'M5 20 a9 9 0 0 1 18 0', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'none' });
  const l = svgEl('line', { x1: '5', y1: '20', x2: '23', y2: '20', stroke: 'currentColor', 'stroke-width': '1.6' });
  return iconBase([p, l]);
}
function iconWave(): SVGSVGElement {
  const p = svgEl('path', { d: 'M3 14 q3 -6 6 0 t6 0 t6 0 t6 0', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'none' });
  return iconBase([p]);
}
function iconNotch(): SVGSVGElement {
  const p = svgEl('path', { d: 'M4 20 H11 L14 13 L17 20 H24', stroke: 'currentColor', 'stroke-width': '1.6', fill: 'none', 'stroke-linejoin': 'round' });
  return iconBase([p]);
}

export function mountToolbar(container: HTMLElement): { refresh: () => void } {
  const toolRow = el('div', { class: 'tool-row', role: 'radiogroup', 'aria-label': 'ツール' });
  const optionsBox = el('div', { class: 'tool-options' });
  container.append(toolRow, optionsBox);

  let dragging = false;

  function numberField(label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void): HTMLElement {
    const input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), class: 'field-range' }) as HTMLInputElement;
    const out = el('span', { class: 'field-value' }, [String(value)]);
    input.addEventListener('pointerdown', () => {
      dragging = true;
    });
    input.addEventListener('input', () => {
      out.textContent = input.value;
      onChange(Number(input.value));
    });
    input.addEventListener('change', () => {
      dragging = false;
    });
    return el('label', { class: 'field' }, [el('span', { class: 'field-label' }, [label]), input, out]);
  }

  function renderTools() {
    toolRow.replaceChildren();
    (Object.keys(TOOL_META) as ToolId[]).forEach((tool) => {
      const meta = TOOL_META[tool];
      const btn = el('button', {
        class: `tool-btn ${store.activeTool === tool ? 'tool-btn--active' : ''}`,
        type: 'button',
        title: meta.hint,
        'aria-pressed': String(store.activeTool === tool),
      }, [meta.icon(), el('span', { class: 'tool-btn__label' }, [meta.label])]);
      btn.addEventListener('click', () => {
        store.setTool(tool);
      });
      toolRow.append(btn);
    });
  }

  function renderOptions() {
    optionsBox.replaceChildren();
    const tool = store.activeTool;
    if (!tool) return;
    const s = store.toolSettings;
    optionsBox.append(el('p', { class: 'tool-options__hint' }, [TOOL_META[tool].hint]));

    if (tool === 'triangle') {
      optionsBox.append(
        numberField('幅', s.triangleWidth, 10, 60, 1, (v) => store.setToolSettings({ triangleWidth: v })),
        numberField('深さ', s.triangleDepth, 6, 60, 1, (v) => store.setToolSettings({ triangleDepth: v })),
      );
    } else if (tool === 'semicircle') {
      optionsBox.append(numberField('半径', s.semicircleRadius, 6, 45, 1, (v) => store.setToolSettings({ semicircleRadius: v })));
    } else if (tool === 'wave') {
      optionsBox.append(
        numberField('振幅', s.waveAmplitude, 2, 20, 1, (v) => store.setToolSettings({ waveAmplitude: v })),
        numberField('繰り返し数', s.waveCount, 2, 12, 1, (v) => store.setToolSettings({ waveCount: v })),
      );
    } else if (tool === 'notch') {
      const sizeRow = el('div', { class: 'size-row' });
      (['small', 'medium', 'large'] as const).forEach((size) => {
        const label = size === 'small' ? '小' : size === 'medium' ? '中' : '大';
        const b = el('button', { class: `size-btn ${s.notchSize === size ? 'size-btn--active' : ''}`, type: 'button' }, [label]);
        b.addEventListener('click', () => store.setToolSettings({ notchSize: size }));
        sizeRow.append(b);
      });
      optionsBox.append(el('div', { class: 'field' }, [el('span', { class: 'field-label' }, ['サイズ']), sizeRow]));
    }
  }

  function refresh() {
    if (dragging) return;
    renderTools();
    renderOptions();
  }

  store.subscribe(refresh);
  refresh();
  return { refresh };
}
