import { useState } from 'react';
import {
  availablePresets,
  downloadPng,
  formatDimensions,
  presetPixels,
} from '../lib/export';
import type { HalftoneQrModel } from '../hooks/useHalftoneQr';
import { EXPORT_PRESETS, type ExportPreset } from '../lib/types';
import { SegmentedControl } from './controls/SegmentedControl';

export function ExportPanel({
  matrix,
  halftoneGrid,
  effectivePreset,
  setExportPreset,
}: HalftoneQrModel) {
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);

  const canExport = matrix !== null && halftoneGrid !== null;
  const allowed = matrix ? availablePresets(matrix.size) : [];

  const options: ReadonlyArray<{ value: ExportPreset; label: string; disabled?: boolean }> = (
    Object.keys(EXPORT_PRESETS) as ExportPreset[]
  ).map((preset) => ({
    value: preset,
    label: EXPORT_PRESETS[preset].label,
    disabled: matrix !== null && !allowed.includes(preset),
  }));

  async function handleDownload(): Promise<void> {
    if (!matrix || !halftoneGrid) return;
    setBusy(true);
    setError(null);
    try {
      await downloadPng(halftoneGrid, matrix.size, effectivePreset);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'PNG を書き出せませんでした。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel export-panel">
      <h2 className="panel-heading">
        <span className="numeral panel-step" aria-hidden="true">
          07
        </span>
        <span className="panel-title">書き出し</span>
      </h2>

      <div className="panel-body">
        <SegmentedControl
          label="解像度"
          value={effectivePreset}
          options={options}
          onChange={setExportPreset}
          hint={
            matrix && allowed.length < options.length
              ? '出力上限 8192px を超える解像度は選択できません。'
              : undefined
          }
        />

        <div className="export-summary">
          <span className="eyebrow">出力サイズ</span>
          <span className="numeral export-size">
            {matrix ? formatDimensions(presetPixels(matrix.size, effectivePreset)) : '—'}
          </span>
        </div>

        <button
          type="button"
          className="button-primary"
          onClick={handleDownload}
          disabled={!canExport || isBusy}
        >
          {isBusy ? '書き出し中…' : 'PNG をダウンロード'}
        </button>

        {!canExport && (
          <p className="field-hint">画像とテキストを設定すると書き出せます。</p>
        )}

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <p className="privacy-note">
          <span className="privacy-mark" aria-hidden="true" />
          画像もテキストも、この端末のブラウザ内だけで処理しています。どこにも送信されません。
        </p>
      </div>
    </section>
  );
}
