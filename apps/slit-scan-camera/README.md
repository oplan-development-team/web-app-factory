# スリットスキャン・カメラ (Time Smear Camera)

> このアプリは app-factory パイプラインによる自律生成プロトタイプです。

ウェブカメラの1px幅のスリットを時間方向に並べ、動きが流れ静止背景が縞になる「時間を引き伸ばした写真」をライブで撮ってPNG保存します。映像は端末内だけで処理され、外部通信・外部ライブラリはありません。

## 使い方

```
npm install
npm run dev      # http://localhost:5173 （getUserMediaはHTTPS/localhost必須）
npm run build    # dist/ に静的ファイル一式
docker build -t slit-scan-camera . && docker run --rm -p 8080:80 slit-scan-camera
```

- プリセット(フォトフィニッシュ/流れる背景/縞の風景)をタップで即撮影開始
- ワンショット=1周で自動停止 / ストリップ=流れ続け、停止で凍結
- プレビュー上のドラッグでスリット位置を変更
- キーボード(PC): Space=開始/停止, 矢印=スリット位置, S=保存

技術: 素のHTML/CSS/JS + Vite(ビルドでdist/を出力するだけ)。
