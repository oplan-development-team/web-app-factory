import { renderPoster, type RenderParams } from '../core/compose';
import { LAYOUT_SIZES, PREVIEW_MAX_WIDTH } from '../core/presets';
import type { LayoutId } from '../types';

export interface StageNodes {
  canvas: HTMLCanvasElement;
  empty: HTMLElement;
  loading: HTMLElement;
  loadingText: HTMLElement;
}

export function previewSizeFor(layout: LayoutId): { width: number; height: number } {
  const base = LAYOUT_SIZES[layout];
  const width = Math.min(PREVIEW_MAX_WIDTH, base.width);
  return { width, height: Math.round(width * (base.height / base.width)) };
}

/**
 * プレビュー面の制御。
 *
 * 再描画は requestAnimationFrame で 1 フレーム 1 回に束ねる（FR-605）。
 * スライダーを連続で動かすと input が毎ミリ秒飛んでくるので、束ねないと
 * 1 フレーム中に重い誤差拡散を何度も走らせることになる。
 */
export class Stage {
  private queued = false;
  private renderCount = 0;
  private readonly nodes: StageNodes;
  private readonly getParams: () => RenderParams | null;

  constructor(nodes: StageNodes, getParams: () => RenderParams | null) {
    this.nodes = nodes;
    this.getParams = getParams;
  }

  schedule(): void {
    if (this.queued) return;
    this.queued = true;
    requestAnimationFrame(() => {
      this.queued = false;
      this.renderNow();
    });
  }

  /** テストや書き出し直前など、フレームを待たずに描きたいとき。 */
  renderNow(): void {
    const params = this.getParams();
    if (!params || !params.source) {
      this.showEmpty();
      return;
    }

    const ctx = this.nodes.canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = previewSizeFor(params.layout);
    renderPoster(ctx, width, height, params);

    this.nodes.empty.hidden = true;
    this.renderCount += 1;
    // E2E から「再描画が終わったか」を待てるようにする。状態が ready に
    // なるのを待つだけでは、再描画前の古い内容にアサーションが当たる。
    this.nodes.canvas.dataset['renderCount'] = String(this.renderCount);
  }

  showEmpty(): void {
    this.nodes.empty.hidden = false;
  }

  /** 重い処理の前に、何が起きているかを述べる（FR-602）。 */
  showLoading(message: string): void {
    this.nodes.loadingText.textContent = message;
    this.nodes.loading.hidden = false;
  }

  hideLoading(): void {
    this.nodes.loading.hidden = true;
  }

  /**
   * 進行表示が実際に描画されてから重い処理へ入る（FR-602.1）。
   * 同期的に重い描画を始めると、表示したはずの文字が一度も画面に出ない。
   */
  async yieldFrame(): Promise<void> {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  get renders(): number {
    return this.renderCount;
  }
}
