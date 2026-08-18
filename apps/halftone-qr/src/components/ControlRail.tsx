import { useId } from 'react';
import type { HalftoneQrModel } from '../hooks/useHalftoneQr';
import {
  ECC_LABELS,
  ECC_LEVELS,
  PROTECT_HINTS,
  PROTECT_LABELS,
  type EccLevel,
  type ProtectLevel,
} from '../lib/types';
import { ImageDropzone } from './ImageDropzone';
import { Section } from './controls/Section';
import { SegmentedControl } from './controls/SegmentedControl';
import { Slider } from './controls/Slider';
import { Toggle } from './controls/Toggle';

const PROTECT_OPTIONS: ReadonlyArray<{ value: ProtectLevel; label: string }> = (
  ['none', 'patterns', 'all'] as const
).map((value) => ({ value, label: PROTECT_LABELS[value] }));

const ECC_OPTIONS: ReadonlyArray<{ value: EccLevel; label: string }> = ECC_LEVELS.map(
  (value) => ({ value, label: ECC_LABELS[value] }),
);

const signed = (value: number): string => (value > 0 ? `+${value}` : String(value));

export function ControlRail(model: HalftoneQrModel) {
  const textId = useId();
  const textErrorId = `${textId}-error`;
  const { settings, matrix, qrError, effectiveEcc } = model;
  const eccLocked = settings.autoEcc && model.image !== null;

  return (
    <div className="rail">
      <Section step="01" title="エンコードする内容">
        <div className="field">
          <label className="field-label" htmlFor={textId}>
            URL またはテキスト
          </label>
          <textarea
            id={textId}
            className="textarea"
            rows={3}
            value={settings.text}
            spellCheck={false}
            onChange={(event) => model.setText(event.target.value)}
            aria-invalid={qrError !== null}
            aria-describedby={qrError ? textErrorId : undefined}
          />
          {qrError && (
            <p className="field-error" id={textErrorId} role="alert">
              {qrError}
            </p>
          )}
          {matrix && (
            <p className="field-hint">
              型番 <span className="numeral">{matrix.version}</span> ／{' '}
              <span className="numeral">
                {matrix.size} × {matrix.size}
              </span>{' '}
              モジュール
            </p>
          )}
        </div>

        <Toggle
          label="誤り訂正を自動調整"
          checked={settings.autoEcc}
          onChange={model.setAutoEcc}
          hint="画像を載せているあいだ、訂正レベルを H に固定します。"
        />

        <SegmentedControl
          label="誤り訂正レベル"
          value={effectiveEcc}
          options={ECC_OPTIONS.map((option) => ({ ...option, disabled: eccLocked }))}
          onChange={model.setEcc}
          hint={
            eccLocked
              ? '自動調整が有効なため H に固定されています。'
              : 'ハーフトーン化はノイズを載せる操作なので、低いほど読めなくなります。'
          }
        />
      </Section>

      <Section step="02" title="画像">
        <ImageDropzone
          image={model.image}
          error={model.imageError}
          isLoading={model.isLoadingImage}
          onSelect={model.selectImage}
          onClear={model.clearImage}
        />
      </Section>

      <Section step="03" title="トリミング">
        <Slider
          label="ズーム"
          value={settings.image.zoom}
          min={0.5}
          max={3}
          step={0.01}
          onChange={(zoom) => model.patchImageAdjust({ zoom })}
          format={(value) => `${value.toFixed(2)}×`}
        />
        <Slider
          label="水平位置"
          value={settings.image.offsetX}
          min={-1}
          max={1}
          step={0.01}
          onChange={(offsetX) => model.patchImageAdjust({ offsetX })}
          format={(value) => value.toFixed(2)}
        />
        <Slider
          label="垂直位置"
          value={settings.image.offsetY}
          min={-1}
          max={1}
          step={0.01}
          onChange={(offsetY) => model.patchImageAdjust({ offsetY })}
          format={(value) => value.toFixed(2)}
        />
        <button type="button" className="link-button" onClick={model.resetImageAdjust}>
          トリミングと階調をリセット
        </button>
      </Section>

      <Section step="04" title="階調">
        <Slider
          label="明度"
          value={settings.image.brightness}
          min={-100}
          max={100}
          step={1}
          onChange={(brightness) => model.patchImageAdjust({ brightness })}
          format={signed}
        />
        <Slider
          label="コントラスト"
          value={settings.image.contrast}
          min={-100}
          max={100}
          step={1}
          onChange={(contrast) => model.patchImageAdjust({ contrast })}
          format={signed}
          hint="上げすぎると黒く潰れた領域が増え、読み取りが不安定になります。"
        />
        <Toggle
          label="白黒を反転"
          checked={settings.image.invert}
          onChange={(invert) => model.patchImageAdjust({ invert })}
        />
      </Section>

      <Section step="05" title="ハーフトーン">
        <Slider
          label="QR らしさ"
          value={settings.halftone.qrness}
          min={0}
          max={1}
          step={0.01}
          onChange={(qrness) => model.patchHalftone({ qrness })}
          format={(value) => `${Math.round(value * 100)}%`}
          hint="上げるほど元の QR に近づき読み取りが安定します。下げるほど画像がはっきり出ます。"
        />
        <SegmentedControl
          label="機能パターンの保護"
          value={settings.halftone.protect}
          options={PROTECT_OPTIONS}
          onChange={(protect) => model.patchHalftone({ protect })}
          hint={PROTECT_HINTS[settings.halftone.protect]}
        />
      </Section>
    </div>
  );
}
