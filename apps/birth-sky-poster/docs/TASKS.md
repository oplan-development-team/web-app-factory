# TASKS: Birth Sky Poster

対応 SPEC: `./SPEC.md` / PLAN: `./PLAN.md`
1 タスク = 1 コミット。

---

## Phase A — 基盤

- [ ] **T01** `vite.config.ts` を追加（`base: './'`, `target: es2022`）。`tsconfig` を `strict` + `noUncheckedIndexedAccess` に。npm scripts を整備する — NFR-002.2, NFR-008.1
- [ ] **T02** Vitest + jsdom + v8 カバレッジを導入し、閾値 80% を設定する — NFR-008.3, NFR-008.4
- [ ] **T03** `render/tokens.ts` を新設し、配色を単一情報源化する（CSS / ポスター内蔵 CSS / PNG 下地の重複を解消） — NFR-006
- [ ] **T04** `ui/dom.ts`: 検査付き要素取得を実装し、無検査 `as` キャストを全廃する — NFR-008.2

## Phase B — 天文計算の是正

- [ ] **T05** `render/format.ts`: 秒／分の繰り上げを正しく処理し `60` 表記を根絶する。単体テストを先に書く — FR-005.4, AC-07
- [ ] **T06** `astro/coords.ts`: 方位角を `atan2` ベクトル形式へ置換し、極点の退化を解消する — FR-103.2, FR-103.3, AC-06
- [ ] **T07** `astro/time.ts`: 単体テストを追加し、JD / GMST / LST を既知基準値で固定する — FR-101
- [ ] **T08** `astro/horizon.ts`: 線分の地平線クリッピング（二分法）を実装する — FR-105, AC-08

## Phase C — 実測カタログ

- [ ] **T09** `scripts/gen-catalog.mjs` を d3-celestial ベースに書き換え、乱数ダミー恒星を全廃する — FR-106.1〜3
- [ ] **T10** 星座線を IAU 88 星座の折れ線座標として取り込み、型・`astro/compute.ts` を新形式へ移行する — FR-106.4, FR-105.1
- [ ] **T11** `catalog.ts` を新設し、生成データの整合性テストを書く — FR-106.5

## Phase D — 入力検証と状態機械

- [ ] **T12** `ui/validation.ts`: 純関数バリデーション（空欄／非数値／範囲外／不正日付）を実装する — FR-004.1, FR-004.6, FR-001.4
- [ ] **T13** `ui/form.ts`: エラーの DOM 反映（`aria-invalid` / `aria-describedby` / インライン文言）を実装する — FR-004.2
- [ ] **T14** `ui/status.ts`: `aria-live` ステータス領域を実装する — FR-010.2
- [ ] **T15** `app.ts`: loading / ready / invalid の状態機械と 120ms デバウンスを実装、`main.ts` を薄くする — FR-009.1, FR-010.1
- [ ] **T16** `render/skeleton.ts`: 方位環のみの計器スケルトン（ローディング）とエラー面を実装する — FR-010.1

## Phase E — 描画の強化

- [ ] **T17** `render/starLabels.ts`: ラベル衝突回避を純関数として実装する — FR-006
- [ ] **T18** `render/starfield.ts` / `chart.ts`: クリップ済み星座線・ラベル表示切替に対応する — FR-003.2, FR-105
- [ ] **T19** CSS: アスペクト比予約でレイアウトシフトを 0 にし、reduced-motion に対応する — FR-009.2〜4, NFR-005.6, AC-22

## Phase F — インライン編集

- [ ] **T20** `render/editableText.ts`: キーボード操作対応・スクロール追従・取り残し防止を実装する — FR-007.2, FR-007.8
- [ ] **T21** 「表示文言をリセット」操作を実装する — FR-007.7, AC-14

## Phase G — 書き出し

- [ ] **T22** `render/exportImage.ts` / `app.ts`: 進行中・成功・失敗をステータス領域へ集約し、`alert` を廃止する。ファイル名に日付を含める — FR-008.4〜7

## Phase H — 仕上げ

- [ ] **T23** `index.html` / `styles/`: 文言の製品版化、レスポンシブ、フォーカス、コントラストを仕上げる — NFR-004, NFR-005, FR-003.2
- [ ] **T24** E2E（Playwright）を整備する。コンソール ERROR 0 件・外部リクエスト 0 件・書き出し・レスポンシブを検証する — AC-01〜22

## Phase I — 検証

- [ ] **T25** ビルド・型チェック・全テスト・カバレッジ 80% を通す — AC-23, AC-24
- [ ] **T26** `docker build` と実ブラウザでの動作・デザイン査読を行い、README を製品版へ更新する（出典表記を含む） — AC-25, FR-106.6

---

## 完了状況

0 / 26 完了。

### 実装中に確定した仕様変更

（実装中に追記する）
