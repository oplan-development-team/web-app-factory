import { useEffect, useId, useState } from 'react';
import { normalizeHex } from '../../lib/color';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

/**
 * Swatch plus hex entry. The text input keeps its own draft so half-typed values
 * are not rejected mid-keystroke; only a valid hex is committed upward.
 */
export function ColorField({ label, value, onChange }: ColorFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = (raw: string) => {
    const hex = normalizeHex(raw);
    if (hex) onChange(hex);
    else setDraft(value);
  };

  return (
    <div className="color-field">
      <label className="color-field__swatch" style={{ background: value }}>
        <span className="visually-hidden">{label}のカラーピッカー</span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="color-field__native"
        />
      </label>
      <div className="color-field__text">
        <label className="color-field__label" htmlFor={id}>
          {label}
        </label>
        <input
          id={id}
          className="color-field__input"
          type="text"
          inputMode="text"
          spellCheck={false}
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit(event.currentTarget.value);
            }
          }}
        />
      </div>
    </div>
  );
}
