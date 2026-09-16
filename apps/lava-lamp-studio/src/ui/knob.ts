/**
 * Chrome rotary knob control. Renders a hi-fi-style dial with perimeter
 * tick marks, a rotating pointer, and a digital readout — no native
 * <input type="range"> is exposed to the user. Interaction is a vertical
 * drag (standard "virtual knob" convention: drag up increases, drag down
 * decreases), which is far more reliable across mouse/touch than tracking
 * the cursor's angle around the dial.
 */

const MIN_ANGLE = -132;
const MAX_ANGLE = 132;
const TICK_COUNT = 11;

export interface KnobOptions {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  /** Formats the numeric value for the digital readout. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

export interface KnobHandle {
  element: HTMLDivElement;
  setValue: (value: number, opts?: { silent?: boolean }) => void;
  getValue: () => number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function createKnob(options: KnobOptions): KnobHandle {
  const { min, max } = options;
  const step = options.step ?? (max - min) / 100;
  const format = options.format ?? ((v: number) => String(Math.round(v)));
  let value = clamp(options.value, min, max);

  const root = document.createElement('div');
  root.className = 'knob';

  const dialWrap = document.createElement('div');
  dialWrap.className = 'knob__dial-wrap';

  const ticks = document.createElement('div');
  ticks.className = 'knob__ticks';
  for (let i = 0; i < TICK_COUNT; i++) {
    const t = document.createElement('div');
    const isMajor = i === 0 || i === TICK_COUNT - 1 || i === Math.floor(TICK_COUNT / 2);
    t.className = isMajor ? 'knob__tick knob__tick--major' : 'knob__tick';
    const angle = MIN_ANGLE + ((MAX_ANGLE - MIN_ANGLE) * i) / (TICK_COUNT - 1);
    t.style.transform = `rotate(${angle}deg)`;
    ticks.appendChild(t);
  }
  dialWrap.appendChild(ticks);

  const dial = document.createElement('div');
  dial.className = 'knob__dial';
  dial.setAttribute('role', 'slider');
  dial.setAttribute('tabindex', '0');
  dial.setAttribute('aria-label', options.label);
  dial.setAttribute('aria-valuemin', String(min));
  dial.setAttribute('aria-valuemax', String(max));

  const pointer = document.createElement('div');
  pointer.className = 'knob__pointer';
  dial.appendChild(pointer);

  const cap = document.createElement('div');
  cap.className = 'knob__cap';
  dial.appendChild(cap);

  dialWrap.appendChild(dial);
  root.appendChild(dialWrap);

  const labelEl = document.createElement('div');
  labelEl.className = 'knob__label';
  labelEl.textContent = options.label;
  root.appendChild(labelEl);

  const readout = document.createElement('div');
  readout.className = 'knob__readout';
  root.appendChild(readout);

  function angleFor(v: number): number {
    const t = (v - min) / (max - min);
    return MIN_ANGLE + (MAX_ANGLE - MIN_ANGLE) * t;
  }

  function render(): void {
    pointer.style.transform = `translate(-50%, 0) rotate(${angleFor(value)}deg)`;
    readout.textContent = format(value);
    dial.setAttribute('aria-valuenow', String(Math.round(value * 100) / 100));
    dial.setAttribute('aria-valuetext', format(value));
  }

  function setValue(v: number, opts?: { silent?: boolean }): void {
    const snapped = Math.round(clamp(v, min, max) / step) * step;
    value = clamp(snapped, min, max);
    render();
    if (!opts?.silent) options.onChange(value);
  }

  // --- Drag interaction (vertical drag = value change) ---
  let dragging = false;
  let dragStartY = 0;
  let dragStartValue = 0;

  const DRAG_RANGE_PX = 140; // pixels of drag to sweep the full min..max range

  function onPointerDown(e: PointerEvent): void {
    dragging = true;
    dragStartY = e.clientY;
    dragStartValue = value;
    dial.setPointerCapture(e.pointerId);
    dial.classList.add('is-dragging');
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging) return;
    const dy = dragStartY - e.clientY;
    const delta = (dy / DRAG_RANGE_PX) * (max - min);
    setValue(dragStartValue + delta);
  }

  function onPointerUp(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    dial.releasePointerCapture(e.pointerId);
    dial.classList.remove('is-dragging');
  }

  dial.addEventListener('pointerdown', onPointerDown);
  dial.addEventListener('pointermove', onPointerMove);
  dial.addEventListener('pointerup', onPointerUp);
  dial.addEventListener('pointercancel', onPointerUp);

  dial.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    setValue(value + (e.deltaY < 0 ? step * 3 : -step * 3));
  }, { passive: false });

  dial.addEventListener('keydown', (e: KeyboardEvent) => {
    const bigStep = (max - min) / 20;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      setValue(value + step);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setValue(value - step);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setValue(value + bigStep);
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setValue(value - bigStep);
    }
  });

  render();

  return {
    element: root,
    setValue,
    getValue: () => value,
  };
}
