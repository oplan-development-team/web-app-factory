import { useId, type ReactNode } from 'react';
import type { Option } from '../../lib/options';

interface ShapePickerProps<T extends string> {
  legend: string;
  options: ReadonlyArray<Option<T>>;
  value: T;
  onChange: (value: T) => void;
  /** SVG contents for a preview of the given option. */
  renderGlyph: (value: T) => ReactNode;
  /** Side length of the glyph's coordinate system. */
  glyphSize: number;
}

export function ShapePicker<T extends string>({
  legend,
  options,
  value,
  onChange,
  renderGlyph,
  glyphSize,
}: ShapePickerProps<T>) {
  const name = useId();
  return (
    <fieldset className="shapes">
      <legend className="field__label shapes__legend">{legend}</legend>
      <div className="shapes__grid">
        {options.map((option) => (
          <label key={option.value} className="shape" data-selected={option.value === value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="visually-hidden"
            />
            <svg
              className="shape__glyph"
              viewBox={`-0.5 -0.5 ${glyphSize + 1} ${glyphSize + 1}`}
              aria-hidden="true"
            >
              {renderGlyph(option.value)}
            </svg>
            <span className="shape__label">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
