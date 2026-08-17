# TASKS: QR Code Designer

対応 SPEC: `./SPEC.md` / PLAN: `./PLAN.md`
1 タスク = 1 コミット。

---

## Phase A — 基盤

- [x] **T01** Vite + React + TS プロジェクトを scaffold し、`base: './'`、パスエイリアス、npm scripts を設定する — NFR-002
- [x] **T02** デザイントークン（`tokens.css`）とグローバルスタイル（`global.css`）を定義する。フォントを同梱する — NFR-001.2, NFR-006

## Phase B — コアロジック

- [x] **T03** `lib/types.ts`: `QrDesign` / `Paint` / 各 enum と既定値 `DEFAULT_DESIGN` を定義する — FR-002〜FR-006
- [x] **T04** `lib/qr.ts`: UTF-8 設定込みで `generateMatrix(text, ecc)` を実装。容量超過を Result 型で返す — FR-001.2, FR-002.2, FR-005 エッジ
- [x] **T05** `lib/geometry.ts`: 汎用 `rrPath()`（コーナー別半径の角丸矩形パス）と `ringPath()` を実装する — FR-003, FR-004
- [x] **T06** `lib/paths.ts`: `buildBodyPath()` を実装（4 形状 + ロゴマスク + ファインダー除外、単一 path 統合） — FR-003, FR-006.6
- [x] **T07** `lib/paths.ts`: `buildEyeFramePaths()` / `buildEyeBallPaths()` を実装（4 形状 × 3 隅） — FR-004
- [x] **T08** `lib/color.ts`: hex 正規化 / 相対輝度 / コントラスト比 / ペイントのストップ列挙を実装する — FR-005.4, FR-009.2

## Phase C — 安全性判定

- [x] **T09** `lib/safety.ts`: FR-009.1〜FR-009.6 の 6 判定と総合レベル算出を実装する — FR-009

## Phase D — プレビュー

- [x] **T10** `components/QrPreview.tsx`: defs（グラデーション）+ 背景 + 本体 + アイ + ロゴを描く SVG を実装する — FR-007.2, FR-005.5, FR-006
- [x] **T11** `hooks/useQrDesign.ts` / `hooks/useDebouncedValue.ts`: 状態管理・メモ化・自動 ECC を実装する — FR-002.3, FR-007.1, NFR-003.2

## Phase E — 操作 UI

- [x] **T12** `components/controls/` 共通部品: `Section` / `Field` / `SliderField` / `SegmentedControl` を実装する — NFR-005
- [x] **T13** `components/controls/ShapePicker.tsx`: 図形プレビュー付き radiogroup（矢印キー対応）を実装する — FR-003.1, FR-004, NFR-005.2
- [x] **T14** `components/controls/ColorField.tsx` / `PaintEditor.tsx`: 単色・線形・放射の編集 UI を実装する — FR-005
- [x] **T15** `components/controls/LogoUploader.tsx`: D&D + バリデーション + サイズ/余白/座布団を実装する — FR-006
- [x] **T16** `lib/presets.ts` / `components/controls/PresetGallery.tsx`: 6 プリセットとギャラリーを実装する — FR-010
- [x] **T17** `components/SafetyPanel.tsx`: 判定結果を aria-live 領域で表示する — FR-009.7, FR-009.8

## Phase F — 書き出し

- [x] **T18** `lib/export.ts`: `serializeSvg()` / `downloadSvg()` / `rasterizeToPng()` / ファイル名生成を実装する — FR-008
- [x] **T19** `components/ExportPanel.tsx`: 解像度選択（300dpi 実寸併記）と書き出し中状態を実装する — FR-008.2, エッジケース

## Phase G — 統合

- [x] **T20** `App.tsx` + ヘッダー/プレビュー台（トンボ）/設定レールを組み上げ、レスポンシブを実装する — NFR-004, NFR-006.2
- [x] **T21** アクセシビリティ仕上げ（フォーカス可視 / reduced-motion / ラベル / コントラスト） — NFR-005

## Phase H — テスト

- [x] **T22** `src/lib/*.test.ts`: qr / geometry / paths / color / safety / export の単体テストを書く

## Phase I — 検証

- [x] **T23** ビルド・型チェック・テストを通し、バンドルサイズを確認する — NFR-003.1
- [x] **T24** 実ブラウザでの起動確認、コンソールエラー 0 件、AC 実行、外部リクエスト 0 件の確認 — AC-16, AC-20
- [x] **T25** README を書く（技術選定理由・制約を含む）

---

## 完了状況

25 / 25 完了。

### 実装中に確定した仕様変更

- **T09 / FR-009.2**: コントラスト判定を本体色だけでなく、ファインダー外枠・中央にも広げた。
  読み取り機が最初に探すのはファインダーであり、そこが低コントラストだと本体が読めても検出に失敗するため。
  同時に safe のしきい値を 5.0 から 4.5（WCAG AA 相当）へ調整した。
- **T09 / FR-009.6**: 丸ドットの警告を「L のみ caution、M は info」に緩和した。
  当初の「L と M で caution」では、既定の訂正レベル（M）の丸ドットプリセットが常に「注意」となり
  パネル全体の信頼性を損なうため。実測でも M の丸ドットは問題なくデコードできる。
- **T24**: 検証に使った jsQR はファインダーが曲線形状のとき検出精度が落ちる（解像度を上げるほど悪化する
  という逆転挙動を示した）。ZXing に切り替えて全 64 形状 × 2 解像度が 128/128 成功することを確認した。
