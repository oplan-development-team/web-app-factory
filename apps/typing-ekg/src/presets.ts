// Preset sentences for the typing test.
// Intentionally ASCII-only (English / plain romaji) — no IME composition is
// involved, so keydown/keyup timing stays reliable across platforms.
export interface Preset {
  id: string;
  label: string;
  text: string;
}

export const PRESETS: Preset[] = [
  {
    id: 'fox',
    label: 'CH.1',
    text: 'the quick brown fox jumps over the lazy dog',
  },
  {
    id: 'haru',
    label: 'CH.2',
    text: 'haru no asa ni tori ga chiisaku naite iru',
  },
  {
    id: 'calm',
    label: 'CH.3',
    text: 'keyboards make music when your hands are calm',
  },
  {
    id: 'sakura',
    label: 'CH.4',
    text: 'sakura no hana ga machikado ni shizuka ni chitte iku',
  },
  {
    id: 'pulse',
    label: 'CH.5',
    text: 'every heartbeat leaves a mark on the screen',
  },
];

export function randomPreset(excludeId?: string): Preset {
  const pool = excludeId
    ? PRESETS.filter((p) => p.id !== excludeId)
    : PRESETS;
  const list = pool.length > 0 ? pool : PRESETS;
  return list[Math.floor(Math.random() * list.length)]!;
}
