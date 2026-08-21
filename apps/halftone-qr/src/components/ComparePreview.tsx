import type { ReactNode } from 'react';
import type { HalftoneQrModel } from '../hooks/useHalftoneQr';
import { GridCanvas } from './GridCanvas';

interface PaneProps {
  caption: string;
  note: string;
  children: ReactNode;
}

function Pane({ caption, note, children }: PaneProps) {
  return (
    <figure className="pane">
      <div className="pane-stage">{children}</div>
      <figcaption className="pane-caption">
        <span className="pane-title">{caption}</span>
        <span className="pane-note">{note}</span>
      </figcaption>
    </figure>
  );
}

function Placeholder({ children }: { children: ReactNode }) {
  return <div className="pane-placeholder">{children}</div>;
}

export function ComparePreview({
  matrix,
  plainGrid,
  halftoneGrid,
  isEmpty,
  qrError,
  image,
}: HalftoneQrModel) {
  return (
    <div className="compare">
      <Pane caption="変換前" note="通常の QR コード">
        {matrix && plainGrid ? (
          <GridCanvas
            grid={plainGrid}
            moduleCount={matrix.size}
            ariaLabel="変換前の通常の QR コード"
          />
        ) : (
          <Placeholder>
            {isEmpty ? 'テキストを入力してください' : (qrError ?? '生成できません')}
          </Placeholder>
        )}
      </Pane>

      <Pane caption="変換後" note="ハーフトーン QR コード">
        {matrix && halftoneGrid ? (
          <GridCanvas
            grid={halftoneGrid}
            moduleCount={matrix.size}
            ariaLabel="画像をハーフトーン化して埋め込んだ QR コード"
          />
        ) : (
          <Placeholder>
            {image === null ? '画像を選択してください' : '生成できません'}
          </Placeholder>
        )}
      </Pane>
    </div>
  );
}
