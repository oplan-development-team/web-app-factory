import { useId } from 'react';

interface ToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="toggle">
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="toggle__input visually-hidden"
        checked={checked}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label className="toggle__label" htmlFor={id}>
        <span className="toggle__track" aria-hidden="true">
          <span className="toggle__thumb" />
        </span>
        <span className="toggle__text">{label}</span>
      </label>
      {hint && (
        <p className="toggle__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
