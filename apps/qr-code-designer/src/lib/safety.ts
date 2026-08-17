import { paintLuminance, worstContrast } from './color';
import { countMaskedModules, type LogoMask } from './paths';
import { ECC_CAPACITY, type Paint, type QrDesign } from './types';

export type SafetyLevel = 'safe' | 'caution' | 'risk';
export type FindingLevel = SafetyLevel | 'info';

export interface Finding {
  id: string;
  level: FindingLevel;
  title: string;
  detail: string;
}

export interface SafetyReport {
  level: SafetyLevel;
  findings: Finding[];
  /** Masked module count as a fraction of the whole body. */
  logoCoverage: number;
  /** Worst-case WCAG contrast between foreground and background. */
  contrast: number;
}

/** When the background is transparent we assume the code lands on white paper. */
const ASSUMED_SURFACE = { kind: 'solid', color: '#ffffff' } as const;

const CONTRAST_SAFE = 4.5;
const CONTRAST_CAUTION = 3;

interface PaintLayer {
  label: string;
  paint: Paint;
}

/**
 * Every layer that has to stand out from the background. The finder patterns are
 * what a reader locks onto first, so a low-contrast finder breaks a code even
 * when the body is perfectly readable.
 */
function contrastLayers(design: QrDesign): PaintLayer[] {
  const layers: PaintLayer[] = [{ label: '前景', paint: design.bodyPaint }];
  if (!design.eyeInherit) {
    layers.push({ label: 'ファインダー外枠', paint: design.eyeFramePaint });
    layers.push({ label: 'ファインダー中央', paint: design.eyeBallPaint });
  }
  return layers;
}

const RANK: Record<FindingLevel, number> = { info: 0, safe: 0, caution: 1, risk: 2 };

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function analyzeSafety(
  design: QrDesign,
  matrixSize: number,
  mask: LogoMask | null,
): SafetyReport {
  const findings: Finding[] = [];
  const background = design.background ?? ASSUMED_SURFACE;

  // --- FR-009.2 contrast ---------------------------------------------------
  let contrast = Number.POSITIVE_INFINITY;
  let weakest = '前景';
  for (const layer of contrastLayers(design)) {
    const ratio = worstContrast(layer.paint, background);
    if (ratio < contrast) {
      contrast = ratio;
      weakest = layer.label;
    }
  }

  const contrastLevel: SafetyLevel =
    contrast >= CONTRAST_SAFE ? 'safe' : contrast >= CONTRAST_CAUTION ? 'caution' : 'risk';
  findings.push({
    id: 'contrast',
    level: contrastLevel,
    title: `明暗コントラスト ${contrast.toFixed(1)}:1（${weakest}）`,
    detail:
      contrastLevel === 'safe'
        ? 'すべての層が背景から十分に浮き上がっています。'
        : contrastLevel === 'caution'
          ? `${weakest}と背景の差がやや小さめです。印刷や暗い照明下では読み取りにくくなる可能性があります。`
          : `${weakest}と背景の差が小さすぎます。多くの読み取り機で失敗します。より暗い色にしてください。`,
  });

  // --- FR-009.4 quiet zone -------------------------------------------------
  const marginLevel: SafetyLevel =
    design.margin >= 4 ? 'safe' : design.margin === 0 ? 'risk' : 'caution';
  findings.push({
    id: 'quiet-zone',
    level: marginLevel,
    title: `余白 ${design.margin} モジュール`,
    detail:
      marginLevel === 'safe'
        ? 'QR 規格が求める 4 モジュール以上の余白を確保しています。'
        : marginLevel === 'caution'
          ? '規格は 4 モジュール以上を推奨します。周囲に他の要素が来ると読み取り率が下がります。'
          : '余白がありません。背景と接した瞬間に読み取れなくなります。',
  });

  // --- FR-009.1 logo coverage ----------------------------------------------
  const maskedModules = countMaskedModules(matrixSize, mask);
  const totalModules = matrixSize * matrixSize;
  const logoCoverage = totalModules === 0 ? 0 : maskedModules / totalModules;

  if (design.logo) {
    const capacity = ECC_CAPACITY[design.ecc];
    const coverageLevel: SafetyLevel =
      logoCoverage <= capacity * 0.5 ? 'safe' : logoCoverage <= capacity * 0.8 ? 'caution' : 'risk';
    findings.push({
      id: 'logo-coverage',
      level: coverageLevel,
      title: `ロゴ被覆率 ${percent(logoCoverage)}（訂正能力 ${percent(capacity)}）`,
      detail:
        coverageLevel === 'safe'
          ? '誤り訂正の範囲に十分収まっています。'
          : coverageLevel === 'caution'
            ? '訂正能力の限界に近づいています。ロゴを小さくするか、余白を減らしてください。'
            : '訂正能力を超えかけています。読み取れない可能性が高いため、ロゴを縮小してください。',
    });
  }

  // --- FR-009.3 inversion --------------------------------------------------
  if (paintLuminance(design.bodyPaint) > paintLuminance(background)) {
    findings.push({
      id: 'inverted',
      level: 'caution',
      title: '明暗が反転しています',
      detail:
        '暗い背景に明るいモジュールを置いています。多くのスマートフォンは対応しますが、一部の業務用リーダーは読めません。',
    });
  }

  // --- FR-009.5 transparency -----------------------------------------------
  if (design.background === null) {
    findings.push({
      id: 'transparent',
      level: 'info',
      title: '背景が透過です',
      detail: '配置先の地色がそのまま背景になります。暗い面に置くと読み取れません。',
    });
  }

  // --- FR-009.6 dot style vs ECC -------------------------------------------
  // Circles cover about 79% of a module. Readers sample near module centres so
  // this is usually harmless, but at L there is almost no margin left over.
  if (design.dotStyle === 'dot' && (design.ecc === 'L' || design.ecc === 'M')) {
    const isLowest = design.ecc === 'L';
    findings.push({
      id: 'dot-style',
      level: isLowest ? 'caution' : 'info',
      title: `丸ドット × 訂正レベル ${design.ecc}`,
      detail: isLowest
        ? '丸ドットは塗り面積が減るうえ、L は訂正の余裕がほとんどありません。Q 以上をおすすめします。'
        : '丸ドットは塗り面積が約 79% に減ります。小さく印刷する場合は Q 以上が安心です。',
    });
  }

  const level = findings.reduce<SafetyLevel>((worst, finding) => {
    return RANK[finding.level] > RANK[worst] ? (finding.level as SafetyLevel) : worst;
  }, 'safe');

  return { level, findings, logoCoverage, contrast };
}

export const SAFETY_LABEL: Record<SafetyLevel, string> = {
  safe: '読み取り良好',
  caution: '注意が必要',
  risk: '読み取り困難',
};
