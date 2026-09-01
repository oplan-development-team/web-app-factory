# PLAN — SHOT SPLICE 本実装

対応: [SPEC.md](./SPEC.md)

---

## 1. 技術選定

| 項目 | 選定 | 理由 |
|---|---|---|
| ビルド | Vite 7 + TypeScript（strict） | 既存アプリと揃える。`base: './'` で Pages サブパス配信に対応 |
| UI | 素の DOM + TypeScript（フレームワーク不使用） | 画面数 1、状態も浅い。React 等は過剰（YAGNI）。バンドルを小さく保てる |
| CSS | 素の CSS + カスタムプロパティ | デザイントークンを 1 箇所に集約。ユーティリティ CSS は使わない（テンプレ化を避ける） |
| テスト | Vitest + jsdom + v8 coverage | 既存アプリ（tab-guilt-garden / kamon-generator）と同じ |
| E2E / 視覚検証 | Playwright（ローカル実行スクリプト） | モバイル幅・実機相当ビューポートでの確認と `visual-qa` の実測に使う |
| 画像処理 | Canvas 2D のみ | 依存を増やさない。WebGL / Worker は現要件に対し過剰 |

**Web Worker を使わない判断**: NFR-011（5 枚 3 秒以内）は、行サンプリング（FR-103）による計算量削減で
メインスレッドでも達成可能な見込み。継ぎ目ごとに `requestAnimationFrame` を挟んで UI をブロックしないようにする。
実測で 3 秒を超える場合のみ Worker 化を検討する（前倒しの最適化はしない）。

---

## 2. モジュール構成と依存方向

```
main.ts
  └─> ui/*            (DOM / 入力 / 描画呼び出し)
        └─> imaging/* (Canvas 依存の変換・描画)
              └─> core/*  (純粋関数。DOM を知らない)
```

- `core` から `imaging` / `ui` への import は禁止（依存の逆流禁止）。
- `imaging/compose.ts` は `CanvasLike` / `Ctx2DLike` という**実際に使うメンバーだけを列挙した構造的部分型**に依存する。
  実ブラウザでは本物の `HTMLCanvasElement` / `CanvasRenderingContext2D` が構造的に適合し、
  テストでは呼び出しを記録するフェイクを注入できる。キャンバス生成は `CanvasFactory` として 1 箇所だけ注入可能にする。
- `fillStyle` 等の型は DOM の型（`string | CanvasGradient | CanvasPattern`）をそのまま使う。独自 union にすると実 context が代入不可になる。
- `drawImage` の第 1 引数は `CanvasLike | CanvasImageSource` の union にする。

---

## 3. アルゴリズム設計

### 3.1 重なり検出（core/alignment.ts）

入力は `GrayImage { data: Uint8ClampedArray; width: number; height: number }` のみ。Canvas を受け取らない。

```
detectOverlapGray(coarseTop, coarseBottom, fineTop, fineBottom, opts) -> AlignmentResult
```

- `maxOverlap = floor(min(topH, bottomH) * 0.95)`、`minOverlap = 8`
- 粗探索: `coarse*`（幅 100、**高さ原寸**）に対し、候補 h をストライド付きで走査。
  各候補では重なり h 行のうち**最大 256 行を等間隔サンプリング**して平均絶対差を取る。
  → 平均化ではなく間引きなので、1px ずれたときのスパイクが保存される（§SPEC 1.1）。
- 精密探索: 粗探索の最良 h の ±(stride + 4) の窓を、フル解像度でストライド 1、**全行**で再評価。
- `matched = cost <= MATCH_COST_THRESHOLD (12.0)`

**設計上の注意**: 小さい h ほど偶然低コストになりやすいので `minOverlap = 8` を下限にする。
また、コストは「行数で正規化した平均」なので h の大小で不利にならない。

### 3.2 共通帯検出（core/banding.ts）

```
detectCommonBands(grays: GrayImage[], opts) -> { headerPx, footerPx }
```

- 全 `GrayImage` は同一幅（呼び出し側で基準幅に揃えたものを渡す）。
- `y = 0` から順に、全画像の行 y 同士の平均絶対差の**最大値**が閾値（6.0）以下である間カウント。
  最初に超えた時点で停止 → `headerPx`。
- 下端からも同様 → `footerPx`。
- `limit = floor(min(heights) * 0.25)` でそれぞれクリップ。
- `headerPx + footerPx` が最短高さを超えないよう追加クランプ。
- 画像 1 枚以下なら `{0, 0}`。

### 3.3 レイアウト計算（core/layout.ts）

```
computeLayout(shots: {width,height}[], overlaps: number[], cuts: {header,footer,trimEnds}) -> Layout
```

- 各ショットに適用するカット量を決める（FR-205 / FR-206）。
- カット後の高さと、隣接ペアの `maxOverlapPx` を算出。
- 各ショットの配置 y と、全体の出力サイズを返す。
- overlaps はクランプした値を返却に含める（UI はこの値を正とする）。

純粋関数なので AC-301 / AC-302 をそのままテストにできる。

---

## 4. UI 構成

```
[sticky] プレビューステージ  ← 縮小キャンバス + 平均色グロー + 出力サイズ readout
─────────────────────────────
フィルムストリップ（横スクロール / 並べ替え / 削除 / 追加）
共通帯カード（検出値・トグル・微調整）
継ぎ目カード × (n-1)（一致度・重なり px・タップで調整シート）
─────────────────────────────
[fixed] ツールバー（一括自動検出 / PNG 書き出し）+ safe-area
```

調整シート（ボトムシート）の中身:
- ドラッグハンドル
- ルーペ（等倍。通常 / 差分をトグル）
- 重なり px の大 mono readout ＋ ステッパー ＋ 数値入力
- 前面レイヤ選択（上 / 下）
- この継ぎ目だけ再検出

---

## 5. テスト戦略

| 層 | 手法 | 対象 |
|---|---|---|
| `core/*` | Vitest 純粋関数テスト | AC-101〜106、AC-201〜205、AC-301〜302、E-01〜07、E-11、E-12 |
| `imaging/compose.ts` | フェイク Canvas を注入した呼び出し検証 | 描画順・座標・差分帯の位置 |
| `ui/*` | jsdom + 合成 Pointer イベント | 状態遷移・クランプ・キーボード操作 |
| 統合 | Playwright（375/390/428/1280） | AC-401〜406、コンソールエラー 0 件、`visual-qa` の実測 |

テスト用のグレースケール画像は、シード付き擬似乱数で生成した `GrayImage` を合成して作る。
「上画像の下端 h 行」と「下画像の上端 h 行」を**同一バイト列**にすることで、正解が既知のペアを作れる。

**注意**: jsdom の合成 Pointer イベントは `timeStamp` がほぼ同一になるため、
速度依存の挙動（長押し判定など）はイベント経由ではなく明示的な時刻注入でテストする。

---

## 6. リスクと対策

| リスク | 対策 |
|---|---|
| 粗探索の高速化で 1px 精度を失う（プロトタイプの既知バグの再発） | 行の平均化を禁止し、間引きのみ。AC-104 を回帰テストとして常設 |
| 5 枚以上で自動検出が固まる | 継ぎ目ごとに rAF を挟む。進捗表示。実測して NFR-011 を確認 |
| 出力が Canvas 面積上限を超える（特に iOS Safari） | プレビューは縮小キャンバス。書き出し時のみフル生成し、事前警告と失敗ハンドリング |
| 横スクロール発生（375px） | フィルムストリップ以外に横方向のオーバーフローを作らない。`min-width: 0` を段組みに明示。input に `width: 100%` |
| 長押しドラッグ並べ替えが横スクロールと競合 | 長押し 200ms 成立まで移動を無視し、成立後に `touch-action: none` を付与。代替として ◀▶ ボタンを常設 |
| ダーク UI で境界線が地に埋もれる | `visual-qa` で実測。ヘアラインのコントラスト比を数値で確認 |

---

## 7. 進め方

1. 足場（Vite / TS / Vitest / Docker / deploy.json）
2. `core` を TDD で完成させる（ここが品質の中心。UI より先）
3. `imaging` を narrow interface で実装
4. デザイントークン → UI シェル → 各 UI 部品
5. 配線・体験品質（状態表示・モーション）
6. `visual-qa` → 実機相当ビューポート検証 → ビルド / Docker / README

**1 タスク = 1 コミット**。各タスク完了時に `TASKS.md` を `[x]` に更新してから次へ進む。
