# 液だまり — Puddle Tilt

端末を傾けると、画面の中の水たまりが実際に流れ・波打ち、油膜のように虹色に光る感覚トイ。触って眺めるためだけのプロトタイプです。

> このアプリは New_Service_App の app-factory パイプラインによって自律生成されたプロトタイプです。

## できること

- 指でなぞる／タップすると水面に波紋が立つ（センサーの有無に関わらず常時使える主操作）
- スマホの「傾きを有効にする」をタップすると、端末の傾きに応じて水が低いほうへじわっと流れ、素早く傾けるとスロッシュ（波立ち）が強まる
- 水面は高さに応じてティール→マゼンタ→ゴールド→ティールと循環する薄膜干渉風の虹色に光り、傾き方向に鏡面ハイライトが走る
- 「書き出す」で、いまの水面の様子をPNGとして保存できる

## 技術構成

- Vite + TypeScript。UIフレームワークなし、Canvas 2D APIのみ
- `src/lib/heightField.ts` — Float32Arrayの高さ場を使った浅水シミュレーション（2バッファ波紋アルゴリズム＋傾き方向へのセミラグランジュ移流）
- `src/lib/color.ts` — 擬似法線と固定光源から薄膜干渉風の虹色＋鏡面ハイライトを合成
- `src/lib/tilt.ts` — DeviceOrientationEventの生値を傾きベクトルへ変換する純粋関数群
- `src/main.ts` — DOM構築・入力処理（Pointer Events / DeviceOrientationEvent）・レンダーループ
- 純粋ロジックは Vitest で単体テスト（網羅的なテストスイートではなく、プロトタイプとして最低限の確認）

## 開発

```bash
npm install
npm run dev      # http://localhost:5173 で起動
npm run build    # dist/ に静的ビルドを出力
npm run test     # lib/ の単体テスト
```

iOS Safari で傾き検知を試す場合は、HTTPS（またはlocalhost）配信下でアクセスし、画面下部の「傾きを有効にする」をタップして許可ダイアログに応答してください。許可が得られない環境・非対応環境では自動的に指操作のみのモードにフォールバックします。

## Docker

```bash
docker build -t puddle-tilt .
docker run --rm -p 8080:80 puddle-tilt
# http://localhost:8080
```

静的ビルド（`dist/`）を `nginx:alpine` で配信するだけのマルチステージ構成です。
