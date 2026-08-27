import type { SourceKind } from '../types';

export interface IntakeNodes {
  tabArchive: HTMLButtonElement;
  tabUpload: HTMLButtonElement;
  paneArchive: HTMLElement;
  paneUpload: HTMLElement;
}

/**
 * 「所蔵標本」「持ち込み」の切り替え（FR-101）。
 *
 * タブ相当なので、矢印キーで移動できるようにする（FR-607）。
 * ARIA のタブは、選択中のタブだけが Tab 順に入り、左右キーで移動するのが
 * 想定されている挙動。
 */
export class IntakeTabs {
  private readonly nodes: IntakeNodes;
  private readonly onChange: (kind: SourceKind) => void;
  private current: SourceKind = 'specimen';

  constructor(nodes: IntakeNodes, onChange: (kind: SourceKind) => void) {
    this.nodes = nodes;
    this.onChange = onChange;
    this.bind();
    this.apply('specimen');
  }

  private bind(): void {
    const pairs: Array<[HTMLButtonElement, SourceKind]> = [
      [this.nodes.tabArchive, 'specimen'],
      [this.nodes.tabUpload, 'upload'],
    ];

    for (const [button, kind] of pairs) {
      button.addEventListener('click', () => this.select(kind));
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        this.select(kind === 'specimen' ? 'upload' : 'specimen', true);
      });
    }
  }

  select(kind: SourceKind, focus = false): void {
    if (kind === this.current && !focus) {
      this.onChange(kind);
      return;
    }
    this.apply(kind);
    if (focus) this.activeTab().focus();
    this.onChange(kind);
  }

  private activeTab(): HTMLButtonElement {
    return this.current === 'specimen' ? this.nodes.tabArchive : this.nodes.tabUpload;
  }

  private apply(kind: SourceKind): void {
    this.current = kind;
    const isArchive = kind === 'specimen';

    this.setTab(this.nodes.tabArchive, isArchive);
    this.setTab(this.nodes.tabUpload, !isArchive);
    this.nodes.paneArchive.hidden = !isArchive;
    this.nodes.paneUpload.hidden = isArchive;
  }

  private setTab(button: HTMLButtonElement, active: boolean): void {
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  }

  get kind(): SourceKind {
    return this.current;
  }
}

export interface DropzoneNodes {
  dropzone: HTMLElement;
  fileInput: HTMLInputElement;
}

/** ドラッグ&ドロップ／クリック／キーボードのいずれでも受け付ける（FR-110.1）。 */
export function bindDropzone(nodes: DropzoneNodes, onFile: (file: File) => void): void {
  const { dropzone, fileInput } = nodes;

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    fileInput.click();
  });

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    const file = event.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) onFile(file);
    // 同じファイルを続けて選び直せるようにする
    fileInput.value = '';
  });
}
