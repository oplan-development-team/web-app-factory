import { useState, type RefObject } from 'react';
import { buildFileName, downloadBlob, rasterizeToPng, serializeSvg } from '../lib/export';
import { PNG_SIZES } from '../lib/options';
import { SegmentedControl, type SegmentOption } from './controls/SegmentedControl';

/** SVG is resolution independent; this is just the nominal size written into the file. */
const SVG_NOMINAL_PX = 1024;

const SIZE_OPTIONS: ReadonlyArray<SegmentOption<string>> = PNG_SIZES.map(({ px, mm }) => ({
  value: String(px),
  label: `${px}`,
  sublabel: `${mm}mm`,
}));

interface ExportPanelProps {
  svgRef: RefObject<SVGSVGElement | null>;
  text: string;
  disabled: boolean;
}

export function ExportPanel({ svgRef, text, disabled }: ExportPanelProps) {
  const [pixelSize, setPixelSize] = useState('1024');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = text.trim() || 'QR code';

  const handleSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;
    setError(null);
    try {
      const source = serializeSvg(svg, SVG_NOMINAL_PX, title);
      downloadBlob(
        new Blob([source], { type: 'image/svg+xml;charset=utf-8' }),
        buildFileName(text, 'svg'),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'SVG を書き出せませんでした。');
    }
  };

  const handlePng = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await rasterizeToPng(svg, Number(pixelSize), title);
      downloadBlob(blob, buildFileName(text, 'png'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'PNG を書き出せませんでした。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export">
      <SegmentedControl
        legend="PNG の解像度（下段は 300dpi 換算の実寸）"
        options={SIZE_OPTIONS}
        value={pixelSize}
        onChange={setPixelSize}
      />

      <div className="export__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={() => void handlePng()}
          disabled={disabled || busy}
        >
          {busy ? '書き出し中…' : `PNG を保存（${pixelSize}px）`}
        </button>
        <button
          type="button"
          className="button"
          onClick={handleSvg}
          disabled={disabled || busy}
        >
          SVG を保存
        </button>
      </div>

      <p className="export__hint">
        SVG は拡大しても劣化しないため、印刷入稿にはこちらを推奨します。
      </p>

      {error && (
        <p className="export__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
