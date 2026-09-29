# ペーパークロマトグラフィ・ラボ

円形濾紙にインク滴を落とすと、顔料ごとの移動速度差で色が同心円状の帯に分離していく様子を Canvas で観察し、乾燥させて標本ラベル付き PNG（1600x2000px）として書き出すツール。

> app-factory パイプラインによる自律生成プロトタイプです。採否は未確定です。

## 使い方

```bash
npm install
npm run dev      # 開発サーバー
npm run build    # dist/ に静的サイトを出力
docker build -t paper-chromatography-lab . && docker run --rm -p 8080:80 paper-chromatography-lab
```

1. 試料（インク）を選ぶ（6種のプリセット + CMY 自作ブレンド）
2. 濾紙をクリック／タップして滴下（キーボードは矢印キー + Enter/Space）
3. 展開を見守る（一時停止、1x/4x/16x）
4. 乾燥させる
5. 標本ラベルを整えて PNG を書き出す（ファイル名は `PC-0427.png` 形式）

## 技術選定

Vite + TypeScript、ランタイム依存なし。シミュレーションは低解像度格子(224x224)上の顔料濃度を、水の前線(sqrt(t))と成分ごとの Rf から解析的に再構成し、補間拡大して描画します（見た目に説得力のある近似であり、厳密な物理計算ではありません）。フォントはシステムの serif/monospace スタックのみ。
