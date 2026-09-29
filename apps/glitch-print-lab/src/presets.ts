import type { LayerState } from './pipeline.ts';

export interface Preset {
  id: string;
  label: string;
  layers: LayerState;
}

// A note on jpegCorrupt tuning across DEFAULT_LAYERS and these presets:
// empirically (measured against Chrome's createImageBitmap re-decode),
// re-decode survival depends far more on CORRUPTION BLOCK SIZE than on
// BYTE CORRUPTION RATE. Many small scattered hits (small blockSize) desync
// the Huffman-coded scan almost immediately — even a ~1% rate at
// blockSize 1-5 fails to re-decode the majority of the time. Fewer, larger
// contiguous hits (blockSize 40+) survive re-decode far more often at the
// same or even higher rate, while still reading as blocky datamosh
// corruption. Presets are tuned within that measured envelope so each one
// reliably produces a visible result; failure is still reachable (and
// intentional) by pushing BYTE CORRUPTION RATE up manually.
export const PRESETS: Preset[] = [
  {
    id: 'vhs',
    label: 'VHS DECAY',
    layers: {
      // Kept in the high-survival zone: this preset's character comes from
      // scanline duplication + wave shift, not from aggressive byte
      // corruption, and EXPORT re-runs at full resolution as a single
      // real (non-retried) attempt — see doExport().
      jpegCorrupt: { enabled: true, rate: 1.5, blockSize: 48 },
      rowShift: { enabled: true, maxShift: 6, bandHeight: 3, mode: 'wave' },
      channelShift: { enabled: true, maxOffset: 2 },
      scanline: { enabled: true, density: 28, mode: 'duplicate' },
    },
  },
  {
    id: 'datamosh',
    label: 'DATAMOSH CORE',
    layers: {
      // Deliberately the riskiest preset — "CORE" chaos means a real,
      // visible chance the full-resolution EXPORT itself lands on a
      // genuine re-decode failure, same as pushing BYTE CORRUPTION RATE up
      // manually. That is treated as authentic behaviour, not a bug.
      jpegCorrupt: { enabled: true, rate: 10, blockSize: 48 },
      rowShift: { enabled: true, maxShift: 40, bandHeight: 14, mode: 'random' },
      channelShift: { enabled: true, maxOffset: 4 },
      scanline: { enabled: true, density: 6, mode: 'noise' },
    },
  },
  {
    id: 'chromatic',
    label: 'CHROMATIC FRACTURE',
    layers: {
      // The hero effect here is channel separation, not byte corruption,
      // so jpegCorrupt is kept light and in the high-survival zone.
      jpegCorrupt: { enabled: true, rate: 1.5, blockSize: 40 },
      rowShift: { enabled: true, maxShift: 10, bandHeight: 20, mode: 'wave' },
      channelShift: { enabled: true, maxOffset: 16 },
      scanline: { enabled: true, density: 10, mode: 'noise' },
    },
  },
];

export const DEFAULT_LAYERS: LayerState = {
  // Kept mild relative to the presets: this is what a first-time visitor
  // sees before touching anything, so it should reliably survive
  // re-decoding across a range of source images rather than risk landing
  // on the error state on first load.
  jpegCorrupt: { enabled: true, rate: 2, blockSize: 48 },
  rowShift: { enabled: true, maxShift: 8, bandHeight: 6, mode: 'random' },
  channelShift: { enabled: true, maxOffset: 3 },
  scanline: { enabled: true, density: 8, mode: 'noise' },
};
