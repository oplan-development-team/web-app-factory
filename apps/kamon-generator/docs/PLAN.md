# PLAN: 家紋帳 — オリジナル家紋ジェネレーター

対応 SPEC: `./SPEC.md`

---

## 1. 前提：プロトタイプからの差分方針

本実装はゼロからの作り直しではなく、**プロトタイプの資産を引き継いだ本番化**である。

### 引き継ぐもの（変更しない）

- 「家紋帳の見開き」というエディトリアル体験（左＝編む／綴じ目／右＝紋 1 点）
- 和紙オフホワイト × 墨 × 朱の単一アクセント配色、Noto Serif JP + Cormorant Garamond の 2 書体
- 角印を模した書き出しボタン、図版番号（Plate No.）というメタファ
- 決定的生成（FNV-1a + mulberry32）とシード + バリアントという操作モデル
- Vite + TypeScript vanilla、バックエンドなし、Docker マルチステージ配信
- 3 配色プリセットのみという制約（単色エンブレム要件）

### 本番化のために変える／足すもの

| # | 課題（プロトタイプ） | 本実装での対応 | 対応 SPEC |
|---|---|---|---|
| P1 | 生成物が「小図形の散布」で家紋に見えない | 生成モデルを面優先・少数要素・中心接触・高充填へ全面置換 | FR-101〜FR-104 |
| P2 | 線幅 1.6〜6（直径比 0.4〜1.5%）で細すぎる | stroke は意匠線のみ、最小 9 単位（直径比 2.25%）を強制 | FR-101.3 |
| P3 | 描画プリミティブ最大 42 個 | 8 個以下に上限を設け、テストで強制 | FR-102.1 |
| P4 | モチーフが petal/diamond/circle/cross の 4 種の幾何片のみ | 実在紋の分類（植物・動物・器物・幾何）に沿う 14 モチーフへ刷新 | FR-120 |
| P5 | 中心モチーフと外周モチーフを独立に抽選し混在 | 1 紋 1 モチーフに固定 | FR-102.3 |
| P6 | 外郭が細い円 1〜2 本（線幅 2.4 / 1.2） | 丸・二重丸・隅切り角・亀甲・無しの 5 種、線幅 10〜20 | FR-110 |
| P7 | 紋に呼称がなく「中心：菱 外周：丸」という機械的説明のみ | 構造から「丸に三つ柏」形式の紋名を決定的に組み立て | FR-150 |
| P8 | 履歴がセッション限りで消える | localStorage 永続化（シード + バリアントのみ保存し再生成） | FR-301 |
| P9 | 書き出しが SVG のみ | PNG（1200px、Canvas、外部依存なし）を追加 | FR-400.2 |
| P10 | 状態が空/表示の 2 値でローディングがない | empty / drafting / ready / error の 4 状態機械。drafting は割り出し線 | FR-500 |
| P11 | 図版帖の項目が `div[role=button]` | `<button>` へ。キーボード到達性を確保 | FR-601 |
| P12 | 同一シード・同一バリアントでも履歴が増える | 重複記録を抑止 | FR-300.2 |
| P13 | `tsconfig` に `strict` がない／DOM 取得が無検査 `as` | `strict` + `noUncheckedIndexedAccess`、検査付き取得ヘルパ | NFR-008.1, .2 |
| P14 | テストが 1 件も無い | 単体／統合／E2E を整備、カバレッジ 80% しきい値 | NFR-008.3, .4 |
| P15 | `vite.config.ts` が無く `base` 未設定 | 追加して `base: './'` | NFR-002.2 |
| P16 | シード正規化がなく結合文字で紋が変わる | NFC 正規化を生成入口に置く | FR-002.2 |
| P17 | `lib/` が 3 ファイルに密集し責務が混在 | 幾何・モチーフ・構成・描画・永続化・書き出しに分割 | NFR-008.5 |

---

## 2. アーキテクチャ

```
src/
├── main.ts                  # ブートストラップのみ（薄く保つ）
├── style.css
├── lib/
│   ├── hash.ts              # FNV-1a / mulberry32 / rand ヘルパ（既存を維持 + NFC）
│   ├── geometry.ts          # 極座標・パス組み立て・円弧・数値整形
│   ├── constants.ts         # viewBox・R_INNER・最小線幅など単一情報源
│   ├── motifs/
│   │   ├── types.ts         # Motif インタフェース / MotifPath
│   │   ├── plants.ts        # 柏・桐・桔梗・花菱・沢瀉・橘
│   │   ├── creatures.ts     # 鷹の羽・蝶・雁金
│   │   ├── objects.ts       # 扇・源氏車
│   │   ├── geometric.ts     # 菱・巴・目結
│   │   └── index.ts         # 登録簿（MOTIFS）
│   ├── enclosure.ts         # 外郭 5 種の幾何と R_INNER
│   ├── composition.ts       # 放射／単独／違い／連環 の配置解決
│   ├── kamon.ts             # buildKamonStructure（抽選と組み立て）
│   ├── naming.ts            # 紋名の組み立て
│   ├── render.ts            # 構造 + 配色 → SVG 文字列
│   ├── draftGuide.ts        # 割り出し線（drafting/empty 用の面）
│   ├── palette.ts           # 3 プリセット
│   ├── storage.ts           # 図版帖の永続化（localStorage）
│   └── exportImage.ts       # SVG / PNG 書き出し
└── ui/
    ├── dom.ts               # 検査付き要素取得
    ├── status.ts            # aria-live ステータス
    ├── plateBook.ts         # 図版帖の DOM
    ├── crestStage.ts        # 右ページの状態機械 + 描画
    └── app.ts               # 配線・状態遷移・デバウンス
```

依存の向き: `ui/* → lib/*`、`lib/kamon → lib/{motifs,enclosure,composition,hash,constants}`。
`lib/` は DOM に触れない（Node 上で単体テスト可能に保つ）。

---

## 3. 生成モデルの設計（本実装の核）

### 3.1 抽選の順序

決定的乱数から、**制約の強い順**に決める。後段が前段の制約下に入るため、無効な組み合わせが生じない。

```
1. enclosure   ← 重み付き抽選（FR-110.1）        → R_INNER が確定
2. motif       ← 14 種から一様抽選
3. composition ← motif が宣言した適合構成から抽選 → n が確定
4. fillRatio f ← [0.85, 0.95] から抽選           → 単位の外接長 L が確定
5. motif params← モチーフ固有の形状ゆらぎ（幅比・切れ込み深さ等）
6. seat        ← composition が single/crossed なら none 固定、他は抽選
```

### 3.2 モチーフの契約

```ts
interface Motif {
  id: MotifId;
  label: string;            // 「柏」
  category: MotifCategory;  // 植物 / 動物 / 器物 / 幾何
  compositions: readonly CompositionId[];
  /** 基部(0,0)・上方向(-y)のローカル座標で、外接長 L の図形を返す */
  build(rng: Rng, L: number): MotifGeometry;
}

interface MotifGeometry {
  /** fill で描くパス（白抜きは同一 d 内の副パス + fill-rule=evenodd） */
  fills: readonly string[];
  /** 線そのものが意匠である場合のみ。width >= MIN_STROKE */
  strokes?: readonly { d: string; width: number }[];
  /** 基部の中心からの距離。radial では <= SEAT_MAX_OFFSET */
  baseOffset: number;
  /** 単位の最大半幅角（度）。FR-103.3 の検証に使う */
  halfWidthAngle: number;
}
```

`build` が `L` を受け取るため、外郭が変わっても充填率が保たれる（SPEC 6 節の決定）。

### 3.3 白抜きの実装

塗り面と穴を**同一の `d` 文字列**に連結し、`fill-rule="evenodd"` を付ける。
穴のパスは必ず `Z` で閉じる。穴の幅は `MIN_NEGATIVE = 6` 以上（FR-101.4）。

### 3.4 対称複製

`render.ts` は単位マークアップを 1 度だけ生成し、
- `radial` / `ring`: `<g transform="rotate(θ 200 200)">` を n 個
- `crossed`: `rotate(+α)` と `matrix(-1 0 0 1 400 0)` の 2 個
- `single`: そのまま 1 個

として複製する。座標を個別計算しないため、対称性は構造的に保証される（FR-104.2）。

---

## 4. テスト戦略

| 層 | 対象 | 手段 |
|---|---|---|
| 単体 | hash / geometry / naming / enclosure / 各 motif / composition / storage / exportImage(URL 組み立て) | Vitest（Node 環境） |
| **性質テスト** | 100 シード × 3 バリアントの全数走査で FR-101〜104 の不変条件を検証 | Vitest。AC-02〜06, AC-10 に直結 |
| 統合 | app.ts の状態機械・図版帖の DOM・配色切替・永続化の往復 | Vitest + jsdom |
| E2E | 生成 → 次の紋 → 図版帖選択 → 配色 → 書き出し → 再読み込み復元 | Playwright（chromium / firefox / webkit） |
| 視覚 | 320/768/1440 のスクリーンショット、紋のコンタクトシート目視 | Playwright |

**性質テスト**が本実装の品質の要である。「家紋らしさ」を数値制約（FR-101〜104）に翻訳したうえで
全生成物に対して総当たりで検証するため、将来モチーフを追加しても退行を検出できる。

カバレッジしきい値 80%（lines / branches / functions / statements）。除外は `src/main.ts` と型定義のみ。

---

## 5. リスク

| リスク | 影響 | 緩和 |
|---|---|---|
| モチーフのパスが破綻し不正な SVG になる | 描画崩れ | 全モチーフ × 全適合構成のスナップショット + パス構文の単体テスト |
| 白抜きが evenodd の巻き方向で埋まる／抜けすぎる | 意匠の破綻 | モチーフごとに「穴が本体に内包される」ことをバウンディングボックスで検証 |
| 充填率を上げた結果、隣接単位が過剰に重なり団子になる | 判読性低下 | `halfWidthAngle` の上限制約（FR-103.3）＋ コンタクトシート目視 |
| localStorage のスキーマ変更で既存データが壊れる | データ消失 | キーにバージョンを含める（`/v1`）。読み込み時に項目単位で検証し不正は捨てる |
| PNG 書き出しで SVG に外部フォント参照が混ざり canvas が汚染される | 書き出し失敗 | SVG にテキスト要素・外部参照を一切含めない（FR-400.1） |
| 見開きレイアウトを維持したまま紋を大きくすると 900px 未満で窮屈になる | 可読性 | 900px 未満で上下 2 段、紋は `aspect-ratio` で領域確保 |

---

## 6. 段取り

Phase A 基盤 → B 幾何とモチーフ → C 構成と組み立て → D 描画 → E 永続化と書き出し →
F UI 状態機械 → G テスト仕上げ → H 検証。詳細は `./TASKS.md`。

1 タスク = 1 コミット。各タスクは単体で検証可能な粒度に割る。
