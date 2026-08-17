import { useId } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  sublabel?: string;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
}

/**
 * Native radio inputs are used rather than buttons with ARIA: browsers already
 * give a same-named radio group arrow-key navigation and the correct roles.
 */
export function SegmentedControl<T extends string>({
  legend,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend className="field__label segmented__legend">{legend}</legend>
      <div className="segmented__track">
        {options.map((option) => (
          <label
            key={option.value}
            className="segmented__item"
            data-selected={option.value === value}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="visually-hidden"
            />
            <span className="segmented__label">{option.label}</span>
            {option.sublabel && <span className="segmented__sub">{option.sublabel}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
