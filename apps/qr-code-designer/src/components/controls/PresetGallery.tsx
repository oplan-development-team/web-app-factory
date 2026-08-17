import { useId } from 'react';
import { DOT_GLYPH_SIZE, dotGlyphPath, eyeBallGlyphPath, eyeFrameGlyphPath } from '../../lib/glyphs';
import { PRESETS, type Preset } from '../../lib/presets';
import type { DesignAppearance } from '../../lib/types';
import { PaintDef, paintFill } from '../PaintDef';

const TILE = 14;
const DOT_SAMPLE_ORIGIN = TILE - 1 - DOT_GLYPH_SIZE;

/**
 * Each tile shows the preset's actual finder shape and dot shape, drawn through
 * the same path builders as the real code, over the preset's own palette.
 */
function PresetSwatch({ preset }: { preset: Preset }) {
  const uid = useId().replace(/:/g, '');
  const a = preset.appearance;
  const bodyId = `${uid}-b`;
  const bgId = `${uid}-g`;
  const framePaint = a.eyeInherit ? a.bodyPaint : a.eyeFramePaint;
  const ballPaint = a.eyeInherit ? a.bodyPaint : a.eyeBallPaint;

  return (
    <svg className="preset__swatch" viewBox={`0 0 ${TILE} ${TILE}`} aria-hidden="true">
      <defs>
        {a.background && <PaintDef id={bgId} paint={a.background} origin={0} span={TILE} />}
        <PaintDef id={bodyId} paint={a.bodyPaint} origin={0} span={TILE} />
      </defs>
      <rect
        x={0}
        y={0}
        width={TILE}
        height={TILE}
        fill={a.background ? paintFill(a.background, bgId) : '#ffffff'}
      />
      <g transform="translate(1 1)">
        <path
          d={eyeFrameGlyphPath(a.eyeFrameStyle)}
          fillRule="evenodd"
          fill={framePaint.kind === 'solid' ? framePaint.color : `url(#${bodyId})`}
        />
        <path
          d={eyeBallGlyphPath(a.eyeBallStyle)}
          fill={ballPaint.kind === 'solid' ? ballPaint.color : `url(#${bodyId})`}
        />
      </g>
      <g transform={`translate(${DOT_SAMPLE_ORIGIN} ${DOT_SAMPLE_ORIGIN})`}>
        <path d={dotGlyphPath(a.dotStyle)} fill={paintFill(a.bodyPaint, bodyId)} />
      </g>
    </svg>
  );
}

interface PresetGalleryProps {
  onApply: (appearance: DesignAppearance) => void;
}

export function PresetGallery({ onApply }: PresetGalleryProps) {
  return (
    <ul className="presets">
      {PRESETS.map((preset) => (
        <li key={preset.id}>
          <button type="button" className="preset" onClick={() => onApply(preset.appearance)}>
            <PresetSwatch preset={preset} />
            <span className="preset__name">{preset.name}</span>
            <span className="preset__note">{preset.note}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
