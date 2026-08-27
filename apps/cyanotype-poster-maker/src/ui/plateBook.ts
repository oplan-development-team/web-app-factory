import { SPECIMENS } from '../specimens';
import { renderSpecimenSwatch } from '../core/swatch';
import { getInkPreset } from '../core/presets';

export const THUMB_WIDTH = 116;
export const THUMB_HEIGHT = 146;

export interface PlateBookOptions {
  container: HTMLElement;
  onSelect: (specimenId: string) => void;
  /** 標本ごとの現在のシード。選択中の個体をサムネイルへ反映するのに使う（FR-126） */
  seedFor: (specimenId: string) => number;
  inkPresetId: () => string;
}

interface PlateEntry {
  id: string;
  input: HTMLInputElement;
  canvas: HTMLCanvasElement;
}

/**
 * 図案帳（FR-124〜126）。
 *
 * 台紙に貼られた標本を綴じた冊子として組む。各項目のサムネイルは実際の
 * 生成器で描くので、選ぶ前に何が出るか分かる。
 */
export class PlateBook {
  private readonly entries: PlateEntry[] = [];
  private readonly options: PlateBookOptions;

  constructor(options: PlateBookOptions) {
    this.options = options;
    this.build();
  }

  private build(): void {
    const { container, onSelect } = this.options;
    container.textContent = '';

    for (const specimen of SPECIMENS) {
      const label = document.createElement('label');
      label.className = 'plate';
      label.dataset['specimen'] = specimen.id;

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'specimen';
      input.value = specimen.id;
      input.className = 'plate__input';
      input.addEventListener('change', () => {
        if (input.checked) onSelect(specimen.id);
      });

      const thumb = document.createElement('span');
      thumb.className = 'plate__thumb';
      const canvas = document.createElement('canvas');
      canvas.width = THUMB_WIDTH;
      canvas.height = THUMB_HEIGHT;
      canvas.setAttribute('aria-hidden', 'true');
      thumb.appendChild(canvas);

      const meta = document.createElement('span');
      meta.className = 'plate__meta';

      const no = document.createElement('span');
      no.className = 'plate__no';
      no.textContent = specimen.plateNo;

      const sci = document.createElement('span');
      sci.className = 'plate__sci';
      sci.textContent = specimen.scientificName;

      const jp = document.createElement('span');
      jp.className = 'plate__jp';
      jp.textContent = specimen.label;

      meta.append(no, sci, jp);
      label.append(input, thumb, meta);
      container.appendChild(label);

      this.entries.push({ id: specimen.id, input, canvas });
    }
  }

  /** 全サムネイルを描き直す。 */
  renderAll(): void {
    for (const entry of this.entries) this.renderEntry(entry);
  }

  /** 1 枚だけ描き直す（再抽選のときはこれで足りる、FR-606）。 */
  renderOne(specimenId: string): void {
    const entry = this.entries.find((e) => e.id === specimenId);
    if (entry) this.renderEntry(entry);
  }

  private renderEntry(entry: PlateEntry): void {
    const ctx = entry.canvas.getContext('2d');
    if (!ctx) return;
    renderSpecimenSwatch(
      ctx,
      entry.id,
      this.options.seedFor(entry.id),
      THUMB_WIDTH,
      THUMB_HEIGHT,
      getInkPreset(this.options.inkPresetId()),
    );
  }

  setSelected(specimenId: string | null): void {
    for (const entry of this.entries) {
      const selected = entry.id === specimenId;
      entry.input.checked = selected;
      entry.input.closest('.plate')?.classList.toggle('is-selected', selected);
    }
  }

  get size(): number {
    return this.entries.length;
  }
}
