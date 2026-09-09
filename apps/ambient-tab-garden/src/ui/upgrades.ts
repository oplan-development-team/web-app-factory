import { formatGlimmer } from '../domain/format';
import type { UpgradeId, UpgradeView } from '../domain/types';
import { must, replayAnimation, setText } from './dom';

interface Row {
  readonly item: HTMLLIElement;
  readonly name: HTMLElement;
  readonly level: HTMLElement;
  readonly desc: HTMLElement;
  readonly buy: HTMLButtonElement;
}

/**
 * The upgrade list.
 *
 * Rows are created once and then mutated. Re-rendering the list every tick
 * would drop keyboard focus mid-purchase and make the panel flicker as the
 * balance crosses a price.
 */
export class UpgradePanel {
  private readonly list = must<HTMLUListElement>('#upgrade-list');
  private readonly rows = new Map<UpgradeId, Row>();

  constructor(private readonly onBuy: (id: UpgradeId) => void) {}

  render(views: readonly UpgradeView[]): void {
    for (const view of views) {
      const row = this.rows.get(view.id) ?? this.createRow(view.id);

      setText(row.name, view.name);
      setText(row.level, view.level > 0 ? `Lv${view.level}` : '');
      setText(row.desc, view.description);

      const label = view.maxed ? 'MAX' : formatGlimmer(view.cost ?? 0);
      setText(row.buy, label);
      row.buy.disabled = !view.affordable;
      row.buy.setAttribute(
        'aria-label',
        view.maxed
          ? `${view.name} は最大レベルです`
          : `${view.name} を ${label} きらめきで購入`,
      );
      row.item.classList.toggle('upgrade--locked', !view.affordable);
    }
  }

  /** Visible acknowledgement that the click did something. */
  markBought(id: UpgradeId): void {
    const row = this.rows.get(id);
    if (row) replayAnimation(row.buy, 'upgrade__buy--bought');
  }

  private createRow(id: UpgradeId): Row {
    const item = document.createElement('li');
    item.className = 'upgrade';

    const text = document.createElement('div');
    text.className = 'upgrade__text';

    const nameLine = document.createElement('p');
    nameLine.className = 'upgrade__name';

    const name = document.createElement('span');
    const level = document.createElement('span');
    level.className = 'upgrade__level';

    const desc = document.createElement('p');
    desc.className = 'upgrade__desc';

    const buy = document.createElement('button');
    buy.type = 'button';
    buy.className = 'upgrade__buy';
    buy.addEventListener('click', () => this.onBuy(id));

    nameLine.append(name, level);
    text.append(nameLine, desc);
    item.append(text, buy);
    this.list.appendChild(item);

    const row: Row = { item, name, level, desc, buy };
    this.rows.set(id, row);
    return row;
  }
}
