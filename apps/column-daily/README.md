# The Column Daily

ヴィンテージ新聞・エディトリアル意匠のコラムメディアサイト。
**バックエンドを持たない、完全クライアントサイド完結のデモアプリ**です。

<https://oplan-development-team.github.io/web-app-factory/column-daily/>

## これは何か

「言葉がつくる、わたしの景色。」を掲げるコラムメディアの体裁で、記事の閲覧・検索・
カテゴリー別一覧・連載一覧・投稿フォームまでを一通り触れるようにしたものです。
記事・著者・数値はすべて架空で、投稿しても保存されず、ログイン・会員登録も行われません。

## デザイン方向

方向は **エディトリアル（ヴィンテージ新聞）** 一本にコミットしています。

| 要素 | 決定 |
|---|---|
| ロゴ | `UnifrakturCook` 700（重厚なブラックレター）。欧文のみに限定 |
| 見出し・本文 | `Shippori Mincho` 400 / 700（和欧共通） |
| 紙 | 多層グラデーション + SVGノイズのオーバーレイ + ヴィネット。ページ全体は濃茶色の台紙（デスク）の上に載った、角丸・ドロップシャドウ付きの1枚の紙として構成する |
| ナビゲーション | 黒帯ではなく紙色の帯。現在地と「マイページ」だけを黒いピル型ブロックで強調する |
| インク | 墨 `#1c1a17` |
| アクセント | 朱色がかったオックスブラッド `#6b1108`。EDITOR'S PICK / 必須・エラーのみに使う（ナビの現在地やランキング数字には使わない — 墨色で統一） |
| 罫線 | 1px罫と3px二重罫。`border-radius` は原則 0（台紙・カード等の一部コンポーネントを除く） |
| モーション | 初回ロードの「刷り上がり」演出ひとつ。ホバーは浮かせず沈める |

`prefers-reduced-motion: reduce` ですべての動きが止まります。

## 記事の挿絵について

外部画像をランタイムに取得しません。18記事それぞれに、Picsum Photos
（`https://picsum.photos/id/{id}/1200/800` 経由・Unsplash由来でUnsplash Licenseに準拠、商用利用・改変も許諾）
から記事の雰囲気に合わせて選んだ1枚を**ビルド時に静的アセットとしてバンドル**しています
（`src/assets/photos/`、`src/data/photos.ts` で記事IDと対応付け）。同じ記事は常に同じ写真になります。

## 技術スタック

- Vite 8 + React 18 + TypeScript（`strict: true`）
- `react-router-dom` 7 / **HashRouter**
- 状態管理ライブラリなし（素の React state。検索クエリは URL の `?q=` に持たせています）
- CSS は素のカスタムプロパティ。UIフレームワークなし

### なぜ HashRouter か

GitHub Pages は SPA の history fallback を提供しません。`base: './'` と組み合わせて
`/web-app-factory/column-daily/` のサブパス配信でも全ルートが直接開けるよう HashRouter を
採用しています。同じ成果物が nginx コンテナでもそのまま動き、runtime 側に
`try_files` の設定が不要になります。

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run build      # tsc -b && vite build → dist/
npm run preview    # dist/ をローカル配信
```

## Docker

```bash
docker build -t column-daily .
docker run --rm -p 8080:80 column-daily
# http://localhost:8080
```

## ページ

| ルート | 内容 |
|---|---|
| `/` | トップ（特集 + 新着4件 + サイドバー） |
| `/articles/:id` | 記事詳細 |
| `/latest` `/popular` | 新着 / 人気の全件一覧 |
| `/category/:slug` | カテゴリー別一覧（8種） |
| `/tag/:tag` | タグ別一覧 |
| `/series` | 連載一覧 |
| `/search?q=` | タイトル検索（クライアントサイド） |
| `/write` | 投稿フォーム（**保存されません**） |
| `/login` `/register` `/mypage` | ダミー画面（**認証は行いません**） |

## デモとしての制約

- 記事データは `src/data/articles.ts` の静的な 18 件のみ
- 公開日は「今日から N 日前」として算出しています。"TODAY'S PAPER" を掲げる紙面で
  固定日付を使うと、数週間で最新記事が過去のものになってしまうためです
- ログイン・会員登録・マイページには**認証情報の入力欄を一切置いていません**。
  バックエンドが存在しない画面にパスワード欄を出すと、実在のパスワードを入力させる
  誘導になりかねないためです
- 投稿フォームの画像は選択した端末上でプレビューするだけで、送信も保存もしません

## 仕様ドキュメント

- [SPEC.md](./SPEC.md) — 要件と受け入れ基準
- [PLAN.md](./PLAN.md) — 設計と検証計画
- [TASKS.md](./TASKS.md) — タスク分割と進捗
