import { useId, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  hint?: string;
  /** Rendered on the label row, right aligned — used for live values. */
  readout?: ReactNode;
  children: (controlId: string) => ReactNode;
}

export function Field({ label, hint, readout, children }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <div className="field__label-row">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {readout && <span className="field__readout">{readout}</span>}
      </div>
      {children(id)}
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (value: number) => string;
  hint?: string;
  onChange: (value: number) => void;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  hint,
  onChange,
}: SliderFieldProps) {
  return (
    <Field label={label} hint={hint} readout={format ? format(value) : String(value)}>
      {(id) => (
        <input
          id={id}
          className="slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      )}
    </Field>
  );
}
