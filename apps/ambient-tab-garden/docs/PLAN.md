# 実装計画 — 浮遊光庭 (Ambient Tab Garden)

対応仕様: `docs/SPEC.md`

## 技術選定

| 領域 | 採用 | 理由 |
|---|---|---|
| ビルド | Vite + TypeScript | リポジトリの他アプリと揃える。`base: './'` でPagesのサブパス配信に対応 |
| 描画 | three.js（`Points` + 自前 `ShaderMaterial`） | 本アプリの主題が「実際の3D空間に浮かぶ粒子」であるため。2D canvasの疑似3Dでは奥行きのパララックスが出ない |
| 発光 | 加算合成の2層ポイントスプライト（コア／ハロー） | ポストプロセスのブルームはバンドルとGPU負荷が重い。パネルの `backdrop-filter` と併用すると合成順の制御も面倒になる |
| UI | 素のDOM + CSS | パネル2枚とヒント1枚のみ。フレームワークを入れる理由がない（YAGNI） |
| 状態同期 | `BroadcastChannel`（即時）+ `localStorage`（永続・結果整合） | 仕様で確定済み |
| テスト | Vitest（jsdom） | ドメイン層の純関数を対象。WebGL層は対象外 |

## モジュール構成

```
src/
├── main.ts                アプリ配線（tick ループ、イベント購読、各層の接続）
├── domain/                純粋なロジック。DOM も three.js も参照しない
│   ├── constants.ts       チューニング値・ストレージキー
│   ├── types.ts           共有型
│   ├── presence.ts        タブレジストリ（自レコードupsert / ゴースト除去 / タブ表示名）
│   ├── glimmer.ts         きらめきの積算・残高計算
│   ├── upgrades.ts        アップグレード定義・コスト・効果値
│   ├── cluster.ts         seed → クラスタの位置・色相・粒子レイアウト（決定的）
│   └── format.ts          数値・経過時間の表示整形
├── infra/
│   ├── storage.ts         localStorage ラッパ（使用可否プローブ / 検証 / メモリfallback）
│   └── channel.ts         BroadcastChannel ラッパ（未対応環境ではno-op）
├── render/
│   ├── scene.ts           renderer / camera / resize / rAF ループ
│   ├── particles.ts       クラスタ→BufferGeometry・シェーダ・差分更新
│   ├── sprite.ts          ポイントスプライトのテクスチャ生成
│   └── favicon.ts         canvas → PNG data URL → <link rel="icon">
├── ui/
│   ├── stats.ts           右上のステータスパネル
│   ├── upgrades.ts        左下のアップグレードパネル
│   └── notices.ts         ヒント／ローディング／エラー／ストレージ警告
└── styles/
    ├── tokens.css         デザイントークン
    ├── backdrop.css       背景グラデーション・にじみ・ダスト
    ├── panels.css         ガラスパネル
    └── layout.css         四隅配置・レスポンシブ
```

## 状態モデル

**共有状態（localStorage）**

- `atg:tabs:v1` → `TabPresence[]`
  各タブが自分の1件だけを更新する。`{ id, openedAt, lastSeenAt, seed, earned }`
- `atg:progress:v1` → `Progress`
  `{ banked, spent, levels: Record<UpgradeId, number> }`
- `atg:hint-dismissed:v1` → `'1'`

**タブローカル状態（sessionStorage）**

- `atg:tab-id:v1` → `tabId`（リロードで同一タブ扱いにするため）

**残高の導出**

```
balance = progress.banked + Σ(生存タブの earned) - progress.spent
```

タブがレジストリから除去されるとき、その `earned` を `banked` に移す。移動なので残高は連続する。

複数タブが同時に同じゴーストを除去しようとした場合、この読み取り→計算→書き込みは最終書き込み勝ちで**同じ結果に収束する**（どちらのタブも「ゴーストを消して banked に足した」状態を書くため、二重加算にならない）。リーダー選出は行わない。

## リスクと対策

| リスク | 対策 |
|---|---|
| バックグラウンドタブのタイマー間引きで、生きているタブがゴースト判定される | ゴーストのタイムアウトを120秒（Chromeの最短1分間引きの2周期分）に設定。さらに `visibilitychange` で前面復帰時に即時再登録 |
| ブラウザによるバックグラウンドタブの凍結で、一時的にレジストリから消える | きらめきは実時間差分から積算するため進捗は失われない。復帰時に自レコードを書き戻せば復元する。READMEに既知の制約として明記 |
| 粒子数の増加でCPU座標更新がボトルネックになる | 運動を頂点シェーダに寄せ、CPUは時間uniformの更新のみ。ジオメトリ再構築は粒子数が変わる瞬間だけ |
| `backdrop-filter` がWebGLキャンバス上で効かない/重い | キャンバスは背面の1枚のみ。パネルは通常のDOMレイヤーに置き、`isolation` を作らない。実機で目視確認する |
| Google Fonts の読み込み遅延で文字が入れ替わり、レイアウトがずれる | `font-display: swap` + 数値表示に `font-variant-numeric: tabular-nums` と最小幅を確保 |
| 参照モックアップの背景グラデーション末尾の色指定が `#f6efe f`（空白混入で不正値）になっている | 意図は `#f6efef` と解釈して修正して実装する。SPEC/READMEに記録 |

## フェーズ

1. **足場**: package.json / tsconfig / vite.config / index.html / deploy.json / Dockerfile / .dockerignore
2. **ドメイン**: constants・types・presence・glimmer・upgrades・cluster・format（テスト同時）
3. **インフラ**: storage・channel（テスト同時）
4. **描画**: sprite・scene・particles・favicon
5. **UI・スタイル**: tokens/backdrop/panels/layout・stats・upgrades・notices
6. **配線**: main.ts（tickループ、購読、ライフサイクル）
7. **検証**: build / test / docker / Playwright実操作 / visual-qa / サブパス配信
