import { useId, useRef, useState } from 'react';
import { ACCEPT_ATTRIBUTE, type LoadedImage } from '../lib/image';

interface ImageDropzoneProps {
  image: LoadedImage | null;
  error: string | null;
  isLoading: boolean;
  onSelect: (file: File) => void;
  onClear: () => void;
}

export function ImageDropzone({
  image,
  error,
  isLoading,
  onSelect,
  onClear,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);
  const errorId = useId();

  function handleFiles(files: FileList | null): void {
    const file = files?.[0];
    if (file) onSelect(file);
  }

  return (
    <div
      className={`dropzone-wrap${isDragging ? ' is-dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        // 子要素へ移っただけの dragleave では解除しない
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      {/*
        ドロップ領域自体を button にしている。div + role="button" だと
        Enter / Space の処理を自前で書くことになり、抜けが出やすい。
      */}
      <button
        type="button"
        className="dropzone"
        onClick={() => inputRef.current?.click()}
        aria-describedby={error ? errorId : undefined}
      >
        {image ? (
          <span className="dropzone-loaded">
            <img className="dropzone-thumb" src={image.previewUrl} alt="" />
            <span className="dropzone-meta">
              <span className="dropzone-name">{image.name}</span>
              <span className="numeral dropzone-dimensions">
                {image.width} × {image.height}
              </span>
              <span className="dropzone-swap">クリックまたはドロップで差し替え</span>
            </span>
          </span>
        ) : (
          <span className="dropzone-empty">
            <span className="dropzone-mark" aria-hidden="true" />
            <span className="dropzone-title">
              {isLoading ? '読み込み中…' : '画像をドロップ'}
            </span>
            <span className="dropzone-hint">またはクリックして選択</span>
            <span className="dropzone-formats">PNG / JPEG / WebP / GIF / SVG・20MB まで</span>
          </span>
        )}
      </button>

      {image && (
        <button type="button" className="link-button" onClick={onClear}>
          画像を削除
        </button>
      )}

      <input
        ref={inputRef}
        id="halftone-image-input"
        className="visually-hidden"
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        /*
         * 目に見えない位置にあるので、Tab の順路からは外す。
         * 操作の入口はドロップゾーンの button 側が担っている。
         */
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          handleFiles(event.target.files);
          // 同じファイルを選び直しても change が飛ぶようにする
          event.target.value = '';
        }}
      />

      {error && (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
