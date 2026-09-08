# タスク — 浮遊光庭 (Ambient Tab Garden)

対応: `docs/SPEC.md` / `docs/PLAN.md`
運用: 1タスク = 1コミット。完了したら `[x]` に更新する。

- [ ] **T01** 足場: `package.json` / `tsconfig.json` / `vite.config.ts` / `index.html` / `deploy.json` / `.gitignore` / `Dockerfile` / `.dockerignore`（AC-09, AC-10, AC-14 / NFR-05, NFR-06）
- [ ] **T02** ドメイン: `constants.ts` / `types.ts`（チューニング値とストレージキーの一元化）
- [ ] **T03** ドメイン: `presence.ts` + テスト — 自レコードupsert・ゴースト除去・タブ表示名（FR-102, FR-105, FR-106, FR-506）
- [ ] **T04** ドメイン: `glimmer.ts` + テスト — 実時間積算・デルタのクランプ・残高導出・retire時のbanked移動（FR-202〜FR-205）
- [ ] **T05** ドメイン: `upgrades.ts` + テスト — 5種の定義・等比コスト・購入可否・効果値の導出（FR-301〜FR-304）
- [ ] **T06** ドメイン: `cluster.ts` + テスト — seedからの決定的なレイアウト・色相・成長段階（FR-107, FR-201）
- [ ] **T07** ドメイン: `format.ts` + テスト — きらめきの桁区切り・経過時間の日本語整形（FR-502）
- [ ] **T08** インフラ: `storage.ts` + テスト — 使用可否プローブ・検証・メモリfallback（FR-603 / NFR-03）
- [ ] **T09** インフラ: `channel.ts` + テスト — BroadcastChannelラッパ・未対応環境でのno-op（FR-104）
- [ ] **T10** スタイル: `tokens.css` / `backdrop.css` / `panels.css` / `layout.css` — モックアップ準拠のグラスモーフィズム（FR-501, 第5章）
- [ ] **T11** 描画: `sprite.ts` / `scene.ts` — レンダラ・カメラ・リサイズ・rAFループ・WebGL不可の検出（FR-501, FR-602 / NFR-01）
- [ ] **T12** 描画: `particles.ts` — クラスタのジオメトリ生成、頂点シェーダによる運動、コア/ハロー2層の加算合成、reduced-motion対応（FR-201, FR-605 / NFR-01, NFR-02）
- [ ] **T13** 描画: `favicon.ts` — canvasから成長段階を反映したPNG data URLを生成し `<link rel="icon">` を差し替え（FR-401〜FR-403）
- [ ] **T14** UI: `stats.ts` / `upgrades.ts` — ステータスパネルとアップグレードパネル、購入フィードバック（FR-502, FR-503, FR-303, FR-304, FR-604）
- [ ] **T15** UI: `notices.ts` — ローディング／マルチタブのヒント／WebGLエラー／ストレージ警告（FR-505, FR-601〜FR-603）
- [ ] **T16** 配線: `main.ts` — tickループ・BroadcastChannel購読・pagehide/visibilitychange・購入ハンドラ（FR-101〜FR-106, FR-305, FR-306）
- [ ] **T17** README（技術選定理由・既知の制約・開発/Docker手順）
- [ ] **T18** 検証: `npm run build` / `npm test`（カバレッジ80%）/ `docker build` + HTTP 200 / サブパス配信（AC-09〜AC-11, AC-14）
- [ ] **T19** 検証: Playwrightでの実操作 — 2タブ同期・タブ閉じ・購入伝播・favicon変化・コンソールエラーゼロ（AC-01〜AC-08）
- [ ] **T20** 検証: `visual-qa` スキルによる視覚的裏取り（境界線の知覚可能性・line-height継承・色の実測）＋モックアップとの配色/パネル処理の突き合わせ
- [ ] **T21** カタログ更新: ルートの `PROJECTS.md` / `PAGES.md`
