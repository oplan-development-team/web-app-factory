import type { RefObject } from 'react';
import type { QrRender } from '../hooks/useQrDesign';
import type { QrDesign } from '../lib/types';
import { QrPreview } from './QrPreview';
import { SafetyPanel } from './SafetyPanel';

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;

interface PreviewStageProps {
  design: QrDesign;
  render: QrRender;
  svgRef: RefObject<SVGSVGElement | null>;
}

export function PreviewStage({ design, render, svgRef }: PreviewStageProps) {
  const { result, mask, safety } = render;

  return (
    <figure className="stage">
      <div className="proof">
        {CORNERS.map((corner) => (
          <span key={corner} className="proof__trim" data-corner={corner} aria-hidden="true" />
        ))}

        <div className="proof__sheet">
          {result.ok ? (
            <QrPreview
              design={design}
              matrix={result.matrix}
              mask={mask}
              svgRef={svgRef}
              className="proof__qr"
            />
          ) : (
            <div className="proof__empty" role="status">
              {result.reason === 'empty' ? (
                <>
                  <p className="proof__empty-title">内容を入力してください</p>
                  <p className="proof__empty-body">
                    URL でもテキストでも構いません。入力するとすぐにここへ表示されます。
                  </p>
                </>
              ) : (
                <>
                  <p className="proof__empty-title">生成できませんでした</p>
                  <p className="proof__empty-body">{result.message}</p>
                  {result.reason === 'overflow' && (
                    <p className="proof__empty-body">
                      内容を短くするか、誤り訂正レベルを下げると収まる場合があります。
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <figcaption className="stage__meta">
        {result.ok ? (
          <>
            <span>バージョン {result.matrix.version}</span>
            <span aria-hidden="true">·</span>
            <span>
              {result.matrix.size} × {result.matrix.size} モジュール
            </span>
            <span aria-hidden="true">·</span>
            <span>訂正レベル {design.ecc}</span>
            {design.eccAuto && <span className="stage__auto">自動</span>}
          </>
        ) : (
          <span>プレビュー待機中</span>
        )}
      </figcaption>

      <SafetyPanel safety={safety} />
    </figure>
  );
}
