# PLAN — The Column Daily

SPEC: `./SPEC.md`

---

## 1. アーキテクチャ

完全クライアントサイドの SPA。サーバー・永続化層を持たない。

```
静的記事データ (src/data/articles.ts)
        │
        ├─ 導出セレクタ (src/lib/selectors.ts)  … 新着順 / 人気順 / カテゴリ別 / 連載別 / タグ集計
        │
        └─ 検索 (src/lib/search.ts)             … タイトル部分一致
                     │
              ページコンポーネント (src/pages/*)
                     │
              表示コンポーネント (src/components/*)
                     │
              デザイントークン (src/styles/tokens.css)
```

- **状態管理**: 素の React state のみ。グローバルストアは導入しない（YAGNI）。
  唯一の共有状態候補である「検索クエリ」は URL (`?q=`) に持たせる（URL as state）。
- **ルーティング**: `HashRouter`。理由は SPEC DEP-05 の設計判断に記載。
- **データフロー**: 記事データは import した不変の定数。ミューテーションを行わない。
  導出値（並び替え・絞り込み）はセレクタ関数が新しい配列を返す。

## 2. 技術選定

| 項目 | 選定 | 理由 |
|---|---|---|
| ビルド | Vite 5 | New_Service_App 既存アプリと揃える |
| UI | React 18 + TypeScript strict | 複数ページ・条件分岐が多く、素の DOM より保守しやすい |
| ルーター | `react-router-dom` 6（HashRouter） | GitHub Pages サブパス配信で history fallback 不要 |
| CSS | 素の CSS + カスタムプロパティ | Tailwind 等はデフォルト意匠に引っ張られる（Anti-Template Policy）。 新聞的な罫線・二重罫・網点は手書き CSS の方が意図を通しやすい |
| 記事画像 | 自前のインライン SVG 生成 | 外部フェッチ禁止。かつ「グレーの箱」を避け、意匠として成立させるため |
| フォント | Google Fonts（`UnifrakturCook`, `Shippori Mincho`） | 2 ファミリのみ。取得失敗時はローカルの明朝/セリフへフォールバック |

**フォントに関する注意**: Google Fonts はブラウザ実行時に CSS/フォントを取得する。
これは「記事画像を外部フェッチしない」という要件とは別軸で、Web フォントとして一般的な扱い。
オフライン時も `serif` 系フォールバックで読める状態を保つ。

## 3. モジュール設計

```
src/
├── main.tsx                     エントリ
├── App.tsx                      HashRouter + ルート定義 + ScrollToTop
├── data/
│   ├── types.ts                 Article / Category / SeriesId 型
│   ├── categories.ts            8 カテゴリ定義（slug / label / アイコン）
│   └── articles.ts              ダミー記事 18 件
├── lib/
│   ├── selectors.ts             並び替え・絞り込み・タグ集計
│   ├── search.ts                タイトル部分一致検索
│   ├── format.ts                日付整形（YYYY.MM.DD / YYYY年M月D日 曜日）
│   └── seed.ts                  記事IDから決定的な擬似乱数を作る
├── components/
│   ├── layout/  SiteHeader / NavBand / SiteFooter / PageShell
│   ├── article/ ArticleImage / FeatureArticle / ArticleCard / ArticleListRow
│   ├── sidebar/ RankingPanel / CategoryPanel / TagPanel / Sidebar
│   └── ui/      SectionHeading / CategoryTag / AuthorLine / EmptyState / NotFound
├── pages/
│   ├── HomePage / ArticlePage / CategoryPage / ListPage
│   ├── SeriesPage / SearchPage / WritePage / DemoAccountPage / NotFoundPage
└── styles/
    ├── tokens.css               色・タイポ・余白・モーションのカスタムプロパティ
    ├── typography.css           フォント指定とスケール
    └── global.css               リセット・紙テクスチャ・共通罫線・フォーカスリング
```

ファイルは 200〜400 行を目安、上限 800 行。`articles.ts` はデータのため長くなるが、
ロジックを持たないので許容する。

## 4. 記事画像の実装方針（FR-02）

- `ArticleImage` は `category` と `id` を受け取り、`seed.ts` の決定的ハッシュから
  数値列を作って SVG のレイアウトを揺らす。実行時 `Math.random()` は使わない。
- カテゴリごとに 8 種のモチーフ（窓辺 / ノートとペン / 机上 / 皿 / 山道 / 棚と鉢 / 本棚 / 抽象）。
- 全体にセピア二階調のパレットを適用し、`<pattern>` の網点を重ねて新聞写真に寄せる。
- `role="img"` + `aria-label` を付け、装飾ではなく内容を持つ画像として扱う。

## 5. リスクと対応

| リスク | 対応 |
|---|---|
| ブラックレターは和文を持たないため、ロゴ以外に使うと文字化けする | `UnifrakturCook` の適用は `.masthead-logo` の欧文文字列のみに限定する |
| CJK Web フォントは重い | Google Fonts の動的サブセットに任せ、ウェイトは 400/700 の 2 つに絞る |
| 4 カラム段組が狭幅で破綻 | `grid-template-columns` を段階的に 4→2→1 に落とし、`min-width: 0` を明示して overflow を防ぐ |
| SVG 画像が「AIっぽい抽象グラデ」に見える | 具象モチーフ + 網点 + 硬い枠で印刷物寄りに倒す。DR-03 に従い角丸を使わない |
| HashRouter の URL 見た目 | プレビュー用途では許容。SPEC で理由を明文化済み |

## 6. 検証計画

| 段階 | 方法 |
|---|---|
| 型・ビルド | `npm run build`（`tsc -b` を含む） |
| ランタイム | `vite preview` を起動し、Playwright で全ルートを巡回してコンソールエラーを収集 |
| レスポンシブ | 375 / 768 / 1024 / 1440 で `scrollWidth > clientWidth` を検査 |
| 挙動 | 検索 / 投稿フォームのバリデーションと成功表示 / Not Found を Playwright で操作検証 |
| コンテナ | `docker build` → 起動 → トップ取得を確認し、image / container を削除 |
| 意匠 | 各ブレークポイントのスクリーンショットを参考画像と突き合わせ |
