# TASKS: サイアノタイプ・ポスターメーカー 本実装

対応 SPEC: `./SPEC.md` / PLAN: `./PLAN.md`
1 タスク = 1 コミット。

---

## Phase A — 基盤

- [x] **T01** `tsconfig` を `strict` + `noUncheckedIndexedAccess` へ引き上げ、Vitest + jsdom + v8 カバレッジ（しきい値 80%）と Playwright（3 エンジン）を導入 — NFR-008.1〜4
- [x] **T02** `core/ctx2d.ts`: 描画に使う Canvas API の構造的部分型と `CanvasFactory` 注入口。テスト用フェイクを `tests/fakes/` に用意 — NFR-007.2
- [x] **T03** `core/random.ts` に `randFloat` / `randInt` / `pick` を追加し、決定性の単体テストを先に書く — FR-121

## Phase B — 画像処理の移設と堅牢化

- [x] **T04** `core/grayscale.ts` / `core/dither.ts` / `core/coverFit.ts` の単体テスト（AC-10 の中間色不在を含む） — FR-201〜204
- [x] **T05** `core/texture.ts` を `Ctx2D` 依存へ差し替え、繊維タイルのキャッシュに上限 16 を入れる — FR-302.2
- [x] **T06** `core/edgeMask.ts` / `core/vignette.ts` / `core/mottle.ts` を `Ctx2D` 依存へ差し替え、単体テスト — FR-301, FR-303, FR-304

## Phase C — 所蔵標本

- [x] **T07** `specimens/types.ts`・`specimens/shared.ts`: 契約と、陰画の地・半影つき塗り・葉身・葉脈の共通作図 — FR-122
- [x] **T08** `specimens/fern.ts`・`specimens/algae.ts` — FR-120
- [x] **T09** `specimens/venation.ts`・`specimens/ginkgo.ts` — FR-120
- [x] **T10** `specimens/grass.ts`・`specimens/umbel.ts` — FR-120
- [x] **T11** `specimens/index.ts`: 登録簿と描画の入口。全種共通の不変条件テスト（決定性・階調範囲・被覆・収まり・個体差） — FR-121〜123, AC-04, AC-07

## Phase D — 図案ソースと状態

- [x] **T12** `source/types.ts`・`source/imageLoader.ts`: 判別共用体と、画素数上限つきアップロード読み込み — FR-101, FR-110
- [x] **T13** `label/specimenId.ts`: `crypto.subtle` 失敗時の決定的フォールバックへ置換。単体テスト — FR-111
- [x] **T14** `state/appState.ts`: 不変更新のリデューサ、ソース往復の保持、ラベル自動投入の適用規則。単体テスト — FR-103, FR-127, AC-08, AC-09
- [x] **T15** `core/compose.ts` を図案ソース対応へ改修（所蔵標本はプレート解像度で直接描画） — FR-123, FR-502, AC-15

## Phase E — UI

- [x] **T16** `ui/dom.ts`・`ui/stage.ts`: 要素取得の集約、空状態・進行表示・レンダーカウンタ — FR-601, FR-602, FR-605
- [x] **T17** `ui/plateBook.ts` + CSS: 図案帳（生成器で描くサムネイル・選択・別個体を採取） — FR-124〜126, FR-607
- [x] **T18** `ui/intake.ts` + CSS: 2 モードの採取カード（索引タブ形式の切り替え） — FR-101, FR-104
- [x] **T19** `ui/controls.ts`・`ui/exportImage.ts`: スライダー・ラジオ・ラベルフォーム・書き出しの結線 — FR-2xx, FR-4xx, FR-5xx
- [x] **T20** `label/geolocation.ts` に独自締め切りを追加。`label/drawLabel.ts` の座標範囲検証と単体テスト — FR-404, FR-405, AC-16
- [x] **T21** `main.ts` をブートストラップのみへ縮小し、統合テスト（jsdom）を追加 — NFR-007.1

## Phase F — 検証

- [x] **T22** E2E（Playwright ×3 エンジン）で AC-01〜AC-19 を検証 — NFR-008.3
- [x] **T23** README を本実装の内容へ更新。Docker ビルドと Pages 前提の確認 — AC-19, AC-20

---

## 完了時の検証記録（2026-08-27）

| 項目 | 結果 |
|---|---|
| `npm run build` | 成功。`dist/` の参照はすべて相対パス（AC-19） |
| `npm run test`（Vitest + v8 カバレッジ） | 15 ファイル / 316 件すべて緑。行 99.44% / 分岐 82.07% / 関数 98.36% / 文 98.22%（しきい値 80% 通過, NFR-008.2） |
| `npx playwright test`（3 エンジン） | 14 件 × chromium / firefox / webkit = 42 件すべて緑（AC-18）。コンソールエラー 0 件 |
| `docker build --no-cache` | 成功。コンテナ起動後 `/` が HTTP 200、`assets/*.js` `assets/*.css` も 200（AC-20）。検証後に image / container を削除済み |
| Pages 前提 | `deploy.json` = `{"pages": true}`、`vite.config.ts` = `base: './'`（NFR-002） |
| 意匠の保全（NFR-006） | コンテナ配信版をブラウザで確認。陳列室の壁＋傾いた索引カード＋真鍮アクセント、書体 3 層、2 色のポスター本体を維持。図案帳の追加で標本キャビネットの構成はむしろ強化された |

**注意**: Vitest と Playwright を同時に走らせると CPU を奪い合い、実装と無関係にタイムアウトで赤くなる
（繊維キャッシュのテストが単独 235ms → 競合時 6.4s で 5s 制限超過、`page.goto` が 30s 超過）。順番に実行すること。
