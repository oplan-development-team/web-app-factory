# TASKS: Halftone QR Generator

対応 SPEC: `./SPEC.md` / PLAN: `./PLAN.md`
1 タスク = 1 コミット。

---

## Phase A — 基盤

- [x] **T01** Vite + React + TS を scaffold。`base: './'`、npm scripts、tsconfig、.gitignore を設定 — NFR-002, NFR-007.3
- [ ] **T02** デザイントークン（`tokens.css`）とグローバルスタイル（`global.css`）を定義。フォントを同梱 — NFR-006, NFR-005.6

## Phase B — コアロジック

- [ ] **T03** `lib/types.ts`: 設定型・既定値 `DEFAULT_SETTINGS` を定義 — FR-002〜FR-009
- [ ] **T04** `lib/qr.ts`: `generateMatrix(text, ecc)`（UTF-8・容量超過を Result 型で返す）と機能パターン分類 `roles` を実装 — FR-001.2, FR-001.5, FR-002, PLAN §3.1
- [ ] **T05** `lib/image.ts`: 画像読み込み・cover 配置・zoom/offset・グレースケール・明度/コントラスト/反転・透明の白合成 — FR-003.6, FR-004, FR-005
- [ ] **T06** `lib/halftone.ts`: 3×3 分解 + λ バイアス + 保護マスク + 蛇行 Floyd–Steinberg。**中央固定の不変条件テストを全数で書く** — FR-006, NFR-007.2
- [ ] **T07** `lib/render.ts`: サブモジュールグリッド → ImageData / canvas 描画（クワイエットゾーン込み） — FR-007.4, FR-009.4
- [ ] **T08** `lib/export.ts`: 出力寸法計算（上限 8192px 抑止）と PNG ダウンロード — FR-009

## Phase C — 読み取り判定

- [ ] **T09** `workers/decode.worker.ts` + `lib/scan.ts`: 9 条件マトリクス、箱ぼかし、ZXing 実デコード、判定グレード算出 — FR-008, PLAN §3.3
- [ ] **T10** `hooks/useScanReport.ts`: Worker ライフサイクル、デバウンス、レース制御、失敗時フォールバック — FR-008.5, FR-008.6, FR-008.9

## Phase D — UI

- [ ] **T11** `hooks/useHalftoneQr.ts` / `useDebouncedValue.ts`: 状態管理とパイプライン結線、再計算粒度のメモ化 — FR-007.2, NFR-003.4
- [ ] **T12** `components/ImageDropzone.tsx`: D&D・ファイル選択・キーボード操作・検証エラー — FR-003
- [ ] **T13** 制御レール UI（テキスト入力 / ECC / アライメント / 階調 / λ / 保護レベル） — FR-001, FR-002, FR-004, FR-005, FR-006.6, FR-006.7
- [ ] **T14** `components/ComparePreview.tsx`: 通常 QR とハーフトーン QR の 2 面比較 — FR-007
- [ ] **T15** `components/ScanPanel.tsx`: 判定結果・条件マトリクス表示・改善助言・実機テスト注意書き — FR-008.4, FR-008.7, FR-008.8, FR-010.2
- [ ] **T16** `components/ExportPanel.tsx` + プライバシー表記 — FR-009, FR-010.3
- [ ] **T17** `App.tsx` とレイアウト CSS の統合。レスポンシブ（360/768/1024/1440）と a11y の仕上げ — NFR-004, NFR-005

## Phase E — 検証

- [ ] **T18** README 執筆（技術選定理由・使い方・制約） — CLAUDE.md 規約
- [ ] **T19** 最終検証: `npm test` / `npm run build` / 外部通信コード不在 grep / Playwright 実ブラウザ検証 / 書き出し PNG の独立デコード — AC-05, AC-09〜AC-13
