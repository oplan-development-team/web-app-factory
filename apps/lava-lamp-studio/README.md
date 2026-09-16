# Lava Lamp Studio (溶岩ランプ・スタジオ)

60〜70年代のラバランプを、自前実装の温度場・浮力シミュレーションと marching squares メタボール描画で再現したレトロフューチャリズムなデスクトップ装飾スタジオです。色相・粘度・加熱強度・液滴数をクロームのダイヤルで操作しながら、ループ動画(WebM)やGIFとして書き出せます。

> **本アプリは app-factory パイプライン（New_Service_App の自律プロトタイピング機構）によって自律生成されたプロトタイプです。**

## できること

- ガラス筐体の内側で、底面からの加熱による対流をシミュレーションした液滴（メタボール）がゆらめく
- クロームのロータリーノブで以下をリアルタイム操作
  - **HUE**（色相） / **VISCOSITY**（粘度・動きの重さ） / **HEAT**（加熱強度） / **DROPLETS**（液滴数 4〜10）
- 色相クイックプリセット3種（クラシック橙 / サイケ紫 / レトログリーン）
- ガラス面をクリック/タップすると、その位置に熱パルスを注入（波紋の視覚フィードバック付き）
- 4 / 8 / 12 秒のクリップを **WebM**（`MediaRecorder`）または **GIF**（`gif.js`）として書き出し・ダウンロード

## 技術メモ

- Vite + TypeScript、描画は Canvas 2D のみ（WebGL不使用）
- `src/lib/` はUI非依存の純粋ロジックで、Vitestで単体テスト可能
  - `thermalField.ts` — 2D温度場グリッド（Float32Array）の自前差分計算（熱注入・拡散・上昇移流・冷却減衰）
  - `droplets.ts` — 各液滴の浮力・粘度・オイラー積分による自前の運動シミュレーション
  - `marchingSquares.ts` — メタボールのスカラー場計算 + marching squares による輪郭抽出（セル単位でポリゴンを塗り、隣接セルの頂点補間を共有することでシームレスな1枚のブロブに見せる）
  - `simulation.ts` — 上記をまとめるUI非依存のオーケストレーション層
- `src/ui/` はDOM/Canvas側（クロームノブ、ランプの口金/ベースSVG、Canvasレンダラー、書き出し処理）
- フォントは `@fontsource` で自己ホスト（Bungee / Space Grotesk / Space Mono）。外部CDN依存なし
- 完全な物理的シームレスループは保証しません（UI上にも明記しています）

## 開発

```bash
npm install
npm run dev       # 開発サーバー
npm run build     # tsc + vite build → dist/
npm run preview   # dist/ をローカルでプレビュー
npm test          # Vitest（src/lib/ の単体テスト）
```

## Docker

静的サイトなので、マルチステージ構成でビルドし `nginx:alpine` で配信します。

```bash
docker build -t lava-lamp-studio .
docker run --rm -p 8080:80 lava-lamp-studio
# http://localhost:8080/ で確認
```

## デプロイ

`deploy.json` で `{"pages": true}` としており、`vite.config.ts` は `base: './'` のため、GitHub Pages のサブパス配信（`/web-app-factory/lava-lamp-studio/`）でも問題なく動作します。
