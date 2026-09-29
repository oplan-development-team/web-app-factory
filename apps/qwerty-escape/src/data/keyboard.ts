import type { KeyDef, LayoutId } from '../types';

/**
 * Hardcoded physical coordinate table for the keyboard.
 *
 * Coordinates are expressed in "key units" (u), where 1u = the width of a
 * standard letter key. `col` is the x-offset of the key's left edge, `row`
 * is the row index (0 = number row .. 4 = space row). These offsets mirror
 * real ANSI/JIS row-stagger measurements (Tab≈1.5u, Caps≈1.75u,
 * LeftShift≈2.25u) so the on-screen board reproduces genuine stagger.
 *
 * Only the "alpha block" below (digits + QWERTYUIOP + ASDFGHJKL + ZXCVBNM)
 * is used for puzzle answers — these codes and coordinates are IDENTICAL
 * between US and JIS, which is what lets a single puzzle data set work
 * under both layouts (see puzzles.ts). Everything else (symbol keys,
 * modifiers, Enter/Space shapes) is decorative/structural only, and is
 * intentionally simplified — it exists to make the board *look* like a
 * real US or JIS keyboard, not to be gameplay-accurate.
 */

const DIGIT_CODES = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
];
const DIGIT_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

const ROW1_CODES = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'];
const ROW2_CODES = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'];
const ROW3_CODES = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'];

/** All codes eligible as puzzle answers. Shared by both layouts. */
export const ANSWERABLE_CODES = new Set<string>([
  ...DIGIT_CODES,
  ...ROW1_CODES,
  ...ROW2_CODES,
  ...ROW3_CODES,
]);

function buildAlphaBlock(): KeyDef[] {
  const keys: KeyDef[] = [];
  DIGIT_CODES.forEach((code, i) => {
    keys.push({ code, row: 0, col: 1 + i, label: DIGIT_LABELS[i]! });
  });
  ROW1_CODES.forEach((code, i) => {
    keys.push({ code, row: 1, col: 1.5 + i, label: code.replace('Key', '') });
  });
  ROW2_CODES.forEach((code, i) => {
    keys.push({ code, row: 2, col: 1.75 + i, label: code.replace('Key', '') });
  });
  ROW3_CODES.forEach((code, i) => {
    keys.push({ code, row: 3, col: 2.25 + i, label: code.replace('Key', '') });
  });
  return keys;
}

function structuralExtras(layout: LayoutId): KeyDef[] {
  const s = true;
  if (layout === 'us') {
    return [
      { code: 'Backquote', row: 0, col: 0, label: '`', subLabel: '~', structural: s },
      { code: 'Minus', row: 0, col: 11, label: '-', subLabel: '_', structural: s },
      { code: 'Equal', row: 0, col: 12, label: '=', subLabel: '+', structural: s },
      { code: 'Backspace', row: 0, col: 13, width: 2, label: '⌫', structural: s },

      { code: 'Tab', row: 1, col: 0, width: 1.5, label: 'Tab', structural: s },
      { code: 'BracketLeft', row: 1, col: 11.5, label: '[', subLabel: '{', structural: s },
      { code: 'BracketRight', row: 1, col: 12.5, label: ']', subLabel: '}', structural: s },
      { code: 'Backslash', row: 1, col: 13.5, width: 1.5, label: '\\', subLabel: '|', structural: s },

      { code: 'CapsLock', row: 2, col: 0, width: 1.75, label: 'Caps', structural: s },
      { code: 'Semicolon', row: 2, col: 10.75, label: ';', subLabel: ':', structural: s },
      { code: 'Quote', row: 2, col: 11.75, label: "'", subLabel: '"', structural: s },
      { code: 'Enter', row: 2, col: 12.75, width: 2.25, label: 'Enter', structural: s },

      { code: 'ShiftLeft', row: 3, col: 0, width: 2.25, label: 'Shift', structural: s },
      { code: 'Comma', row: 3, col: 9.25, label: ',', subLabel: '<', structural: s },
      { code: 'Period', row: 3, col: 10.25, label: '.', subLabel: '>', structural: s },
      { code: 'Slash', row: 3, col: 11.25, label: '/', subLabel: '?', structural: s },
      { code: 'ShiftRight', row: 3, col: 12.25, width: 2.75, label: 'Shift', structural: s },

      { code: 'ControlLeft', row: 4, col: 0, width: 1.25, label: 'Ctrl', structural: s },
      { code: 'MetaLeft', row: 4, col: 1.25, width: 1.25, label: 'Win', structural: s },
      { code: 'AltLeft', row: 4, col: 2.5, width: 1.25, label: 'Alt', structural: s },
      { code: 'Space', row: 4, col: 3.75, width: 6.25, label: '', structural: s },
      { code: 'AltRight', row: 4, col: 10.0, width: 1.25, label: 'Alt', structural: s },
      { code: 'MetaRight', row: 4, col: 11.25, width: 1.25, label: 'Win', structural: s },
      { code: 'ContextMenu', row: 4, col: 12.5, width: 1.25, label: '☰', structural: s },
      { code: 'ControlRight', row: 4, col: 13.75, width: 1.25, label: 'Ctrl', structural: s },
    ];
  }

  // JIS
  return [
    { code: 'Backquote', row: 0, col: 0, label: '　', subLabel: '', structural: s },
    { code: 'Minus', row: 0, col: 11, label: '-', subLabel: '=', structural: s },
    { code: 'Equal', row: 0, col: 12, label: '^', subLabel: '~', structural: s },
    { code: 'Backspace', row: 0, col: 13, width: 2, label: '⌫', structural: s },

    { code: 'Tab', row: 1, col: 0, width: 1.5, label: 'Tab', structural: s },
    { code: 'BracketLeft', row: 1, col: 11.5, label: '@', subLabel: '`', structural: s },
    { code: 'BracketRight', row: 1, col: 12.5, label: '[', subLabel: '{', structural: s },
    { code: 'IntlYen', row: 1, col: 13.5, width: 1.5, label: '¥', subLabel: '|', structural: s },

    { code: 'CapsLock', row: 2, col: 0, width: 1.75, label: 'Caps', structural: s },
    { code: 'Semicolon', row: 2, col: 10.75, label: ';', subLabel: '+', structural: s },
    { code: 'Quote', row: 2, col: 11.75, label: ':', subLabel: '*', structural: s },
    { code: 'Backslash', row: 2, col: 12.75, label: ']', subLabel: '}', structural: s },
    { code: 'Enter', row: 2, col: 13.75, width: 1.25, label: 'Enter', structural: s },

    { code: 'ShiftLeft', row: 3, col: 0, width: 2.25, label: 'Shift', structural: s },
    { code: 'Comma', row: 3, col: 9.25, label: ',', subLabel: '<', structural: s },
    { code: 'Period', row: 3, col: 10.25, label: '.', subLabel: '>', structural: s },
    { code: 'Slash', row: 3, col: 11.25, label: '/', subLabel: '?', structural: s },
    { code: 'IntlRo', row: 3, col: 12.25, label: 'ろ', subLabel: '_', structural: s },
    { code: 'ShiftRight', row: 3, col: 13.25, width: 1.75, label: 'Shift', structural: s },

    { code: 'ControlLeft', row: 4, col: 0, width: 1.25, label: 'Ctrl', structural: s },
    { code: 'MetaLeft', row: 4, col: 1.25, width: 1.125, label: '無変換', structural: s },
    { code: 'AltLeft', row: 4, col: 2.375, width: 1.125, label: 'Alt', structural: s },
    { code: 'Space', row: 4, col: 3.5, width: 4.5, label: '', structural: s },
    { code: 'AltRight', row: 4, col: 8.0, width: 1.125, label: 'Alt', structural: s },
    { code: 'Convert', row: 4, col: 9.125, width: 1.125, label: '変換', structural: s },
    { code: 'KanaMode', row: 4, col: 10.25, width: 1.125, label: 'かな', structural: s },
    { code: 'MetaRight', row: 4, col: 11.375, width: 1.1875, label: 'Win', structural: s },
    { code: 'ControlRight', row: 4, col: 12.5625, width: 1.1875, label: 'Ctrl', structural: s },
  ];
}

export function buildLayout(layout: LayoutId): KeyDef[] {
  return [...buildAlphaBlock(), ...structuralExtras(layout)];
}

/** Total board width in key units, used to size the CSS grid. */
export const BOARD_WIDTH_U = 15;
export const BOARD_HEIGHT_ROWS = 5;
