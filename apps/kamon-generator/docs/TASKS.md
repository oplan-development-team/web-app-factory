# TASKS: 家紋帳 — オリジナル家紋ジェネレーター

対応 SPEC: `./SPEC.md` / PLAN: `./PLAN.md`
1 タスク = 1 コミット。

実装中の判断で登録簿が変わった箇所は SPEC 3.2.3 に記録している
（`雁金` を落として `蔦` を入れ、4 モチーフの適合構成を狭めた）。

---

## Phase A — 基盤

- [x] **T01** `vite.config.ts` を追加（`base: './'`）。`tsconfig` に `strict` + `noUncheckedIndexedAccess` を設定。npm scripts を整備 — NFR-002.2, NFR-008.1
- [x] **T02** Vitest + jsdom + v8 カバレッジを導入し、しきい値 80% を設定 — NFR-008.3, NFR-008.4
- [x] **T03** `lib/constants.ts`・`lib/palette.ts` を新設し、寸法・配色を単一情報源化 — FR-110, FR-200
- [x] **T04** `lib/hash.ts` に NFC 正規化とサロゲート安全なハッシュを入れ、単体テストを先に書く — FR-002.1〜3, AC-08, AC-09

## Phase B — 幾何とモチーフ

- [x] **T05** `lib/geometry.ts`: 極座標・パス組み立て・円弧・数値整形。単体テスト先行 — FR-120.1
- [x] **T06** `lib/motifs/types.ts`: Motif / MotifGeometry の契約と、白抜きを含む evenodd パス組み立てヘルパ — FR-101, FR-120
- [x] **T07** `lib/motifs/plants.ts`: 柏・桐・桔梗・花菱・沢瀉・橘・蔦 の 7 モチーフ — FR-120
- [x] **T08** `lib/motifs/creatures.ts`: 鷹の羽・蝶 — FR-120
- [x] **T09** `lib/motifs/objects.ts`: 扇・源氏車 — FR-120, FR-101.2
- [x] **T10** `lib/motifs/geometric.ts`: 菱・巴・目結 — FR-120
- [x] **T11** `lib/motifs/index.ts`: 登録簿と、全モチーフ共通の不変条件テスト（パス構文・白抜きの内包・最小線幅） — AC-03, AC-11

## Phase C — 構成と組み立て

- [x] **T12** `lib/enclosure.ts`: 外郭 5 種の幾何と `R_INNER`。単体テスト — FR-110
- [x] **T13** `lib/composition.ts`: 放射／単独／違い／連環 の配置解決 — FR-130
- [x] **T14** `lib/naming.ts`: 紋名の組み立て。単体テスト — FR-150
- [x] **T15** `lib/kamon.ts`: `buildKamonStructure` を新モデルへ全面置換 — FR-101〜FR-140
- [x] **T16** 性質テスト: 100 シード × 3 バリアントで FR-101〜104 の不変条件を全数検証 — AC-01〜06, AC-10

## Phase D — 描画

- [x] **T17** `lib/render.ts`: 構造 + 配色 → SVG。対称複製を変換で行う — FR-104.2, FR-200.1, FR-602
- [x] **T18** `lib/draftGuide.ts`: 割り出し線（empty / drafting 用の面） — FR-500
- [x] **T19** 描画のスナップショットテストと、配色差替で `d` が不変であることの検証 — AC-13

## Phase E — 永続化と書き出し

- [x] **T20** `lib/storage.ts`: 図版帖の保存・読み込み・上限 60・破損時の切り捨て・利用不可時の降格 — FR-301, AC-16〜19
- [x] **T21** `lib/exportImage.ts`: SVG / PNG 書き出しとファイル名生成 — FR-400, AC-20〜22

## Phase F — UI

- [x] **T22** `ui/dom.ts`（検査付き取得）・`ui/status.ts`（aria-live） — NFR-008.2, FR-603
- [x] **T23** `index.html` を新 UI 構成へ更新（紋名見出し・PNG/SVG 書き出し・帳を空にする・状態面） — FR-150.1, FR-301.5, FR-500
- [x] **T24** `ui/crestStage.ts`: 4 状態の状態機械と描画 — FR-500
- [x] **T25** `ui/plateBook.ts`: 図版帖の DOM（`<button>` 化・重複抑止・スクロール） — FR-300, FR-601
- [x] **T26** `ui/app.ts` + `main.ts`: 配線・デバウンス・最新要求優先 — FR-001.4, FR-501.1
- [x] **T27** `style.css`: 紋の主役化、状態面、reduced-motion、レスポンシブの調整 — FR-500.2〜4, NFR-005, NFR-006

## Phase G — テスト仕上げ

- [x] **T28** 統合テスト（jsdom）: 状態遷移・配色切替・図版帖・永続化の往復 — AC-12〜19
- [x] **T29** Playwright E2E: 生成 → 次の紋 → 図版帖 → 配色 → 書き出し → 再読み込み復元、3 ブラウザ — AC-14〜24
- [x] **T30** カバレッジ 80% 達成と不足分の補強 — NFR-008.4, AC-28

## Phase H — 検証と仕上げ

- [ ] **T31** `README.md` を本実装の内容へ更新（生成モデルの説明を差し替え） — 依頼事項 #6
- [ ] **T32** `docker build` の疎通確認と、ビルド・目視・コンタクトシートによる最終検証 — AC-27, AC-29
