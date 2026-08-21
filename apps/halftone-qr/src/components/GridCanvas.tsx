import { useEffect, useRef } from 'react';
import { drawGrid, pxPerSubFor } from '../lib/render';

/** プレビューの目標ピクセル数。整数倍に丸めるので実寸はこれ以下になる */
const PREVIEW_TARGET_PX = 900;

interface GridCanvasProps {
  grid: Uint8Array;
  moduleCount: number;
  ariaLabel: string;
}

export function GridCanvas({ grid, moduleCount, ariaLabel }: GridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawGrid(canvas, grid, moduleCount, pxPerSubFor(moduleCount, PREVIEW_TARGET_PX));
  }, [grid, moduleCount]);

  return (
    <canvas ref={canvasRef} className="grid-canvas" role="img" aria-label={ariaLabel} />
  );
}
