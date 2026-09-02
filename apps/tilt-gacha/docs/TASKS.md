# TASKS: 傾きガチャ（Tilt Gacha）

対応 SPEC: `./SPEC.md` / PLAN: `./PLAN.md`
1 タスク = 1 コミット。

---

## Phase A — 基盤

- [x] **T01** SDD 成果物（SPEC / PLAN / TASKS）を追加
- [x] **T02** プロジェクト雛形: `package.json` / `tsconfig.json` / `vite.config.ts`（`base: './'`）/ `index.html` / `deploy.json` / `.gitignore` / `.dockerignore` / `Dockerfile` — NFR-002, AC-31
- [x] **T03** Vitest + v8 カバレッジ（しきい値 80%）と Playwright の設定 — NFR-008.4
- [x] **T04** `lib/types.ts` + `lib/constants.ts`: 系統・レア度・傾き区分・重み・閾値・パラメータ範囲の単一情報源 — FR-030, FR-031, FR-110

## Phase B — ロジック（DOM 非依存）

- [x] **T05** `lib/rng.ts`: mulberry32 と範囲ヘルパ。単体テスト先行 — FR-100.1
- [ ] **T06** `lib/tilt.ts`: `classifyTilt`。境界値・異常値の単体テスト — FR-012, AC-01, AC-02
- [ ] **T07** `lib/gacha.ts`: `pickFamily` / `pickRarity` / `drawSpecimen`。境界値 + モンテカルロ分布テスト — FR-030〜033, AC-03〜07
- [ ] **T08** `lib/collection.ts`: 収集状態の純粋な更新・型 ID・進捗集計・スキーマ検証 — FR-200, FR-201.2, AC-12〜15
- [ ] **T09** `lib/storage.ts`: `localStorage` 入出力（Storage 注入可能・例外を飲む） — FR-201.3, AC-16

## Phase C — 模様生成

- [ ] **T10** `lib/patterns/svg.ts`: 数値丸め・パス組み立て・要素シリアライズ — FR-100.2, FR-101
- [ ] **T11** `lib/patterns/flow.ts`: 波打つ縦線束（1〜3 層） — FR-110
- [ ] **T12** `lib/patterns/grid.ts`: ドット格子（1〜3 層） — FR-110
- [ ] **T13** `lib/patterns/radial.ts`: 同心円（1〜3 層） — FR-110
- [ ] **T14** `lib/patterns/noise.ts`: 散布点（1〜3 層） — FR-110
- [ ] **T15** `lib/patterns/index.ts`: `buildPattern` ディスパッチと、600 標本の不変条件テスト — FR-100, AC-08〜11

## Phase D — UI

- [ ] **T16** `ui/dom.ts`（検査付き取得）・`ui/screens.ts`（画面切替と aria-live） — NFR-008.2, FR-050
- [ ] **T17** `index.html` の 3 画面マークアップ — FR-300, FR-400, FR-500
- [ ] **T18** `ui/motion.ts`: 許可要求・購読・シェイク検出・1200ms 自動降格 — FR-001〜003, FR-010, FR-020〜022
- [ ] **T19** `ui/reveal.ts`: 出現演出画面の描画（グロー・バッジ・フレーバー） — FR-400〜404
- [ ] **T20** `ui/collectionView.ts`: 図鑑の 4 セクション × 3 列グリッド・未収集表示・進捗 — FR-500〜504
- [ ] **T21** `ui/app.ts` + `main.ts`: 状態機械と全配線 — PLAN §3
- [ ] **T22** `style.css`: ダーク・ミニマル意匠、グロー、レスポンシブ、reduced-motion — 1.2 節, NFR-004, NFR-005

## Phase E — 検証

- [ ] **T23** 統合テスト（jsdom）: 状態遷移・フォールバック・合成 devicemotion・永続化往復 — AC-17〜24
- [ ] **T24** Playwright E2E: フォールバック経路・横スクロール・コンソールエラー・reduced-motion（3 ブラウザ） — AC-18, AC-25〜27
- [ ] **T25** カバレッジ 80% 到達と不足分の補強 — NFR-008.4, AC-29
- [ ] **T26** `visual-qa` による実測検証と、指摘の修正 — R6, NFR-006
- [ ] **T27** `README.md` 作成、`docker build` 疎通確認、`PROJECTS.md` 更新 — AC-30
