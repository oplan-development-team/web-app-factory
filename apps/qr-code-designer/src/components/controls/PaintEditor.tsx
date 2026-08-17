import { convertPaint, paintToCss } from '../../lib/color';
import { PAINT_MODE_OPTIONS, type PaintMode } from '../../lib/options';
import type { Paint } from '../../lib/types';
import { ColorField } from './ColorField';
import { SliderField } from './Field';
import { SegmentedControl } from './SegmentedControl';

interface PaintEditorProps {
  legend: string;
  paint: Paint;
  onChange: (paint: Paint) => void;
}

export function PaintEditor({ legend, paint, onChange }: PaintEditorProps) {
  const setMode = (mode: PaintMode) => onChange(convertPaint(paint, mode));

  return (
    <div className="paint">
      <div className="paint__head">
        <span className="paint__preview" style={{ background: paintToCss(paint) }} aria-hidden="true" />
        <SegmentedControl
          legend={legend}
          options={PAINT_MODE_OPTIONS}
          value={paint.kind}
          onChange={setMode}
        />
      </div>

      {paint.kind === 'solid' ? (
        <ColorField
          label="カラー"
          value={paint.color}
          onChange={(color) => onChange({ kind: 'solid', color })}
        />
      ) : (
        <>
          <div className="paint__stops">
            <ColorField
              label="開始色"
              value={paint.from}
              onChange={(from) => onChange({ ...paint, from })}
            />
            <ColorField
              label="終了色"
              value={paint.to}
              onChange={(to) => onChange({ ...paint, to })}
            />
          </div>
          {paint.kind === 'linear' && (
            <SliderField
              label="角度"
              value={paint.angle}
              min={0}
              max={360}
              step={5}
              format={(value) => `${value}°`}
              onChange={(angle) => onChange({ ...paint, angle })}
            />
          )}
        </>
      )}
    </div>
  );
}
