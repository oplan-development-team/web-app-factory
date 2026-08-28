import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PageShell } from '../components/layout/PageShell';
import { PageHeader } from '../components/ui/PageHeader';
import { CATEGORY_NAMES } from '../data/types';
import { usePageTitle } from '../lib/usePageTitle';
import './write-page.css';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type FieldName = 'title' | 'category' | 'body';

const FIELD_LABELS: Record<FieldName, string> = {
  title: 'タイトル',
  category: 'カテゴリー',
  body: '本文',
};

/** The summary must use the same verb as the field it links to. */
const FIELD_MESSAGES: Record<FieldName, string> = {
  title: 'タイトルを入力してください',
  category: 'カテゴリーを選択してください',
  body: '本文を入力してください',
};

interface FormValues {
  title: string;
  category: string;
  tags: string;
  body: string;
}

const EMPTY_FORM: FormValues = { title: '', category: '', tags: '', body: '' };

export function WritePage() {
  usePageTitle('コラムを書く');
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [missing, setMissing] = useState<readonly FieldName[]>([]);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  /**
   * Object URLs are revoked explicitly on replace, and once more on unmount.
   *
   * Deliberately not `useEffect(..., [imageUrl])` with a revoke in the
   * cleanup: StrictMode runs effect → cleanup → effect on mount, which would
   * revoke the URL the freshly rendered <img> is still pointing at.
   */
  const setPreview = (url: string | null) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = url;
    setImageUrl(url);
  };

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    },
    [],
  );

  const update = (field: keyof FormValues) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
    if (field !== 'tags') {
      setMissing((current) => current.filter((name) => name !== field));
    }
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setImageError(null);

    if (!file) {
      setImageName(null);
      setPreview(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setImageError('画像ファイルを選んでください（JPEG・PNG・WebPなど）。');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('画像は5MBまでです。小さいサイズのファイルを選び直してください。');
      event.target.value = '';
      return;
    }

    setImageName(file.name);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const blanks = (Object.keys(FIELD_LABELS) as FieldName[]).filter(
      (field) => values[field].trim() === '',
    );

    if (blanks.length > 0) {
      setMissing(blanks);
      // Move the user to the summary so the failure is not silently off-screen.
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    setMissing([]);
    setIsSubmitted(true);
  };

  const resetForm = () => {
    setValues(EMPTY_FORM);
    setMissing([]);
    setImageName(null);
    setPreview(null);
    setImageError(null);
    setIsSubmitted(false);
  };

  const isMissing = (field: FieldName) => missing.includes(field);

  if (isSubmitted) {
    return (
      <PageShell crumbs={[{ label: 'トップ', to: '/' }, { label: 'コラムを書く' }]}>
        <div className="write-done" role="status">
          <svg className="write-done__mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
            <rect x="6" y="10" width="52" height="44" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M6 22h52" stroke="currentColor" strokeWidth="2" />
            <path d="M16 32h20M16 40h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
            <path d="M38 38l7 7 13-15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="label-caps write-done__eyebrow">Submitted</p>
          <h1 className="write-done__title">投稿を受け付けました</h1>
          <p className="write-done__lead">
            「{values.title}」を編集部で確認します。掲載までしばらくお待ちください。
          </p>
          <p className="write-done__note">
            ※ このサイトはデモンストレーションです。入力内容はどこにも保存・送信されておらず、
            コラム一覧にも追加されません。ページを再読み込みすると内容は失われます。
          </p>
          <div className="write-done__actions">
            <button className="press-button" type="button" onClick={resetForm}>
              続けて書く
            </button>
            <Link className="press-button press-button--ghost" to="/">
              トップへ戻る
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell crumbs={[{ label: 'トップ', to: '/' }, { label: 'コラムを書く' }]}>
      <PageHeader
        eyebrow="Write"
        title="コラムを書く"
        lede="日々の気づきを、あなたの言葉で。書き上がったら編集部へお送りください。"
      />

      <form className="write-form" onSubmit={handleSubmit} noValidate>
        {missing.length > 0 ? (
          <div
            className="write-form__summary"
            role="alert"
            tabIndex={-1}
            ref={errorSummaryRef}
          >
            <p className="write-form__summary-title">
              入力されていない項目が {missing.length} つあります
            </p>
            <ul className="write-form__summary-list">
              {missing.map((field) => (
                <li key={field}>
                  <a href={`#field-${field}`}>{FIELD_MESSAGES[field]}</a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="write-field">
          <label className="write-field__label" htmlFor="field-title">
            タイトル
            <span className="write-field__required">必須</span>
          </label>
          <input
            id="field-title"
            className="field-input"
            type="text"
            value={values.title}
            onChange={update('title')}
            aria-invalid={isMissing('title')}
            aria-describedby={isMissing('title') ? 'error-title' : undefined}
            placeholder="例：朝の10分が、わたしを整える"
          />
          {isMissing('title') ? (
            <p className="write-field__error" id="error-title">
              タイトルを入力してください。
            </p>
          ) : null}
        </div>

        <div className="write-field">
          <label className="write-field__label" htmlFor="field-category">
            カテゴリー
            <span className="write-field__required">必須</span>
          </label>
          <select
            id="field-category"
            className="field-input"
            value={values.category}
            onChange={update('category')}
            aria-invalid={isMissing('category')}
            aria-describedby={isMissing('category') ? 'error-category' : undefined}
          >
            <option value="">選択してください</option>
            {CATEGORY_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          {isMissing('category') ? (
            <p className="write-field__error" id="error-category">
              カテゴリーを選択してください。
            </p>
          ) : null}
        </div>

        <div className="write-field">
          <label className="write-field__label" htmlFor="field-tags">
            タグ
            <span className="write-field__optional">任意</span>
          </label>
          <input
            id="field-tags"
            className="field-input"
            type="text"
            value={values.tags}
            onChange={update('tags')}
            placeholder="読点で区切って入力（例：朝時間、習慣）"
          />
          <p className="write-field__hint">最大4つまで。読者がコラムを見つける手がかりになります。</p>
        </div>

        <div className="write-field">
          <label className="write-field__label" htmlFor="field-body">
            本文
            <span className="write-field__required">必須</span>
          </label>
          <textarea
            id="field-body"
            className="field-input write-field__textarea"
            rows={14}
            value={values.body}
            onChange={update('body')}
            aria-invalid={isMissing('body')}
            aria-describedby={isMissing('body') ? 'error-body' : undefined}
            placeholder="書き出しから、思うままに。段落は改行で分けてください。"
          />
          <p className="write-field__hint">
            {values.body.length} 文字・読了 約{Math.max(1, Math.ceil(values.body.length / 500))}分
          </p>
          {isMissing('body') ? (
            <p className="write-field__error" id="error-body">
              本文を入力してください。
            </p>
          ) : null}
        </div>

        <div className="write-field">
          <label className="write-field__label" htmlFor="field-image">
            アイキャッチ画像
            <span className="write-field__optional">任意</span>
          </label>
          <input
            id="field-image"
            className="write-field__file"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            aria-describedby={imageError ? 'error-image' : 'hint-image'}
            aria-invalid={imageError !== null}
          />
          <p className="write-field__hint" id="hint-image">
            5MBまで。選んだ画像はこの画面で確認できるだけで、送信も保存もされません。
          </p>
          {imageError ? (
            <p className="write-field__error" id="error-image" role="alert">
              {imageError}
            </p>
          ) : null}
          {imageUrl ? (
            <figure className="write-field__preview">
              <img src={imageUrl} alt="選択したアイキャッチ画像のプレビュー" />
              <figcaption>{imageName}</figcaption>
            </figure>
          ) : null}
        </div>

        <div className="write-form__actions">
          <p className="write-form__disclaimer">
            送信しても実際には保存されません（デモンストレーションのため）。
          </p>
          <button className="press-button press-button--accent" type="submit">
            編集部に送る
          </button>
        </div>
      </form>
    </PageShell>
  );
}
