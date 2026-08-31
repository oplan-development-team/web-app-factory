# PLAN — タブ庭園 本実装

対応する仕様: [SPEC.md](./SPEC.md)

## 1. プロトタイプの扱い

**土台として採用する。** ゼロから作り直さない。

| 資産 | 判断 | 理由 |
|---|---|---|
| `src/style.css` (649行) | **維持・拡張** | ネオブルータリズムの設計トークンが完成している。ここを書き直すと採用理由そのものを壊す |
| `src/health.ts` | 維持＋段階追加 | 既に純粋関数。`husk`/`fossil` を足すだけ |
| `src/format.ts` | 維持 | 純粋関数、そのまま使える |
| `src/species.ts` | 維持 | SVGマークアップは意匠そのもの。触らない |
| `src/channel.ts` | 軽微修正 | メッセージ型に `buried` を追加 |
| `src/modal.ts` | 拡張 | 通算記録リセット用トグルを追加 |
| `src/render.ts` (276行) | **分割** | 庭・墓標・統計が1ファイルに同居。責務ごとに分ける |
| `src/storage.ts` | **作り直し** | 機能検出・スキーマ検証・容量上限がすべて欠落 |
| `src/main.ts` (225行) | **作り直し** | import時副作用の塊でテスト不能。ここが唯一の構造的リスク |
| `Dockerfile` / `deploy.json` | 維持 | 既に要件どおり |

## 2. 中心的な設計判断

### 2.1 GardenEngine の抽出（最重要）

現状の `main.ts` は、モジュール読み込みと同時に `crypto.randomUUID()` を呼び、
DOM を引き、`setInterval` を張る。この構造では tick ロジックに一切テストを書けず、
カバレッジ80%は達成不可能。

そこで**副作用を注入する `GardenEngine`** を切り出す。

```ts
interface EngineDeps {
  now: () => number;            // 時刻
  selfId: string;               // タブID
  store: GardenStore;           // localStorage 抽象
  channel: GardenChannel;       // BroadcastChannel 抽象
  isFocused: () => boolean;     // フォーカス判定
}
```

`main.ts` は「本物の依存を組んで `engine.tick()` を定期実行し、結果を描画に渡す」
だけの薄い配線に落とす。テストではフェイク時計とメモリストアを差し込み、
「3分放置したら枯死する」「ゴーストが1基だけ埋葬される」といった時間依存の
挙動を実時間を待たずに検証できる。

### 2.2 純粋関数への寄せ方

状態遷移は `domain/garden.ts` に純粋関数として置き、Engine は「読み込む→純粋関数を
適用する→書き戻す」だけにする。これによりテストの大半が I/O 不要になる。

```
loadState() → applyTick(state, ctx) → { next, buried, unlocked } → saveState(next)
```

### 2.3 競合の扱い

localStorage の read-modify-write は本質的に最終書き込み優先で、完全な排他はできない。
**排他を目指さず、操作を冪等にすることで解決する。**

- 埋葬は ID による重複排除（同じ苗は何度埋葬しても墓標1基）
- 各タブは自分の ID のレコードのみ更新し、他タブのレコードは読んだ値を書き戻す
- 墓標が存在する ID は生存リストから除外（一時的な蘇りの自己修復）

### 2.4 Node 25 の localStorage 問題

このマシンの Node 25 はネイティブ `localStorage` グローバルを持つが、
`--localstorage-file` なしでは **存在するのに `setItem` が関数でない**。しかも
vitest の jsdom 環境で `window.localStorage` を覆い隠す。

対策は2箇所。
- プロダクション側: 存在確認ではなく機能検出にする（FR-300。実環境でも正しい防御）
- テスト側: setup ファイルで使用不能時に in-memory Storage を `window` に差し込む

## 3. 目標ディレクトリ構成

```
src/
  domain/          純粋ロジック（DOM・ストレージ・時刻に非依存）
    types.ts       型定義
    constants.ts   チューニング定数
    health.ts      成熟度・生命力・段階・傾き・スケール
    format.ts      時間の誇張表示
    species.ts     苗のSVG
    rank.ts        罪の階級と次段階までの進捗
    achievements.ts 実績定義と解除判定
    ledger.ts      通算記録の更新
    garden.ts      庭の状態遷移（tick適用・ゴースト掃除・埋葬）
  infra/           外界との境界
    storage.ts     機能検出・検証・容量上限つきストア
    channel.ts     BroadcastChannel ラッパ
  ui/              DOM描画
    garden-view.ts 苗カード
    graveyard.ts   墓標
    scoreboard.ts  統計・階級・実績
    intro.ts       初回説明パネル
    toast.ts       実績トースト
    modal.ts       確認モーダル
  engine.ts        GardenEngine（依存注入）
  main.ts          配線のみ
  style.css
```

## 4. 実装順序と依存関係

```
T1 テスト基盤 ─┬─ T2 domain移設 ─┬─ T3 storage ─┐
               │                  ├─ T4 garden  ─┼─ T7 engine ─┬─ T8 main配線
               │                  ├─ T5 ledger  ─┤             │
               │                  └─ T6 実績/階級 ┘             │
               └──────────────────────────────────┘             │
                                                                 │
T9 UI分割 ─ T10 スコアボード ─ T11 初回説明 ─ T12 トースト ─ T13 段階演出 ┘
                                                                 │
                                                    T14 README ─ T15 検証
```

T1〜T8 がロジック、T9〜T13 がUI、T14〜T15 が仕上げ。
UI着手前に `frontend-design` と `visual-qa` スキルを呼び出す（T0）。

## 5. リスクと対応

| リスク | 影響 | 対応 |
|---|---|---|
| main.ts 作り直しでコアループを壊す | 高 | 先に Engine のテストを書き、既存の挙動を仕様として固定してから配線を差し替える |
| 堅牢化の過程でデザインが薄まる | 高 | `style.css` を書き直さず追記のみ。新規UIも既存トークンだけで組む |
| 放置ゲーム要素の作り込みすぎ | 中 | 通算記録・階級・実績・段階演出の4点に限定。通貨/アップグレードは作らない |
| 時間依存テストの不安定化 | 中 | 実時間を待たず、注入した時計を進めて検証する |
| 単体テストとE2Eの並行実行によるCPU競合 | 中 | 検証は build → 単体 → 手動確認 の順に直列で回す |
| Node 25 の localStorage | 中 | 機能検出＋テストsetupでの差し込み（2.4） |

## 6. 検証方針

1. `npm run build` — 型エラー0
2. `npm run test:coverage` — 全緑・行カバレッジ80%以上
3. `docker build` → 起動 → HTTP 200 → 後片付け（image削除）
4. `vite preview` 上で実ブラウザ確認（複数タブ同期・しおれ・墓標化・コンソールエラー0）
5. `visual-qa` の各項目を計測値で確認
6. Anti-Template Policy の目視確認
