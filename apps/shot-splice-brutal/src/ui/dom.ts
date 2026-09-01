function el<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) {
    throw new Error(`必須要素が見つからない: ${selector}`);
  }
  return found;
}

export const dom = {
  fileTop: el<HTMLInputElement>('#file-top'),
  fileBottom: el<HTMLInputElement>('#file-bottom'),
  slotTop: el<HTMLDivElement>('#slot-top'),
  slotBottom: el<HTMLDivElement>('#slot-bottom'),

  btnSwap: el<HTMLButtonElement>('#btn-swap'),
  btnClear: el<HTMLButtonElement>('#btn-clear'),
  btnDetect: el<HTMLButtonElement>('#btn-detect'),
  btnDownload: el<HTMLButtonElement>('#btn-download'),

  inputCutTop: el<HTMLInputElement>('#input-cut-top'),
  inputCutBottom: el<HTMLInputElement>('#input-cut-bottom'),
  inputOverlap: el<HTMLInputElement>('#input-overlap'),

  toggleFront: el<HTMLDivElement>('#toggle-front'),
  toggleDiff: el<HTMLInputElement>('#toggle-diff'),

  readoutSize: el<HTMLSpanElement>('#readout-size'),
  readoutOverlap: el<HTMLSpanElement>('#readout-overlap'),

  stageHint: el<HTMLParagraphElement>('#stage-hint'),
  stageStatus: el<HTMLDivElement>('#stage-status'),
  stageViewport: el<HTMLDivElement>('#stage-viewport'),
  stageEmpty: el<HTMLDivElement>('#stage-empty'),

  spliceFrame: el<HTMLDivElement>('#splice-frame'),
  layerTopWrap: el<HTMLDivElement>('#layer-top-wrap'),
  layerBottomWrap: el<HTMLDivElement>('#layer-bottom-wrap'),
  layerTop: el<HTMLImageElement>('#layer-top'),
  layerBottom: el<HTMLImageElement>('#layer-bottom'),
  seamHandle: el<HTMLDivElement>('#seam-handle'),

  toast: el<HTMLDivElement>('#toast'),
};

function slotBody(slot: HTMLDivElement) {
  return {
    thumb: slot.querySelector<HTMLImageElement>('.slot-thumb')!,
    meta: slot.querySelector<HTMLParagraphElement>('.slot-meta')!,
  };
}

export const slotTopBody = slotBody(dom.slotTop);
export const slotBottomBody = slotBody(dom.slotBottom);
