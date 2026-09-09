import { must } from './dom';

type NoticeId = 'hint' | 'storage' | 'webgl';

interface NoticeSpec {
  readonly title: string;
  readonly body: string;
  readonly actions?: readonly {
    readonly label: string;
    readonly quiet?: boolean;
    readonly onClick: () => void;
  }[];
}

/**
 * The page's non-blocking messages: the multi-tab hint, and the two degraded
 * modes worth telling someone about.
 */
export class Notices {
  private readonly container = must<HTMLElement>('#notices');
  private readonly shown = new Map<NoticeId, HTMLElement>();

  show(id: NoticeId, spec: NoticeSpec): void {
    if (this.shown.has(id)) return;

    const card = document.createElement('section');
    card.className = 'notice';

    const title = document.createElement('h2');
    title.className = 'notice__title';
    title.textContent = spec.title;

    const body = document.createElement('p');
    body.className = 'notice__body';
    body.textContent = spec.body;

    card.append(title, body);

    if (spec.actions?.length) {
      const actions = document.createElement('div');
      actions.className = 'notice__actions';
      for (const action of spec.actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = action.quiet ? 'notice__action notice__action--quiet' : 'notice__action';
        button.textContent = action.label;
        button.addEventListener('click', action.onClick);
        actions.appendChild(button);
      }
      card.appendChild(actions);
    }

    this.container.appendChild(card);
    this.shown.set(id, card);
  }

  hide(id: NoticeId): void {
    const card = this.shown.get(id);
    if (!card) return;
    card.remove();
    this.shown.delete(id);
  }

  has(id: NoticeId): boolean {
    return this.shown.has(id);
  }
}

/**
 * Without this the core mechanic is invisible: a single tab just looks like a
 * screensaver, and nothing on screen suggests that opening another one does
 * anything.
 */
export function multiTabHint(onOpen: () => void, onDismiss: () => void): NoticeSpec {
  return {
    title: 'try this',
    body: 'このページをもう1つのタブで開くと、そのタブぶんの光の群れが両方の画面に増えます。閉じれば消えます。',
    actions: [
      { label: '新しいタブで開く', onClick: onOpen },
      { label: '閉じる', quiet: true, onClick: onDismiss },
    ],
  };
}

export const STORAGE_NOTICE: NoticeSpec = {
  title: 'storage',
  body: 'このブラウザでは保存が使えないため、きらめきとアップグレードはこのタブを閉じるまでの間だけ保持されます。プライベートウィンドウを使っている場合は通常のウィンドウでお試しください。',
};

export const WEBGL_NOTICE: NoticeSpec = {
  title: 'webgl',
  body: 'この環境では3D描画（WebGL）を初期化できなかったため、静止した光だけを表示しています。ブラウザのハードウェアアクセラレーションを有効にすると本来の表示になります。',
};
