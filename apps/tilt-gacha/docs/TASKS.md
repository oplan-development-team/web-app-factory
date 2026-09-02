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
- [x] **T06** `lib/tilt.ts`: `classifyTilt`。境界値・異常値の単体テスト — FR-012, AC-01, AC-02
- [x] **T07** `lib/gacha.ts`: `pickFamily` / `pickRarity` / `drawSpecimen`。境界値 + モンテカルロ分布テスト — FR-030〜033, AC-03〜07
- [x] **T08** `lib/collection.ts`: 収集状態の純粋な更新・型 ID・進捗集計・スキーマ検証 — FR-200, FR-201.2, AC-12〜15
- [x] **T09** `lib/storage.ts`: `localStorage` 入出力（Storage 注入可能・例外を飲む） — FR-201.3, AC-16

## Phase C — 模様生成

- [x] **T10** `lib/patterns/svg.ts`: 数値丸め・パス組み立て・要素シリアライズ — FR-100.2, FR-101
- [x] **T11** `lib/patterns/flow.ts`: 波打つ縦線束（1〜3 層） — FR-110
- [x] **T12** `lib/patterns/grid.ts`: ドット格子（1〜3 層） — FR-110
- [x] **T13** `lib/patterns/radial.ts`: 同心円（1〜3 層） — FR-110
- [x] **T14** `lib/patterns/noise.ts`: 散布点（1〜3 層） — FR-110
- [x] **T15** `lib/patterns/index.ts`: `buildPattern` ディスパッチと、600 標本の不変条件テスト — FR-100, AC-08〜11

## Phase D — UI

- [x] **T16** `ui/dom.ts`（検査付き取得）・`ui/screens.ts`（画面切替と aria-live） — NFR-008.2, FR-050
- [x] **T17** `index.html` の 3 画面マークアップ — FR-300, FR-400, FR-500
- [x] **T18** `ui/motion.ts`: 許可要求・購読・シェイク検出・1200ms 自動降格 — FR-001〜003, FR-010, FR-020〜022
- [x] **T19** `ui/reveal.ts`: 出現演出画面の描画（グロー・バッジ・フレーバー） — FR-400〜404
- [x] **T20** `ui/collectionView.ts`: 図鑑の 4 セクション × 3 列グリッド・未収集表示・進捗 — FR-500〜504
- [x] **T21** `ui/app.ts` + `main.ts`: 状態機械と全配線 — PLAN §3
- [x] **T22** `style.css`: ダーク・ミニマル意匠、グロー、レスポンシブ、reduced-motion — 1.2 節, NFR-004, NFR-005

## Phase E — 検証

- [x] **T23** 統合テスト（jsdom）: 状態遷移・フォールバック・合成 devicemotion・永続化往復 — AC-17〜24
- [x] **T24** Playwright E2E: フォールバック経路・横スクロール・コンソールエラー・reduced-motion（3 ブラウザ） — AC-18, AC-25〜27
- [x] **T25** カバレッジ 80% 到達と不足分の補強 — NFR-008.4, AC-29
- [x] **T26** `visual-qa` による実測検証と、指摘の修正 — R6, NFR-006
- [x] **T27** `README.md` 作成、`docker build` 疎通確認、`PROJECTS.md` 更新 — AC-30

---

# 修正ラウンド 2（モックアップ照合 + 模様の複雑さ強化）

初回はモックアップ URL がエージェント環境から開けず、SPEC 1.2 に書き写したトークン値だけを
情報源に実装した結果、構成が「標本カタログ × 計測器」路線へ寄っていた。
モックアップのソース（`*.dc.html`）をローカルで受け取れたので、構成を実測して寄せ直す。

**退行させないもの**（いずれも実測に基づく正当な修正）:
罫線コントラスト（`--line` = #2e2e34）／UI チャンクの `line-height` 明示／
グローのはみ出し防止（狭い画面での横スクロール 0）／日本語の行末孤立の回避。

## Phase F — モックアップへの追従

- [x] **T28** モックアップ実測値をトークン化（`#6f6f75` / `#1c1c1f` / `#0e0e10` / `#4a4a4e`、ピル半径、スロット半径）と SPEC 追補 — SPEC 1.2
- [x] **T29** 待機画面をモックアップ構成へ（左上ワードマーク・中央ゴースト+コピー・ピル型ボタン・傾きアイコン列・図鑑リンク） — FR-300 系
- [x] **T30** 出現演出をモックアップ構成へ（上部バー TYPE nn/12・中央グロー・識別ブロック・CTA 2 つ横並び） — FR-400 系
- [x] **T31** 図鑑をモックアップ構成へ（角丸スロット 104px・3 列・locked 面/破線・進捗バー） — FR-500 系

## Phase G — 模様の複雑さ強化

- [ ] **T32** `lib/patterns/field.ts`: 極（attractor / vortex）によるベクトル場と点描ストローク — 新 FR-111
- [ ] **T33** FLOW: 場による歪みと点描レイヤー（Flow Dots 相当） — FR-110
- [ ] **T34** RADIAL: 複数の渦中心による干渉した同心円 — FR-110
- [ ] **T35** GRID / NOISE: 場による格子の歪みと密度の偏り — FR-110
- [ ] **T36** 不変条件テストの更新と、12 型のコンタクトシートによる目視確認 — AC-09〜11

## Phase H — 再検証

- [ ] **T37** 統合 / E2E の更新と全緑化、カバレッジ維持 — AC-17〜29
- [ ] **T38** `visual-qa` 再実行と指摘の修正、`docker build` 再確認、ドキュメント更新
