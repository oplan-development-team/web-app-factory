# 凪の池（Still Pond）

スマートフォンの傾きに応えるフォトリアルな3D水面のヒーリング体験。端末を傾ける、またはマウスでドラッグすると、水面が傾き、波が移流し、水面に浮かぶ蓮の葉や丸石がゆっくりと動く。

## 技術スタック

- Vite + TypeScript + Three.js（UIフレームワークは不使用）
- 環境マップ・法線マップ・小物オブジェクトのテクスチャはすべてプロシージャル生成（外部の画像/HDRIファイルは一切読み込まない）

## セットアップ

```bash
npm install
npm run dev      # 開発サーバー
npm run build    # dist/ に静的ファイルを出力
npm run test     # Vitestでロジック層（src/lib）のユニットテストを実行
```

## ディレクトリ構成

```
src/
├── main.ts            # エントリーポイント（起動フロー全体の配線）
├── style.css           # デザイントークン・UIスタイル
├── lib/                # 純粋関数（傾き検知の判定・状態遷移・文言生成など）。Vitestで単体テスト
├── ui/                 # オンボーディング画面・操作ヒントのDOM構築
└── scene/              # three.jsによる3Dシーン（水面・環境光・小物・ポストプロセス）
```

## 傾き検知の3状態

起動時にfeature detectionで判定する。

| 状態 | 判定条件 | 挙動 |
|---|---|---|
| `ios-permission` | `DeviceOrientationEvent.requestPermission`が関数として存在 | 「はじめる」押下時に許可を要求し、許可されたら傾き検知モードで起動 |
| `sensor` | `'ondeviceorientation' in window` | 許可UIなしで即座に傾き検知モードで起動 |
| `none` | 上記いずれにも該当しない | 許可UIなしで即座にマウスドラッグ入力モードで起動 |

許可が拒否された場合・`requestPermission()`が例外やreject を返した場合は、エラー表示やクラッシュをせずマウスドラッグ入力モードにフォールバックする。

## デザイン方針

`frontend-design`スキルにより「和のライトトーン・静謐な『間』」を具体化した。詳細はPRまたは実装報告を参照。

## Docker

```bash
docker build -t still-pond .
docker run --rm -p 8080:80 still-pond
```

`http://localhost:8080` でアクセスできる。

## GitHub Pages配信

`deploy.json`で`{"pages": true}`を設定済み。`vite.config.ts`の`base`は`'./'`。
