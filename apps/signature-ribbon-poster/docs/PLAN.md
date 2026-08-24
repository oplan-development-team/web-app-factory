# PLAN: Signature Ribbon Poster 本実装

対応 SPEC: `./SPEC.md`
**Last updated**: 2026-08-24

---

## 1. 全体方針

プロトタイプの**コンセプトと意匠は温存**し、内部構造だけを入れ替える。具体的には:

- `palette.ts`（色定義・色演算）はほぼそのまま流用する。中核の資産。
- `ribbon.ts`（303 行。速度算出・描画・入力処理・rAF ループが 1 ファイルに同居）は**分解して作り直す**。描画方式そのものを変えるため。
- `export.ts` のキャプション描画ロジック（スクリム → ヘアライン → SIGNED → 本文）は**レイアウト定数をポスター空間比率へ一般化**したうえで流用する。
- `style.css` は既存トークン・意匠を維持したまま、新規 UI 分を追加する。
- `index.html` は新規 UI 分のマークアップを追加する。

---

## 2. アーキテクチャ

### 2.1 ディレクトリ構成

```
src/
├── core/                    # 純粋ロジック（DOM / Canvas 非依存・完全にテスト可能）
│   ├── palette.ts           # 色定義と色演算（プロトタイプから流用）
│   ├── geometry.ts          # clamp / lerp / distance / midpoint
│   ├── speed.ts             # 速度の平滑化（SpeedSmoother）
│   ├── ribbon-metrics.ts    # 速度 → 幅 / 不透明度 / 発光量 の写像、レスポンス設定
│   ├── stroke.ts            # Stroke / RibbonPoint 型と StrokeBuilder（点の採用判定）
│   ├── history.ts           # Undo / Redo スタック（イミュータブル）
│   ├── draft.ts             # ドラフトの直列化・検証・localStorage リポジトリ
│   ├── export-presets.ts    # 書き出し解像度プリセット
│   └── poster.ts            # ポスター空間の定数と座標変換
├── render/                  # Canvas 描画層（Ctx2D インターフェース経由でテスト可能）
│   ├── types.ts             # Ctx2D / CanvasLike / CanvasFactory の最小インターフェース
│   ├── ribbon-painter.ts    # コア層へのリボン描画（増分 / 全描画の両対応）
│   ├── bloom.ts             # ブルーム層の生成と合成
│   ├── caption.ts           # キャプションの焼き込み
│   ├── scene.ts             # 背景 + コア + ブルーム の合成
│   └── live-renderer.ts     # 表示キャンバスのレイヤー管理と rAF ループ
├── app/                     # アプリケーション層（DOM）
│   ├── studio.ts            # 状態の単一の持ち主（ストローク・履歴・設定）
│   ├── pointer-input.ts     # Pointer Events → StrokeBuilder
│   ├── exporter.ts          # 書き出しパイプライン（オフスクリーン合成 → PNG）
│   └── ui/
│       ├── swatches.ts      # 背景 / リボン色の radiogroup
│       ├── response-slider.ts
│       ├── resolution-picker.ts
│       ├── caption-field.ts
│       ├── toast.ts
│       └── restore-banner.ts
├── main.ts                  # 配線のみ
└── style.css
```

### 2.2 レイヤー構成（描画）

```
poster space (1800 × 2545, 論理座標)
        │  scale = viewWidth / 1800
        ▼
┌─────────────────────────────────────────────┐
│ core layer   (viewW × viewH)                │  ← ストロークの芯。shadowBlur なし
│   append-only during drag                   │
└──────────────┬──────────────────────────────┘
               │ downscale ÷4 + blur
               ▼
        ┌──────────────┐  downscale ÷4 + blur   ┌──────────────┐
        │ bloom L1     │ ─────────────────────► │ bloom L2     │
        │ (÷4)         │                        │ (÷16)        │
        └──────┬───────┘                        └──────┬───────┘
               │                                       │
               ▼  lighter, α=0.55                      ▼  lighter, α=0.42
┌─────────────────────────────────────────────────────────────┐
│ display canvas: background fill → L2 → L1 → core (lighter)  │
└─────────────────────────────────────────────────────────────┘
```

**なぜこれで速くなるか**

| | プロトタイプ | 本実装 |
|---|---|---|
| ぼかし処理の回数 | セグメント数 × 3（`shadowBlur` 付き `stroke()`） | フレームあたり 2（レイヤー単位の `drawImage`） |
| 1 フレームの描画対象 | 常に全セグメント | ドラッグ中は新規セグメントのみ |
| 塗りつぶし面積 | 1800×2545 = 4.58 Mpx 固定 | 表示サイズ依存。典型 720×1018 ≒ 0.73 Mpx |
| ブルーム生成面積 | （上記に含まれる） | 0.73/16 + 0.73/256 ≒ 0.05 Mpx |

`shadowBlur` はセグメント数に比例してぼかし回数が増えるため、点が増えるほど二次的に重くなる。レイヤー方式は**点数に依存しない固定コスト**にできる。

**質感を落とさない工夫**
- ブルームを 2 段（÷4 と ÷16）重ねることで、`shadowBlur` の単一半径より falloff が滑らかで広いハローになる。
- コア層の上にホットコア（白寄りの細いハイライト）を残し、ネオン管的な芯の鋭さを維持する。
- セグメントを中点二次ベジェで繋ぎ、折れ線の角を消す（プロトタイプより滑らか）。

### 2.3 増分描画の管理

`RibbonPainter` は「どこまでコア層に描いたか」を `(strokeIndex, segmentIndex)` のカーソルで保持する。

- `appendPending()` — カーソル以降の確定済みセグメントだけを描く（ドラッグ中に毎フレーム呼ぶ）
- `repaintAll()` — コア層をクリアして全ストロークを描き直し、カーソルをリセットする

中点二次ベジェは点 `i` のセグメントを描くのに点 `i+1` を要するため、**カーソルは常に「最後の点の 1 つ前」まで**進む。ストローク確定時に末端セグメントを描き足す。

`repaintAll()` を要するイベント: Undo / Redo / Clear / 背景変更 / レスポンス変更 / リサイズ / ドラフト復元。

### 2.4 テスト容易性の担保

Canvas を実際に必要としないよう、描画層は**自前の最小インターフェース**に依存させる。

```ts
// render/types.ts
export interface Ctx2D { /* 使用するメソッド・プロパティのみ */ }
export interface CanvasLike { width: number; height: number; getContext(id: "2d"): Ctx2D | null }
export type CanvasFactory = (w: number, h: number) => CanvasLike
```

ブラウザでは `CanvasRenderingContext2D` がこの構造的部分型を満たす。テストでは呼び出しを記録するフェイクを渡す。`LiveRenderer` / `Exporter` は `CanvasFactory` を注入で受け取る。

（過剰な抽象化を避けるため、差し替え可能にするのはこの 1 箇所だけに留める。）

---

## 3. データモデル

```ts
// core/stroke.ts
interface RibbonPoint { x: number; y: number; t: number; speed: number }  // x,y はポスター空間
interface Stroke { points: RibbonPoint[]; colorId: RibbonHueId }

// core/history.ts
interface HistoryState<T> { past: T[]; present: T; future: T[] }
// T = readonly Stroke[]

// core/draft.ts
interface DraftV1 {
  version: 1
  backgroundId: BackgroundId
  hueId: RibbonHueId
  response: number            // 0..100
  resolutionId: ResolutionId
  caption: string
  strokes: SerializedStroke[]
}
interface SerializedStroke { c: RibbonHueId; p: number[] }  // [x, y, dt, speed] × n を平坦化
```

**色は hex ではなく id で保持する**（プロトタイプは hex 直持ち）。将来パレットを調整しても保存済みドラフトが壊れず、検証も列挙で済むため。

---

## 4. 実装フェーズ

| Phase | 内容 | 依存 |
|-------|------|------|
| A | 基盤整備（Vitest / Playwright / カバレッジ / スクリプト） | — |
| B | `core/` の純粋ロジックを TDD で実装 | A |
| C | `render/` の描画層を TDD で実装（フェイク ctx） | B |
| D | `app/` の状態管理・入力・書き出し | C |
| E | UI（新規コンポーネント + CSS + HTML） | D |
| F | 統合・E2E・ベンチマーク・ドキュメント | E |

---

## 5. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| ブルーム方式が `shadowBlur` より見劣りする | コンセプトの毀損（最重要リスク） | 2 段ブルーム + ホットコア維持 + ベジェ平滑化。実装後にプロトタイプと並べてスクリーンショット比較する |
| `ctx.filter` の対応差（Safari は 17 以降） | ぼかしが効かない環境で発光が弱くなる | 機能検出し、未対応なら縮小 → 拡大の双線形補間のみでブルームを作る（E-16） |
| 増分描画のカーソル管理バグ | 描き残し・二重描画 | カーソル進行を単体テストで網羅（0/1/2 点、連続 append、途中 repaint） |
| jsdom に Canvas が無くカバレッジが伸びない | AC-13 未達 | 描画層をインターフェース依存にし、フェイク ctx でカバーする（§2.4） |
| Archival（3600×5090）書き出しのメモリ | 低スペック端末でクラッシュ | オフスクリーンは書き出しごとに生成・破棄。ブルーム段数は増やすが解像度比は据え置き |
| localStorage 容量超過 | 保存が静かに失敗 | try/catch で捕捉し 1 度だけ通知（FR-011.5）。座標を丸めて保存量を削減（FR-011.3） |
| 表示解像度の可変化で既存ストロークがずれる | 作品が壊れる | 座標をポスター空間で保持し、描画時のみスケール（FR-001.8）。リサイズの E2E を用意 |

---

## 6. 性能計測の方法

`bench/render-bench.spec.ts`（Playwright）で、実ブラウザ上の実測値を取る。

1. アプリを起動し、`window.__bench` に公開したフックからレンダラを取得する（開発ビルドのみ公開）。
2. 合成した 1000 点のストロークを投入する。
3. **増分描画**: 1 点追加 → `render()` を 200 回繰り返し、`performance.now()` の差分の中央値を取る。
4. **全再描画**: `repaintAll()` → `render()` を 50 回繰り返し、中央値を取る。
5. プロトタイプ相当の実装（`bench/legacy-renderer.ts` に `shadowBlur` 3 パス方式を保存）で同じ計測を行い、比を出す。

結果は README に記載する。
