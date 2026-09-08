import { makeRandom } from '../domain/cluster';
import type { ClusterView } from '../domain/types';

const SIZE = 64;
const TAU = Math.PI * 2;

/**
 * Paints this tab's own cluster into its favicon.
 *
 * This is the only place the garden is visible while the tab sits in the
 * background, so it is drawn much coarser than the scene: at 16 CSS pixels in a
 * tab strip, anything beyond a core and a few motes is mud.
 */
export class FaviconPainter {
  private canvas: HTMLCanvasElement | null = null;
  private link: HTMLLinkElement | null = null;
  private lastSignature = '';

  constructor(private readonly doc: Document = document) {}

  /** Redraws only when the visible state actually changed. */
  update(cluster: ClusterView | null, haloScale: number): void {
    if (!cluster) return;
    const signature = `${cluster.stage}|${cluster.hue.join(',')}|${haloScale.toFixed(2)}`;
    if (signature === this.lastSignature) return;

    const canvas = this.ensureCanvas();
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    this.paint(ctx, cluster, haloScale);

    try {
      this.ensureLink().href = canvas.toDataURL('image/png');
      this.lastSignature = signature;
    } catch {
      // A tainted canvas or a browser that refuses data: icons is not worth
      // breaking the tick loop over.
    }
  }

  private paint(ctx: CanvasRenderingContext2D, cluster: ClusterView, haloScale: number): void {
    const [r, g, b] = cluster.hue.map((c) => Math.round(c * 255));
    const rgb = `${r}, ${g}, ${b}`;
    const centre = SIZE / 2;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Halo first, so the core sits on top of its own glow.
    const haloRadius = Math.min(centre, (14 + cluster.stage * 4) * haloScale);
    const halo = ctx.createRadialGradient(centre, centre, 0, centre, centre, haloRadius);
    halo.addColorStop(0, `rgba(${rgb}, 0.55)`);
    halo.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(centre, centre, haloRadius, 0, TAU);
    ctx.fill();

    const coreRadius = 7 + cluster.stage * 2.2;
    const core = ctx.createRadialGradient(
      centre - coreRadius * 0.25,
      centre - coreRadius * 0.3,
      0,
      centre,
      centre,
      coreRadius,
    );
    core.addColorStop(0, 'rgba(255, 255, 255, 1)');
    core.addColorStop(0.55, `rgba(${rgb}, 1)`);
    core.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(centre, centre, coreRadius, 0, TAU);
    ctx.fill();

    // One mote per growth stage, placed deterministically around the core.
    const rnd = makeRandom(cluster.seed ^ 0x0badf00d);
    for (let i = 0; i < cluster.stage; i++) {
      const angle = rnd() * TAU;
      const distance = coreRadius + 6 + rnd() * 10;
      const x = centre + Math.cos(angle) * distance;
      const y = centre + Math.sin(angle) * distance;
      const radius = 2.2 + rnd() * 2;
      const mote = ctx.createRadialGradient(x, y, 0, x, y, radius);
      mote.addColorStop(0, 'rgba(255, 255, 255, 1)');
      mote.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = mote;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    }
  }

  private ensureCanvas(): HTMLCanvasElement | null {
    if (this.canvas) return this.canvas;
    const canvas = this.doc.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    this.canvas = canvas;
    return canvas;
  }

  private ensureLink(): HTMLLinkElement {
    if (this.link && this.link.isConnected) return this.link;
    let link = this.doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.rel = 'icon';
      this.doc.head.appendChild(link);
    }
    link.type = 'image/png';
    this.link = link;
    return link;
  }
}
