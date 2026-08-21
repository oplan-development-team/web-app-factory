/** 1 モジュールを何分割するか。ハーフトーン QR の中核定数（SPEC FR-006.1） */
export const SUB = 3;

/** クワイエットゾーン（モジュール単位）。QR 仕様上 4 以上（SPEC FR-009.4） */
export const QUIET_MODULES = 4;

/** 書き出し 1 辺の上限ピクセル数（SPEC FR-009.7） */
export const MAX_EXPORT_PX = 8192;

/**
 * L を選択肢に含めないのは、ハーフトーン化で大量のノイズが乗るため
 * 誤り訂正 7% では実用に耐えないと判断したから（SPEC FR-002.2）。
 */
export type EccLevel = 'H' | 'Q' | 'M';

export const ECC_LEVELS: readonly EccLevel[] = ['H', 'Q', 'M'];

export const ECC_LABELS: Record<EccLevel, string> = {
  H: 'H — 30%',
  Q: 'Q — 25%',
  M: 'M — 15%',
};

/** 機能パターンをどこまで元の QR のまま残すか（SPEC FR-006.7） */
export type ProtectLevel = 'none' | 'patterns' | 'all';

export const PROTECT_LABELS: Record<ProtectLevel, string> = {
  none: '画像優先',
  patterns: '標準',
  all: '最大',
};

export const PROTECT_HINTS: Record<ProtectLevel, string> = {
  none: '中央ビットのみ固定。画像の再現度は最も高いが、読み取りは不安定になりやすい',
  patterns: 'ファインダー・タイミング・位置合わせを維持。既定の推奨設定',
  all: '形式情報・型番情報も維持。読み取り優先',
};

/** 書き出し解像度プリセット（SPEC FR-009.2） */
export type ExportPreset = 'standard' | 'high' | 'print';

export const EXPORT_PRESETS: Record<ExportPreset, { label: string; pxPerSub: number }> = {
  standard: { label: '標準', pxPerSub: 6 },
  high: { label: '高解像度', pxPerSub: 12 },
  print: { label: '印刷用', pxPerSub: 24 },
};

/** 画像のトリミング・階調の調整値（SPEC FR-004, FR-005） */
export interface ImageAdjust {
  /** 0.5〜3.0。1.0 で cover フィット */
  zoom: number;
  /** -1.0〜1.0。トリミング枠の半分を 1.0 とした相対量 */
  offsetX: number;
  offsetY: number;
  /** -100〜100 */
  brightness: number;
  /** -100〜100 */
  contrast: number;
  invert: boolean;
}

/** ハーフトーン変換のパラメータ（SPEC FR-006） */
export interface HalftoneSettings {
  /** QR らしさ λ: 0〜1。非中央サブモジュールを元モジュール値へ引き寄せる強度 */
  qrness: number;
  protect: ProtectLevel;
}

export interface Settings {
  text: string;
  ecc: EccLevel;
  /** ON のあいだ、画像が読み込まれていれば ECC を H に固定する（SPEC FR-002.4） */
  autoEcc: boolean;
  image: ImageAdjust;
  halftone: HalftoneSettings;
  exportPreset: ExportPreset;
}

export const DEFAULT_IMAGE_ADJUST: ImageAdjust = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  brightness: 0,
  contrast: 0,
  invert: false,
};

export const DEFAULT_SETTINGS: Settings = {
  text: 'https://example.com/halftone-qr',
  ecc: 'H',
  autoEcc: true,
  image: DEFAULT_IMAGE_ADJUST,
  halftone: {
    // 0.35 は「画像が読めて、かつスキャンも通りやすい」実測上の落としどころ。
    qrness: 0.35,
    protect: 'patterns',
  },
  exportPreset: 'high',
};

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}
