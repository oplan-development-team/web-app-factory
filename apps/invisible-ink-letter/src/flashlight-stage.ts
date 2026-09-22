import type { Letter } from './codec';
import { FlashlightReveal } from './flashlight-reveal';

export interface FlashlightStageHandle {
  setLetter(letter: Letter): void;
  destroy(): void;
}

/**
 * 「なぞって光を当てる」体験そのもの(キャンバス+懐中電灯カーソル+ヒント)を
 * DOMに組み立てる。読む画面と、書く画面の「懐中電灯でテスト」プレビューが
 * これを共有する。
 */
export function mountFlashlightStage(host: HTMLElement, letter: Letter): FlashlightStageHandle {
  host.classList.add('flashlight-stage');

  const canvas = document.createElement('canvas');
  canvas.className = 'flashlight-canvas';

  const cursor = document.createElement('div');
  cursor.className = 'flashlight-cursor';
  cursor.setAttribute('aria-hidden', 'true');

  const hint = document.createElement('p');
  hint.className = 'flashlight-hint';
  hint.textContent = '指でなぞって、光を当てて。';

  host.append(canvas, cursor, hint);

  const engine = new FlashlightReveal(canvas, letter);
  engine.mount();

  let hintDismissed = false;
  let activePointerId: number | null = null;

  function dismissHint(): void {
    if (hintDismissed) return;
    hintDismissed = true;
    hint.classList.add('is-dismissed');
  }

  function positionCursor(clientX: number, clientY: number): void {
    const rect = canvas.getBoundingClientRect();
    cursor.style.transform = `translate(${clientX - rect.left}px, ${clientY - rect.top}px)`;
  }

  function traceAt(clientX: number, clientY: number): void {
    const rect = canvas.getBoundingClientRect();
    engine.addTouch(clientX - rect.left, clientY - rect.top);
  }

  function handlePointerDown(e: PointerEvent): void {
    dismissHint();
    activePointerId = e.pointerId;
    positionCursor(e.clientX, e.clientY);
    cursor.classList.add('is-visible');
    traceAt(e.clientX, e.clientY);
    canvas.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent): void {
    if (e.pointerType === 'touch' && activePointerId !== e.pointerId) {
      // タッチは「触れている間だけ」追従させる。触れる前は表示しない。
      return;
    }
    if (e.pointerType !== 'touch') {
      cursor.classList.add('is-visible');
    }
    positionCursor(e.clientX, e.clientY);
    if (activePointerId === e.pointerId) {
      traceAt(e.clientX, e.clientY);
    }
  }

  function handlePointerEnd(e: PointerEvent): void {
    if (activePointerId === e.pointerId) {
      activePointerId = null;
    }
    if (e.pointerType === 'touch') {
      cursor.classList.remove('is-visible');
    }
  }

  function handlePointerLeave(): void {
    if (activePointerId === null) {
      cursor.classList.remove('is-visible');
    }
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerEnd);
  canvas.addEventListener('pointercancel', handlePointerEnd);
  canvas.addEventListener('pointerleave', handlePointerLeave);

  return {
    setLetter(next: Letter): void {
      engine.setLetter(next);
    },
    destroy(): void {
      engine.dispose();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerEnd);
      canvas.removeEventListener('pointercancel', handlePointerEnd);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      host.innerHTML = '';
      host.classList.remove('flashlight-stage');
    },
  };
}
