import type { Puzzle } from '../types';

/**
 * 9 puzzles, fixed order, no shuffling (per spec — outOfScope explicitly
 * excludes randomization). Every `codes` entry is drawn only from the
 * alpha block (digits + QWERTYUIOP + ASDFGHJKL + ZXCVBNM), which is
 * identical in both US and JIS layouts — so the same answer works
 * regardless of the selected on-screen layout.
 *
 * mode: 'simultaneous' — all codes must be active (held or toggled) at once.
 * mode: 'sequence'     — codes must be entered one at a time, in order.
 */
export const PUZZLES: Puzzle[] = [
  {
    id: 'bookends',
    index: 1,
    title: '両端の掛け金',
    flavor: '指の可動域、その両端に掛け金がある。中段を支える二本の柱を、同時に外せ。',
    mode: 'simultaneous',
    codes: ['KeyA', 'KeyL'],
    shapeName: '両端',
  },
  {
    id: 'triangle',
    index: 2,
    title: '歪んだ三角の支点',
    flavor: '歪んだ三角を結ぶ支点を探せ。頂点は三つ、すべて同時に触れよ。',
    mode: 'simultaneous',
    codes: ['KeyQ', 'KeyV', 'KeyI'],
    shapeName: '三角形',
  },
  {
    id: 'diagonal',
    index: 3,
    title: '四段を貫く針路',
    flavor: '最上段から最下段まで、四つの段を一息に貫く針路がある。段の順になぞれ。',
    mode: 'sequence',
    codes: ['Digit4', 'KeyT', 'KeyH', 'KeyN'],
    shapeName: '対角線',
  },
  {
    id: 'zigzag',
    index: 4,
    title: '上下段の渡り',
    flavor: '上の段と下の段を互い違いに踏みながら、右へ渡れ。踏む順序を違えるな。',
    mode: 'sequence',
    codes: ['KeyQ', 'KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD'],
    shapeName: 'ジグザグ',
  },
  {
    id: 'rectangle',
    index: 5,
    title: '歪んだ四角形',
    flavor: '盤面の継ぎ目でわずかに歪んだ四角がある。その四隅を、同時に押さえよ。',
    mode: 'simultaneous',
    codes: ['Digit2', 'Digit7', 'KeyW', 'KeyU'],
    shapeName: '長方形',
  },
  {
    id: 'ring',
    index: 6,
    title: '中心を囲む環',
    flavor: '円環の中心には触れるな。取り囲む四点のみを、同時に解き放て。',
    mode: 'simultaneous',
    codes: ['KeyY', 'KeyG', 'KeyJ', 'KeyB'],
    shapeName: '環',
  },
  {
    id: 'arrow',
    index: 7,
    title: '指し示す矢',
    flavor: '下段を横切る柄から、右上へ跳ねる鏃（やじり）が伸びている。柄から鏃の順になぞれ。',
    mode: 'sequence',
    codes: ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyG', 'KeyB'],
    shapeName: '矢印',
  },
  {
    id: 'counter-diagonal',
    index: 8,
    title: '逆刻みの傷跡',
    flavor: '先の針路とは逆向きに、右上から左下へ刻まれた傷跡がある。上から順になぞれ。',
    mode: 'sequence',
    codes: ['Digit7', 'KeyT', 'KeyD', 'KeyX'],
    shapeName: '逆対角線',
  },
  {
    id: 'final-bolt',
    index: 9,
    title: '最後の閂',
    flavor: '盤面の四隅を結ぶ大きなXが、最後の閂（かんぬき）を貫いている。両手を広げ、四隅を同時に踏め。',
    mode: 'simultaneous',
    codes: ['KeyQ', 'KeyP', 'KeyZ', 'KeyM'],
    shapeName: 'X',
  },
];
