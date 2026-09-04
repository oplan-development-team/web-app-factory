/** Decorative registration marks (crosshair + circle) at the poster corners. */
export function drawRegistrationMarks(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const inset = Math.max(18, width * 0.03);
  const size = Math.max(9, width * 0.013);
  const corners: Array<[number, number]> = [
    [inset, inset],
    [width - inset, inset],
    [inset, height - inset],
    [width - inset, height - inset],
  ];

  ctx.save();
  ctx.strokeStyle = 'rgba(17,17,17,0.82)';
  ctx.lineWidth = Math.max(1, width * 0.0016);
  for (const [x, y] of corners) {
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
