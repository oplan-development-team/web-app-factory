# Glitch Print Lab

サイバーパンクなラボ機器の意匠をまとった、ブラウザ完結のデータベンディング（datamoshing）フォトツールです。アップロードした写真（または同梱のサンプル「TEST TARGET 001」）に対して、4層の固定グリッチスタックを適用し、高解像度PNGとして書き出せます。

> このアプリは `app-factory` パイプラインによって自律生成されたプロトタイプです。

## 何をしているか

見た目だけを真似た疑似エフェクトではなく、**実際にcanvasをJPEGとしてエンコードし、得られたバイナリのスキャンデータ領域（SOSマーカー以降）を直接バイト単位で改変してから再デコードする**、本物のバイナリ破壊を実装しています。マーカーバイト（`0xFF`）との衝突を避けるため上書き値は `0x00`–`0xFE` に限定していますが、それでも本物のJPEGデコーダは非常に壊れやすく、パラメータ次第では再デコードに失敗して本物のエラーになります（これは仕様不備ではなく、意図した体験の一部です）。

固定順のグリッチスタック:

1. **JPEG BYTE CORRUPTION** — 実バイナリ破壊（上記）
2. **ROW PIXEL SHIFT** — 帯単位の水平ピクセルシフト（ランダム / 波形）
3. **CHANNEL SEPARATION** — R/Bチャンネルのオフセットによる色収差
4. **SCAN LINE REPLACE** — 一定間隔の水平ラインをノイズ or 複製ラインで置換

## 使い方

1. 画像をドラッグ&ドロップ、またはクリックして選択（JPG / PNG / WEBP）。何もしなくても同梱サンプルで即座に効果を確認できます。
2. 各レイヤーのON/OFFとスライダーでパラメータを調整（変更は自動的にライブプレビューに反映されます）。
3. `REROLL` でシード値を変えて壊れ方そのものを変える（元に戻せません — 気に入ったらすぐ書き出してください）。
4. `PRESET BANKS` からワンクリックで代表的な組み合わせを試せます（VHS DECAY / DATAMOSH CORE / CHROMATIC FRACTURE）。
5. 画面上部に常設された `EXPORT PNG` で、元画像解像度の最終結果をPNGとしてダウンロードします（表示がBefore/Afterどちらでも、書き出しは常にAfter＝加工後の結果です）。

BYTE CORRUPTION RATEを上げすぎると再デコードに失敗することがあります。その場合はラボ風のエラーメッセージが表示され、解消するまでEXPORTは無効化されます。

## 技術構成

- Vite + TypeScript（vanilla、UIフレームワーク不使用）
- Canvas 2D API と ArrayBuffer直接操作のみで完結する完全クライアントサイド構成（バックエンドなし）
- フォント: JetBrains Mono（`@fontsource/jetbrains-mono`）

## 開発

```bash
npm install
npm run dev      # 開発サーバー
npm run build    # 型チェック + 本番ビルド（dist/に出力）
npm run preview  # ビルド結果をローカルで確認
```

## Docker

```bash
docker build -t glitch-print-lab .
docker run --rm -p 8080:80 glitch-print-lab
# http://localhost:8080 で確認
```

`nginx:alpine` が `dist/` を配信する、ビルド専用のマルチステージ構成です。

## デプロイ

`deploy.json` で `{"pages": true}` を宣言しており、完全クライアントサイド構成のためGitHub Pagesでのプレビュー配信に対応しています（`vite.config.ts` は `base: './'` 設定済み）。
