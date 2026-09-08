import { el } from './dom';
import { locateTile } from './tiles';
import { formatCoord } from './format';

/**
 * The GPS "one-time reveal" modal. This is the app's second core gimmick:
 * the coordinate is shown exactly once — closing the modal (via the seal
 * button, Escape, or the backdrop) always routes through an explicit
 * confirmation step first ("this cannot be undone"), then calls `onSealed`
 * so the caller can permanently lock the field.
 */
export function openGpsModal(lat: number, lon: number, onSealed: () => void): void {
  const tile = locateTile(lat, lon);
  let confirming = false;

  const overlay = el('div', {
    className: 'gps-overlay',
    role: 'presentation',
    onClick: (e: Event) => {
      if (e.target === overlay) requestClose();
    },
  });

  const marker = el('div', {
    className: 'gps-marker',
    style: `left:${tile.markerX}px; top:${tile.markerY}px;`,
    'aria-hidden': 'true',
  });

  const img = el('img', {
    className: 'gps-tile',
    src: tile.url,
    alt: '撮影地点周辺の地図タイル（OpenStreetMap提供・1枚のみ）',
    width: 256,
    height: 256,
  });

  const mapFrame = el('div', { className: 'gps-tile-frame' }, [img, marker]);

  const confirmPanel = el('div', { className: 'gps-confirm', hidden: true });

  const footer = el('div', { className: 'gps-footer' }, [
    el('button', { type: 'button', className: 'btn btn-seal', onClick: requestClose }, ['封印して閉じる']),
  ]);

  const modal = el(
    'div',
    { className: 'gps-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '撮影地点情報の臨時開示' },
    [
      el('div', { className: 'gps-modal-head' }, [
        el('p', { className: 'gps-modal-eyebrow' }, ['臨時開示 ・ 一回限り']),
        el('h3', {}, ['撮影地点情報']),
        el('button', {
          type: 'button',
          className: 'gps-x',
          'aria-label': '閉じる（封印確認あり）',
          onClick: requestClose,
        }, ['×']),
      ]),
      el('p', { className: 'gps-coords' }, [`${formatCoord(lat, true)}  ${formatCoord(lon, false)}`]),
      mapFrame,
      el('p', { className: 'gps-caption' }, [
        '地図タイル画像のみ OpenStreetMap から取得しています（画像本体は送信していません）。閉じると本項目は恒久的に黒塗りされ、再表示できません。',
      ]),
      confirmPanel,
      footer,
    ],
  );

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') requestClose();
  }
  window.addEventListener('keydown', onKeydown);

  function requestClose() {
    if (confirming) return;
    confirming = true;
    footer.hidden = true;
    confirmPanel.hidden = false;
    confirmPanel.replaceChildren(
      el('p', { className: 'gps-confirm-text' }, [
        '一度封印すると、この写真ではもう二度と撮影地点を表示できません。よろしいですか？',
      ]),
      el('div', { className: 'gps-confirm-actions' }, [
        el('button', { type: 'button', className: 'btn btn-ghost', onClick: cancelClose }, ['まだ見る']),
        el('button', { type: 'button', className: 'btn btn-seal-confirm', onClick: sealAndClose }, [
          '封印する（再表示不可）',
        ]),
      ]),
    );
  }

  function cancelClose() {
    confirming = false;
    confirmPanel.hidden = true;
    footer.hidden = false;
  }

  function sealAndClose() {
    cleanup();
    onSealed();
  }

  function cleanup() {
    window.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = '';
    overlay.remove();
  }
}
