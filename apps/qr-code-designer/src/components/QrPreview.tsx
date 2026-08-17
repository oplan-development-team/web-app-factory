import { useId, useMemo, type Ref } from 'react';
import { rrPath, uniformCorners } from '../lib/geometry';
import { buildBodyPath, buildEyeBallPath, buildEyeFramePath, type LogoMask } from '../lib/paths';
import type { QrMatrix } from '../lib/qr';
import type { LogoFrame, QrDesign } from '../lib/types';
import { PaintDef, paintFill } from './PaintDef';

function logoFrameCorners(frame: LogoFrame, side: number) {
  switch (frame) {
    case 'circle':
      return uniformCorners(side / 2);
    case 'rounded':
      return uniformCorners(side * 0.18);
    default:
      return uniformCorners(0);
  }
}

interface QrPreviewProps {
  design: QrDesign;
  matrix: QrMatrix;
  mask: LogoMask | null;
  svgRef?: Ref<SVGSVGElement>;
  className?: string;
}

export function QrPreview({ design, matrix, mask, svgRef, className }: QrPreviewProps) {
  // React's generated ids contain colons, which are awkward inside `url(#...)`.
  const uid = useId().replace(/:/g, '');
  const offset = design.margin;
  const total = matrix.size + offset * 2;

  const bodyId = `${uid}-body`;
  const bgId = `${uid}-bg`;
  const frameId = `${uid}-frame`;
  const ballId = `${uid}-ball`;

  const bodyPath = useMemo(
    () => buildBodyPath(matrix, design.dotStyle, mask, offset),
    [matrix, design.dotStyle, mask, offset],
  );
  const eyeFramePath = useMemo(
    () => buildEyeFramePath(matrix.size, design.eyeFrameStyle, offset),
    [matrix.size, design.eyeFrameStyle, offset],
  );
  const eyeBallPath = useMemo(
    () => buildEyeBallPath(matrix.size, design.eyeBallStyle, offset),
    [matrix.size, design.eyeBallStyle, offset],
  );

  const framePaint = design.eyeInherit ? design.bodyPaint : design.eyeFramePaint;
  const ballPaint = design.eyeInherit ? design.bodyPaint : design.eyeBallPaint;
  const resolvedFrameId = design.eyeInherit ? bodyId : frameId;
  const resolvedBallId = design.eyeInherit ? bodyId : ballId;

  const logo = design.logo;
  const logoSide = logo ? matrix.size * logo.sizeRatio : 0;
  const logoStart = offset + (matrix.size - logoSide) / 2;
  const backdropFill = design.background === null ? '#ffffff' : paintFill(design.background, bgId);

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${total} ${total}`}
      className={className}
      role="img"
      aria-label={`QR コードのプレビュー: ${design.text.trim() || '（未入力）'}`}
    >
      <defs>
        {design.background && (
          <PaintDef id={bgId} paint={design.background} origin={0} span={total} />
        )}
        <PaintDef id={bodyId} paint={design.bodyPaint} origin={offset} span={matrix.size} />
        {!design.eyeInherit && (
          <>
            <PaintDef id={frameId} paint={framePaint} origin={offset} span={matrix.size} />
            <PaintDef id={ballId} paint={ballPaint} origin={offset} span={matrix.size} />
          </>
        )}
      </defs>

      {design.background && (
        <rect x={0} y={0} width={total} height={total} fill={paintFill(design.background, bgId)} />
      )}

      <path d={bodyPath} fill={paintFill(design.bodyPaint, bodyId)} />
      <path d={eyeFramePath} fillRule="evenodd" fill={paintFill(framePaint, resolvedFrameId)} />
      <path d={eyeBallPath} fill={paintFill(ballPaint, resolvedBallId)} />

      {logo && mask && (
        <>
          {logo.frame !== 'none' && (
            <path
              d={rrPath(
                mask.x + offset,
                mask.y + offset,
                mask.size,
                mask.size,
                logoFrameCorners(logo.frame, mask.size),
              )}
              fill={backdropFill}
            />
          )}
          <image
            href={logo.dataUrl}
            x={logoStart}
            y={logoStart}
            width={logoSide}
            height={logoSide}
            preserveAspectRatio="xMidYMid meet"
          />
        </>
      )}
    </svg>
  );
}
