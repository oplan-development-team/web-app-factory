# TASKS: Signature Ribbon Poster 本実装

対応 SPEC: `./SPEC.md` / PLAN: `./PLAN.md`
1 タスク = 1 コミット。TDD（テスト先行）で進める。

---

## Phase A — 基盤

- [x] **T01** 仕様書 3 点（SPEC / PLAN / TASKS）を追加する
- [x] **T02** Vitest（jsdom + v8 カバレッジ 80% 閾値）と Playwright を導入し、npm scripts を整備する — NFR-002

## Phase B — core（純粋ロジック）

- [x] **T03** `core/poster.ts` / `core/geometry.ts`: ポスター空間定数と clamp/lerp/distance/midpoint — FR-001.8
- [x] **T04** `core/palette.ts`: 背景 3 / リボン色 5 の定義と hex 演算、id 解決 — FR-005, FR-006
- [x] **T05** `core/speed.ts`: `SpeedSmoother`（5 サンプル移動平均・リセット） — FR-002
- [x] **T06** `core/ribbon-metrics.ts`: レスポンス → maxSpeed、速度 → 幅/不透明度/発光量の写像 — FR-003, FR-013.2
- [x] **T07** `core/stroke.ts`: `StrokeBuilder`（1.5px 未満の点を棄却、速度付与、確定） — FR-001.5, FR-002.3
- [x] **T08** `core/history.ts`: Undo/Redo スタック（上限 50、push で future 破棄） — FR-008
- [x] **T09** `core/export-presets.ts`: 3 解像度プリセットと id 解決 — FR-010
- [x] **T10** `core/draft.ts`: ドラフトの直列化・復元・スキーマ検証 — FR-011.3, FR-011.4
- [x] **T11** `core/draft-storage.ts`: localStorage リポジトリ（例外を投げない・破損時削除） — FR-011.4, FR-011.5, E-08, E-09

## Phase C — render（描画層）

- [x] **T12** `render/types.ts`: `Ctx2D` / `CanvasLike` / `CanvasFactory` と、テスト用フェイク ctx — NFR-003.3
- [x] **T13** `render/ribbon-painter.ts`: コア層への描画（中点二次ベジェ・可変幅・ホットコア・単点ドット） — FR-004.1, FR-004.3, E-01
- [x] **T14** `render/ribbon-painter.ts`: 増分描画のカーソル管理（`appendPending` / `repaintAll`） — NFR-001.2
- [x] **T15** `render/bloom.ts`: 2 段ブルームの生成と合成（`ctx.filter` フォールバック付き） — NFR-001.1, E-16
- [x] **T16** `render/scene.ts`: 背景 → ブルーム → コア の合成 — FR-004.2
- [x] **T17** `render/caption.ts`: キャプション焼き込み（比率ベース・幅超過時の縮小と切り詰め） — FR-007.3, FR-007.5, E-07
- [x] **T18** `render/live-renderer.ts`: レイヤー管理・解像度決定・rAF ループ・リサイズ — NFR-001.3, NFR-001.7, E-02

## Phase D — app（状態・入力・書き出し）

- [x] **T19** `app/studio.ts`: 状態の単一の持ち主（ストローク・履歴・設定・変更通知） — FR-005.2, FR-006.2, FR-008, FR-013.3
- [x] **T20** `app/pointer-input.ts`: Pointer Events の処理（キャプチャ・単一ポインタ・確定） — FR-001.1〜FR-001.4, E-03, E-04
- [x] **T21** `app/exporter.ts`: 書き出しパイプライン（オフスクリーン合成 → PNG → ダウンロード） — FR-009, FR-010.3, E-13
- [x] **T22** `app/draft-sync.ts`: 自動保存（800ms デバウンス）と復元の適用 — FR-011.1, FR-011.6

## Phase E — UI

- [x] **T23** `app/ui/toast.ts`: トースト（成功 / エラー、`role="status"`、自動消滅） — NFR-005.3, NFR-005.4, NFR-006.2
- [x] **T24** `app/ui/swatches.ts`: 色選択 radiogroup（矢印キー対応） — NFR-006.1
- [x] **T25** `app/ui/response-slider.ts`: レスポンススライダー（Calm/Balanced/Volatile） — FR-013.1, FR-013.4
- [x] **T26** `app/ui/resolution-picker.ts`: 解像度セレクタ（セグメント + ゴールド下線） — FR-010.1, FR-010.2, NFR-004.4
- [x] **T27** `app/ui/restore-banner.ts`: ドラフト復元バナー（復元 / 破棄） — FR-011.2
- [x] **T28** `index.html` / `style.css`: 新規 UI のマークアップと意匠を追加する — NFR-004, NFR-005.5, NFR-005.6
- [x] **T29** `main.ts`: 全体の配線、キーボードショートカット、空/ローディング状態 — FR-014, NFR-005.1, NFR-005.2

## Phase F — 検証

- [x] **T30** 統合テスト: studio × renderer × draft の結合、主要導線 — NFR-002.1
- [x] **T31** E2E（Playwright）: 描画 / 色変更 / Undo・Redo / キャプション / 書き出し / 復元 / リサイズ — NFR-002.4
- [x] **T32** ベンチマーク（`bench/`）: 新旧比較の実測と README への記載 — NFR-001.5, NFR-001.8
- [x] **T33** カバレッジ 80% 達成の確認と不足分の補完 — AC-13
- [x] **T34** README 更新 / Docker ビルド確認 — NFR-008
