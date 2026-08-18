import { useId } from 'react';

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>;
  onChange: (value: T) => void;
  hint?: string;
}

/**
 * ラジオボタンで組む。button の集合 + role="radiogroup" にすると
 * 矢印キーでの移動を自前で実装することになるため、素の input[type=radio] に任せる。
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: SegmentedControlProps<T>) {
  const name = useId();
  const hintId = `${name}-hint`;

  return (
    <fieldset className="field segmented" aria-describedby={hint ? hintId : undefined}>
      <legend className="field-label">{label}</legend>
      <div className="segmented-track">
        {options.map((option) => (
          <label
            key={option.value}
            className={`segmented-option${option.disabled ? ' is-disabled' : ''}`}
          >
            <input
              className="visually-hidden"
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span className="segmented-face">{option.label}</span>
          </label>
        ))}
      </div>
      {hint && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
    </fieldset>
  );
}
