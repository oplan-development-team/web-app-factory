import { type RefObject } from 'react';
import {
  DOT_GLYPH_SIZE,
  EYE_GLYPH_SIZE,
  dotGlyphPath,
  eyeBallGlyphPath,
  eyeFrameGlyphPath,
} from '../lib/glyphs';
import { DOT_STYLE_OPTIONS, ECC_OPTIONS, EYE_STYLE_OPTIONS } from '../lib/options';
import { MARGIN_MAX, MARGIN_MIN, type DesignAppearance, type QrDesign } from '../lib/types';
import { ExportPanel } from './ExportPanel';
import { ColorField } from './controls/ColorField';
import { SliderField } from './controls/Field';
import { LogoUploader } from './controls/LogoUploader';
import { PaintEditor } from './controls/PaintEditor';
import { PresetGallery } from './controls/PresetGallery';
import { Section } from './controls/Section';
import { SegmentedControl } from './controls/SegmentedControl';
import { ShapePicker } from './controls/ShapePicker';
import { Toggle } from './controls/Toggle';

interface ControlRailProps {
  design: QrDesign;
  update: (patch: Partial<QrDesign>) => void;
  applyAppearance: (appearance: DesignAppearance) => void;
  svgRef: RefObject<SVGSVGElement | null>;
  exportDisabled: boolean;
}

export function ControlRail({
  design,
  update,
  applyAppearance,
  svgRef,
  exportDisabled,
}: ControlRailProps) {
  const background = design.background;

  return (
    <div className="rail">
      <Section index="01" title="内容" description="URL でも、ただのテキストでも構いません。">
        <label className="field__label" htmlFor="qr-text">
          エンコードする内容
        </label>
        <textarea
          id="qr-text"
          className="textarea"
          rows={3}
          value={design.text}
          spellCheck={false}
          placeholder="https://example.com"
          onChange={(event) => update({ text: event.target.value })}
        />

        <Toggle
          label="誤り訂正レベルを自動で選ぶ"
          hint="ロゴを入れると H（30%）、入れないときは M（15%）になります。"
          checked={design.eccAuto}
          onChange={(eccAuto) => update({ eccAuto })}
        />

        {!design.eccAuto && (
          <SegmentedControl
            legend="誤り訂正レベル"
            options={ECC_OPTIONS}
            value={design.ecc}
            onChange={(ecc) => update({ ecc })}
          />
        )}

        <SliderField
          label="余白（クワイエットゾーン）"
          value={design.margin}
          min={MARGIN_MIN}
          max={MARGIN_MAX}
          step={1}
          format={(value) => `${value} モジュール`}
          hint="QR 規格は 4 モジュール以上を求めています。"
          onChange={(margin) => update({ margin })}
        />
      </Section>

      <Section index="02" title="プリセット" description="配色と形をまとめて差し替えます。内容とロゴはそのままです。">
        <PresetGallery onApply={applyAppearance} />
      </Section>

      <Section index="03" title="ドット" description="本体モジュールの形。">
        <ShapePicker
          legend="ドットの形状"
          options={DOT_STYLE_OPTIONS}
          value={design.dotStyle}
          onChange={(dotStyle) => update({ dotStyle })}
          glyphSize={DOT_GLYPH_SIZE}
          renderGlyph={(style) => <path d={dotGlyphPath(style)} className="glyph-strong" />}
        />
      </Section>

      <Section index="04" title="ファインダー" description="3 隅の目印。外枠と中央を別々に設定できます。">
        <Toggle
          label="本体と同じ色を使う"
          checked={design.eyeInherit}
          onChange={(eyeInherit) => update({ eyeInherit })}
        />

        <ShapePicker
          legend="外枠の形状"
          options={EYE_STYLE_OPTIONS}
          value={design.eyeFrameStyle}
          onChange={(eyeFrameStyle) => update({ eyeFrameStyle })}
          glyphSize={EYE_GLYPH_SIZE}
          renderGlyph={(style) => (
            <>
              <path d={eyeFrameGlyphPath(style)} fillRule="evenodd" className="glyph-strong" />
              <path d={eyeBallGlyphPath(design.eyeBallStyle)} className="glyph-faint" />
            </>
          )}
        />
        {!design.eyeInherit && (
          <ColorField
            label="外枠の色"
            value={
              design.eyeFramePaint.kind === 'solid'
                ? design.eyeFramePaint.color
                : design.eyeFramePaint.from
            }
            onChange={(color) => update({ eyeFramePaint: { kind: 'solid', color } })}
          />
        )}

        <ShapePicker
          legend="中央の形状"
          options={EYE_STYLE_OPTIONS}
          value={design.eyeBallStyle}
          onChange={(eyeBallStyle) => update({ eyeBallStyle })}
          glyphSize={EYE_GLYPH_SIZE}
          renderGlyph={(style) => (
            <>
              <path
                d={eyeFrameGlyphPath(design.eyeFrameStyle)}
                fillRule="evenodd"
                className="glyph-faint"
              />
              <path d={eyeBallGlyphPath(style)} className="glyph-strong" />
            </>
          )}
        />
        {!design.eyeInherit && (
          <ColorField
            label="中央の色"
            value={
              design.eyeBallPaint.kind === 'solid'
                ? design.eyeBallPaint.color
                : design.eyeBallPaint.from
            }
            onChange={(color) => update({ eyeBallPaint: { kind: 'solid', color } })}
          />
        )}
      </Section>

      <Section index="05" title="カラー" description="単色でもグラデーションでも。">
        <PaintEditor
          legend="前景の塗り"
          paint={design.bodyPaint}
          onChange={(bodyPaint) => update({ bodyPaint })}
        />

        <div className="rule" role="presentation" />

        <Toggle
          label="背景を透過にする"
          hint="配置先の地色をそのまま活かせます。"
          checked={background === null}
          onChange={(transparent) =>
            update({ background: transparent ? null : { kind: 'solid', color: '#ffffff' } })
          }
        />
        {background && (
          <PaintEditor
            legend="背景の塗り"
            paint={background}
            onChange={(next) => update({ background: next })}
          />
        )}
      </Section>

      <Section index="06" title="ロゴ" description="ブラウザの中だけで合成します。どこにも送信されません。">
        <LogoUploader logo={design.logo} onChange={(logo) => update({ logo })} />
      </Section>

      <Section index="07" title="書き出し" description="印刷入稿にも使える解像度で保存できます。">
        <ExportPanel svgRef={svgRef} text={design.text} disabled={exportDisabled} />
      </Section>
    </div>
  );
}
