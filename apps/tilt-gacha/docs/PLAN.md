# PLAN: 傾きガチャ（Tilt Gacha）

対応 SPEC: `./SPEC.md`

---

## 1. 前提

プロトタイプは存在しない。**ゼロからの新規実装**である。
ただし同リポジトリの既存アプリから次を参照・踏襲する。

| 参照元 | 踏襲するもの |
|---|---|
| `apps/puddle-tilt/` | `deviceorientation` の扱い（beta / gamma のみを使い alpha は使わない）、Docker マルチステージ、`base: './'` |
| `apps/kamon-generator/` | SDD 成果物の構成（`docs/SPEC.md` / `PLAN.md` / `TASKS.md`）、`lib/` を DOM 非依存に保つ層構造、v8 カバレッジしきい値 80%、決定的生成器（mulberry32）+ シードのみ永続化 |

## 2. アーキテクチャ

```
apps/tilt-gacha/
├── docs/{SPEC,PLAN,TASKS}.md
├── deploy.json                  # {"pages": true}
├── Dockerfile                   # build → nginx:alpine
├── index.html
├── vite.config.ts               # base: './'
├── vitest.config.ts             # v8 coverage, threshold 80
├── playwright.config.ts
├── src/
│   ├── main.ts                  # ブートストラップのみ（カバレッジ除外）
│   ├── style.css
│   ├── lib/                     # ★ DOM に触れない。乱数・時刻は引数で受け取る
│   │   ├── types.ts             # Family / Rarity / TiltBucket / Specimen / TypeId
│   │   ├── constants.ts         # 重み・閾値・寸法・パラメータ範囲の単一情報源
│   │   ├── rng.ts               # mulberry32 / randRange / randInt
│   │   ├── tilt.ts              # classifyTilt（FR-012）
│   │   ├── gacha.ts             # pickFamily / pickRarity / drawSpecimen（FR-030〜033）
│   │   ├── collection.ts        # 収集状態の純粋な更新 + スキーマ検証（FR-200, FR-201.2）
│   │   ├── storage.ts           # localStorage 入出力（例外を飲む層。Storage を注入可能に）
│   │   └── patterns/
│   │       ├── svg.ts           # パス組み立て・数値丸め・要素シリアライズ
│   │       ├── flow.ts / grid.ts / radial.ts / noise.ts
│   │       └── index.ts         # buildPattern ディスパッチ（FR-100）
│   └── ui/
│       ├── dom.ts               # 検査付き要素取得（NFR-008.2）
│       ├── motion.ts            # 許可要求・devicemotion/deviceorientation 購読・シェイク検出・自動降格
│       ├── screens.ts           # 3 画面の表示切替と aria-live
│       ├── reveal.ts            # 出現演出画面の描画
│       ├── collectionView.ts    # 図鑑画面の描画
│       └── app.ts               # 状態機械と配線
└── tests/{unit,integration,e2e}/
```

依存の向き: `ui/* → lib/*`。`lib/` から `ui/` への依存は作らない。

## 3. 状態機械（`ui/app.ts`）

```
        ┌──────────────────────────────────────────┐
        │                                          │
   ┌────▼────┐  tap  ┌──────────┐ granted ┌───────┴──┐ shake ┌────────┐
   │  IDLE   ├──────►│ REQUESTING├────────►│  ARMED   ├──────►│ REVEAL │
   └─────────┘       └────┬─────┘         └────┬─────┘       └───┬────┘
                          │ denied/absent      │ 1200ms 無音     │ 「もう一度振る」
                          │                    │ / タップ        │
                          └────────┬───────────┘                 │
                                   ▼                             │
                             （即時 1 回抽選）──────────────────►│
                                                                 │
                                            「図鑑を見る」        ▼
                                        ┌────────────┐◄──────────┘
                                        │ COLLECTION │
                                        └────────────┘
```

- `REQUESTING` 中も画面は「準備中」を表示する（FR-051）。
- 一度 `granted` になったら以降の `IDLE → ARMED` で許可要求を繰り返さない（FR-403.1）。
- 降格が確定した後は `IDLE` のボタン文言が「タップで引く」意味に変わる（FR-302）。

## 4. リスクと対策

| # | リスク | 対策 |
|---|---|---|
| R1 | iOS の許可要求がユーザージェスチャー文脈を失って拒否される | 2 つの `requestPermission()` を **`await` を挟まず同期パスで両方起動**し、その後 `Promise.all` で待つ（FR-001.1）。この順序を `motion.ts` のコメントで固定する |
| R2 | 「センサーが無い」と「まだ振られていない」を取り違えて、PC で画面が固まる | 判別条件を「**値を伴う `devicemotion` が 1 件も来ない**」に置く。実機は静止時も発火するため十分に分離できる（FR-021）。ヘッドレスで実測して確認する |
| R3 | jitter が強すぎて系統が読めない / 弱すぎて毎回同じに見える | パラメータ範囲を `constants.ts` に集約し、600 標本の不変条件テスト（AC-09）と、同型異シードの差分テスト（AC-11）で両側から縛る |
| R4 | 図鑑 12 マスの同時 SVG 描画が重い | 1 標本あたりの要素数上限 600 をテストで強制（FR-110.2）。図鑑では点数を間引いた縮小版ではなく同一生成物を CSS で縮小し、生成経路を二重化しない |
| R5 | localStorage の破損データで図鑑が壊れる | 読み込み時にエントリ単位でスキーマ検証し、不正なものだけ捨てる（FR-201.2）。壊れた入力パターンを単体テストで網羅（AC-15） |
| R6 | ダークテーマで罫線・破線枠が地に埋もれて見えない | 実装後に `visual-qa` スキルで**実測**する（境界線の知覚可能性）。CSS に書いたことを根拠にしない |
| R7 | モックアップ URL がエージェント環境から開けず、意匠がずれる | SPEC 1.2 にトークンを固定値として書き写し、それを単一情報源とする。ずれの可能性は完了報告で明示する |

## 5. テスト戦略

| 層 | 対象 | 環境 |
|---|---|---|
| 単体 | `tilt` / `gacha` / `rng` / `patterns/*` / `collection` / `storage` | node（DOM 不要） |
| 統合 | `app` の状態遷移、画面描画、localStorage 往復、合成 `devicemotion` によるシェイク | jsdom |
| E2E | フォールバック経路の実ブラウザ確認、横スクロール、コンソールエラー、reduced-motion | Playwright（Chromium / Firefox / WebKit） |

- モンテカルロ分布テスト（AC-04 / AC-06）は seed 固定の mulberry32 を乱数源にして**再現可能**にする。
- E2E は**センサーが存在しないヘッドレス環境**そのものが FR-020 の検証対象になるため、これがフォールバック要件の主検証になる。

## 6. 実装順序の方針

`lib/` を先に完成させ（DOM 不要・テスト容易）、その上に `ui/` を載せる。
模様生成は 4 系統を個別に作り、`index.ts` のディスパッチと不変条件テストで束ねる。
UI は「待機 → 出現演出 → 図鑑」の順に、常に画面が壊れていない状態を保ちながら足す。
