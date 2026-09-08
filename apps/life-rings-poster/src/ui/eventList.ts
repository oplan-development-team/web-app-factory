import type { EventEntry } from '../lib/types';

export interface EventListHandlers {
  onYearChange(id: string, raw: string): void;
  onLabelChange(id: string, raw: string): void;
  onMajorChange(id: string, checked: boolean): void;
  onDelete(id: string): void;
  onMove(id: string, direction: -1 | 1): void;
}

function iconButton(text: string, ariaLabel: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn';
  btn.textContent = text;
  btn.setAttribute('aria-label', ariaLabel);
  return btn;
}

function createRow(event: EventEntry, handlers: EventListHandlers): HTMLElement {
  const row = document.createElement('div');
  row.className = 'event-row';
  row.dataset.id = event.id;

  const order = document.createElement('div');
  order.className = 'event-row__order';
  const upBtn = iconButton('▲', '一つ上へ移動');
  const downBtn = iconButton('▼', '一つ下へ移動');
  order.append(upBtn, downBtn);

  const yearInput = document.createElement('input');
  yearInput.type = 'number';
  yearInput.className = 'event-row__year';
  yearInput.value = String(event.year);
  yearInput.setAttribute('aria-label', '出来事の年');
  yearInput.inputMode = 'numeric';

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.className = 'event-row__label';
  labelInput.value = event.label;
  labelInput.placeholder = '出来事（例: 大学に入学）';
  labelInput.maxLength = 24;
  labelInput.setAttribute('aria-label', '出来事の内容');

  const toggleWrap = document.createElement('label');
  toggleWrap.className = 'toggle event-row__toggle';
  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.checked = event.major;
  const toggleTrack = document.createElement('span');
  toggleTrack.className = 'toggle__track';
  toggleTrack.setAttribute('aria-hidden', 'true');
  const toggleText = document.createElement('span');
  toggleText.className = 'toggle__label';
  toggleText.textContent = '大きな出来事';
  toggleWrap.append(toggleInput, toggleTrack, toggleText);

  const deleteBtn = iconButton('×', 'この出来事を削除');
  deleteBtn.className += ' event-row__delete';

  row.append(order, yearInput, labelInput, toggleWrap, deleteBtn);

  yearInput.addEventListener('input', () => handlers.onYearChange(event.id, yearInput.value));
  labelInput.addEventListener('input', () => handlers.onLabelChange(event.id, labelInput.value));
  toggleInput.addEventListener('change', () => handlers.onMajorChange(event.id, toggleInput.checked));
  deleteBtn.addEventListener('click', () => handlers.onDelete(event.id));
  upBtn.addEventListener('click', () => handlers.onMove(event.id, -1));
  downBtn.addEventListener('click', () => handlers.onMove(event.id, 1));

  return row;
}

function syncRow(row: HTMLElement, event: EventEntry): void {
  const yearInput = row.querySelector<HTMLInputElement>('.event-row__year');
  const labelInput = row.querySelector<HTMLInputElement>('.event-row__label');
  const toggleInput = row.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (yearInput && document.activeElement !== yearInput) yearInput.value = String(event.year);
  if (labelInput && document.activeElement !== labelInput) labelInput.value = event.label;
  if (toggleInput) toggleInput.checked = event.major;
}

/**
 * Keeps event rows as stable DOM nodes keyed by id, so typing in one row
 * never rebuilds (and steals focus from) the others. Reordering moves
 * existing nodes instead of recreating them.
 */
export class EventListView {
  private rows = new Map<string, HTMLElement>();

  constructor(private container: HTMLElement, private handlers: EventListHandlers) {}

  render(events: EventEntry[]): void {
    const seen = new Set<string>();
    let prevNode: ChildNode | null = null;

    events.forEach((event, i) => {
      seen.add(event.id);
      let row = this.rows.get(event.id);
      if (!row) {
        row = createRow(event, this.handlers);
        this.rows.set(event.id, row);
      } else {
        syncRow(row, event);
      }

      const target = prevNode ? prevNode.nextSibling : this.container.firstChild;
      if (target !== row) this.container.insertBefore(row, target);
      prevNode = row;

      const upBtn = row.querySelector<HTMLButtonElement>('.event-row__order button:first-child');
      const downBtn = row.querySelector<HTMLButtonElement>('.event-row__order button:last-child');
      if (upBtn) upBtn.disabled = i === 0;
      if (downBtn) downBtn.disabled = i === events.length - 1;
    });

    for (const [id, row] of this.rows) {
      if (!seen.has(id)) {
        row.remove();
        this.rows.delete(id);
      }
    }
  }
}
