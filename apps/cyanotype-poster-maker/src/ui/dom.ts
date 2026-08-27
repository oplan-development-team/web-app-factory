/** DOM 参照の集約。取得に失敗したら起動時点で分かるようにする。 */

export function el<T extends HTMLElement>(id: string, root: ParentNode = document): T {
  const found = root.querySelector<T>(`#${CSS.escape(id)}`);
  if (!found) throw new Error(`要素が見つかりません: #${id}`);
  return found;
}

export function radios(name: string, root: ParentNode = document): HTMLInputElement[] {
  return [...root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];
}

export function checkedRadioValue(name: string, fallback: string, root: ParentNode = document): string {
  return root.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? fallback;
}

export interface Elements {
  cardIntake: HTMLElement;
  tabArchive: HTMLButtonElement;
  tabUpload: HTMLButtonElement;
  paneArchive: HTMLElement;
  paneUpload: HTMLElement;

  plateBook: HTMLElement;
  btnReseed: HTMLButtonElement;
  archiveStatus: HTMLParagraphElement;

  dropzone: HTMLElement;
  fileInput: HTMLInputElement;
  uploadStatus: HTMLParagraphElement;

  revealCards: HTMLElement[];

  rangeContrast: HTMLInputElement;
  outContrast: HTMLOutputElement;
  rangeThreshold: HTMLInputElement;
  outThreshold: HTMLOutputElement;
  inkSwatches: HTMLElement;
  rangeMottle: HTMLInputElement;
  outMottle: HTMLOutputElement;
  rangeGrain: HTMLInputElement;
  outGrain: HTMLOutputElement;
  rangeVignette: HTMLInputElement;
  outVignette: HTMLOutputElement;

  fieldTitle: HTMLInputElement;
  fieldSubtitle: HTMLInputElement;
  fieldLocality: HTMLInputElement;
  fieldLat: HTMLInputElement;
  fieldLon: HTMLInputElement;
  fieldDate: HTMLInputElement;
  fieldSpecimenNo: HTMLInputElement;
  btnGeolocate: HTMLButtonElement;
  geoStatus: HTMLParagraphElement;

  btnExport: HTMLButtonElement;
  exportStatus: HTMLParagraphElement;

  previewCanvas: HTMLCanvasElement;
  stageEmpty: HTMLElement;
  stageLoading: HTMLElement;
  stageLoadingText: HTMLElement;
}

export function collectElements(root: ParentNode = document): Elements {
  return {
    cardIntake: el<HTMLElement>('cardIntake', root),
    tabArchive: el<HTMLButtonElement>('tabArchive', root),
    tabUpload: el<HTMLButtonElement>('tabUpload', root),
    paneArchive: el<HTMLElement>('paneArchive', root),
    paneUpload: el<HTMLElement>('paneUpload', root),

    plateBook: el<HTMLElement>('plateBook', root),
    btnReseed: el<HTMLButtonElement>('btnReseed', root),
    archiveStatus: el<HTMLParagraphElement>('archiveStatus', root),

    dropzone: el<HTMLElement>('dropzone', root),
    fileInput: el<HTMLInputElement>('fileInput', root),
    uploadStatus: el<HTMLParagraphElement>('uploadStatus', root),

    revealCards: ['cardTone', 'cardInk', 'cardTexture', 'cardLayout', 'cardLabel', 'cardExport'].map((id) =>
      el<HTMLElement>(id, root),
    ),

    rangeContrast: el<HTMLInputElement>('rangeContrast', root),
    outContrast: el<HTMLOutputElement>('outContrast', root),
    rangeThreshold: el<HTMLInputElement>('rangeThreshold', root),
    outThreshold: el<HTMLOutputElement>('outThreshold', root),
    inkSwatches: el<HTMLElement>('inkSwatches', root),
    rangeMottle: el<HTMLInputElement>('rangeMottle', root),
    outMottle: el<HTMLOutputElement>('outMottle', root),
    rangeGrain: el<HTMLInputElement>('rangeGrain', root),
    outGrain: el<HTMLOutputElement>('outGrain', root),
    rangeVignette: el<HTMLInputElement>('rangeVignette', root),
    outVignette: el<HTMLOutputElement>('outVignette', root),

    fieldTitle: el<HTMLInputElement>('fieldTitle', root),
    fieldSubtitle: el<HTMLInputElement>('fieldSubtitle', root),
    fieldLocality: el<HTMLInputElement>('fieldLocality', root),
    fieldLat: el<HTMLInputElement>('fieldLat', root),
    fieldLon: el<HTMLInputElement>('fieldLon', root),
    fieldDate: el<HTMLInputElement>('fieldDate', root),
    fieldSpecimenNo: el<HTMLInputElement>('fieldSpecimenNo', root),
    btnGeolocate: el<HTMLButtonElement>('btnGeolocate', root),
    geoStatus: el<HTMLParagraphElement>('geoStatus', root),

    btnExport: el<HTMLButtonElement>('btnExport', root),
    exportStatus: el<HTMLParagraphElement>('exportStatus', root),

    previewCanvas: el<HTMLCanvasElement>('previewCanvas', root),
    stageEmpty: el<HTMLElement>('stageEmpty', root),
    stageLoading: el<HTMLElement>('stageLoading', root),
    stageLoadingText: el<HTMLElement>('stageLoadingText', root),
  };
}

export type StatusTone = 'success' | 'error' | 'info';

/** 進行・結果の通知（FR-603, FR-604）。無言で失敗させない。 */
export function setStatus(node: HTMLElement, message: string, tone: StatusTone = 'info'): void {
  node.hidden = false;
  node.textContent = message;
  node.dataset['tone'] = tone === 'info' ? '' : tone;
}

export function clearStatus(node: HTMLElement): void {
  node.hidden = true;
  node.textContent = '';
  node.dataset['tone'] = '';
}
