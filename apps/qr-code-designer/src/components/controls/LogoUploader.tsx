import { useRef, useState } from 'react';
import { ACCEPTED_LOGO_TYPES, readLogoAsDataUrl, validateLogoFile } from '../../lib/logo';
import { LOGO_FRAME_OPTIONS } from '../../lib/options';
import { LOGO_SIZE_MAX, LOGO_SIZE_MIN, type LogoConfig } from '../../lib/types';
import { SliderField } from './Field';
import { SegmentedControl } from './SegmentedControl';

interface LogoUploaderProps {
  logo: LogoConfig | null;
  onChange: (logo: LogoConfig | null) => void;
}

const DEFAULTS = { sizeRatio: 0.2, padding: 1, frame: 'rounded' } as const;

export function LogoUploader({ logo, onChange }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setDragging] = useState(false);

  const accept = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateLogoFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const dataUrl = await readLogoAsDataUrl(file);
      setError(null);
      onChange({ ...DEFAULTS, dataUrl, name: file.name });
    } catch {
      setError('ファイルを読み込めませんでした。');
    }
  };

  if (!logo) {
    return (
      <div className="logo">
        <div
          className="dropzone"
          data-dragging={isDragging}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void accept(event.dataTransfer.files[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_LOGO_TYPES}
            className="visually-hidden"
            id="logo-input"
            onChange={(event) => {
              void accept(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <label className="dropzone__button" htmlFor="logo-input">
            画像を選ぶ
          </label>
          <p className="dropzone__hint">
            ドラッグ&ドロップも可 · PNG / JPEG / SVG / WebP · 2MB まで
          </p>
        </div>
        {error && (
          <p className="logo__error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="logo">
      <div className="logo__current">
        <img className="logo__thumb" src={logo.dataUrl} alt="" />
        <div className="logo__meta">
          <p className="logo__name" title={logo.name}>
            {logo.name}
          </p>
          <button type="button" className="link-button" onClick={() => onChange(null)}>
            ロゴを削除
          </button>
        </div>
      </div>

      <SliderField
        label="サイズ"
        value={Math.round(logo.sizeRatio * 100)}
        min={Math.round(LOGO_SIZE_MIN * 100)}
        max={Math.round(LOGO_SIZE_MAX * 100)}
        step={1}
        format={(value) => `${value}%`}
        onChange={(value) => onChange({ ...logo, sizeRatio: value / 100 })}
      />

      <SliderField
        label="まわりの余白"
        value={logo.padding}
        min={0}
        max={3}
        step={1}
        format={(value) => `${value} モジュール`}
        onChange={(padding) => onChange({ ...logo, padding })}
      />

      <SegmentedControl
        legend="座布団の形"
        options={LOGO_FRAME_OPTIONS}
        value={logo.frame}
        onChange={(frame) => onChange({ ...logo, frame })}
      />
    </div>
  );
}
