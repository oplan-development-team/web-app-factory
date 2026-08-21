# PLAN: Halftone QR Generator

対応 SPEC: `./SPEC.md`
**Last updated**: 2026-08-18

---

## 1. 技術スタック選定

| 領域 | 選定 | 理由 |
|------|------|------|
| ビルド | **Vite 8** | 静的出力のみで完結（NFR-002）。Worker / WASM 不要の素の ESM 出力。`base: './'` 対応 |
| UI | **React 19 + TypeScript** | 設定 → プレビューの単方向データフローが素直。状態が 15 個程度あり、素の DOM 操作より宣言的に書けるメリットが大きい |
| テスト | **Vitest** | Vite 設定を共有できる。`environment: 'node'` で純ロジックを高速に回す |
| QR 生成 | **qrcode-generator@2** | 生モジュール行列 (`isDark(r,c)`) だけを取れる軽量ライブラリ。描画機能に依存しない。姉妹アプリでも実績あり |
| 読み取り判定 | **@zxing/library@0.21** | QR デコーダの判定器。**jsQR は使わない**（曲線ファインダーの誤検出・解像度と成功率の逆転挙動を過去に観測しており判定器として信頼できない）。Worker 内で動的 import し初期バンドルから除外 |
| 描画 | **Canvas 2D（素）** | 出力がビットマップ（ハーフトーン）なので SVG の利点がない。`putImageData` で 3N×3N を直接書く |
| フォント | **@fontsource** 同梱 | 外部 CDN を使わない（NFR-001.2） |

**採用しなかった選択肢**

- *素の HTML/CSS/JS*: 状態数と再計算依存関係（画像サンプル結果のキャッシュ、Worker 結果の
  レース制御）が多く、手書きの状態管理は割に合わない。
- *zxing-wasm*: WASM 資産の追加配信が必要で静的ホスティングの手数が増える。
  純 JS の `@zxing/library` で精度要件を満たせる。
- *OffscreenCanvas での Worker 描画*: Safari の対応状況を考慮し、描画はメインスレッド、
  Worker には ImageData のバッファのみ転送する構成にする。

---

## 2. アーキテクチャ

```
入力
 ├─ text ─────────────────────────┐
 └─ ecc ──────────────────────────┤
                                  ▼
                       lib/qr.ts: generateMatrix()
                        → QrMatrix { size, bits, roles }
                                  │
 画像 File ─→ lib/image.ts        │
   loadImage() → ImageSource      │
        │                         │
        ▼ (zoom/offset/明度/コントラスト/反転)
   sampleToGrid(3N×3N) ─→ Float32Array (0..1 luma)   ← NFR-003.4 でメモ化
                                  │
                                  ▼
                lib/halftone.ts: halftone()
                  ├ 中央サブモジュール = bits[r][c]   ← FR-006.2 不変条件
                  ├ 保護モジュール = 全 9 セル固定    ← FR-006.7
                  ├ λ バイアス                        ← FR-006.6
                  └ Floyd–Steinberg（蛇行 + 誤差クランプ）
                                  │
                                  ▼ Uint8Array(3N×3N) 0|1
                   lib/render.ts: toImageData() / drawTo()
                        ├─→ プレビュー canvas（比較表示）
                        ├─→ lib/export.ts: PNG ダウンロード
                        └─→ workers/decode.worker.ts
                                    └ ZXing × 9 条件 → ScanReport
```

### 2.1 モジュール構成

```
src/
├─ lib/
│  ├─ types.ts        設定型・既定値
│  ├─ qr.ts           QR 行列生成 + 機能パターン分類
│  ├─ image.ts        画像読み込み・cover 配置・グレースケール・階調調整
│  ├─ halftone.ts     3×3 分解 + 誤差拡散（中核）
│  ├─ render.ts       サブモジュールグリッド → ImageData / canvas
│  ├─ export.ts       PNG 書き出しと出力寸法計算
│  └─ scan.ts         判定条件マトリクス定義と Worker クライアント
├─ workers/
│  └─ decode.worker.ts  ZXing による実デコード（動的 import）
├─ hooks/
│  ├─ useDebouncedValue.ts
│  ├─ useHalftoneQr.ts   状態管理・パイプライン結線・メモ化
│  └─ useScanReport.ts   Worker のライフサイクルとレース制御
├─ components/
│  ├─ 各 UI
└─ styles/
   ├─ tokens.css / global.css / layout.css / controls.css
```

---

## 3. コアアルゴリズム詳細

### 3.1 機能パターン分類（`lib/qr.ts`）

`qrcode-generator` はモジュールの役割を公開しないため、QR 仕様に基づき自前で座標判定する。

- **finder**: 3 隅の 7×7
- **separator**: finder を囲む 1 モジュール幅の帯
- **timing**: 行 6 / 列 6
- **alignment**: 型番ごとの中心座標表から 5×5。ただし finder と重なる位置は除外
- **format**: finder 周辺の 15bit × 2 箇所
- **version**: version ≥ 7 のときの 6×3 × 2 箇所
- それ以外: **data**

位置合わせパターンの中心座標は QR 仕様 (JIS X 0510) の表を定数として持つ（version 1–40）。

### 3.2 誤差拡散（`lib/halftone.ts`）

```
for y in 0..3N-1:            # 蛇行: 偶数行 L→R, 奇数行 R→L
  for x in (走査方向):
    isCenter   = (x%3==1 && y%3==1)
    isProtected= protectMask[moduleIndex]
    moduleBit  = bits[y/3][x/3]            # 1=黒
    target     = grid[y][x]                # 0..1（1=白）
    if not center and not protected:
      w = subWeight[y%3][x%3]              # 上下左右 1.0 / 斜め 0.55 / 中央 -
      target = target*(1-λ*w) + (1-moduleBit)*(λ*w)
    v = target + err[y][x]
    out = (center or protected) ? (1-moduleBit) : (v >= 0.5 ? 1 : 0)
    e = clamp(v - out, -0.55, 0.55)
    diffuse e to neighbors (7,3,5,1)/16, 走査方向に応じて左右反転
```

**不変条件（FR-006.2）**: `out` の決定で center/protected 分岐が最優先。
λ・階調・画像の内容は `out` に影響しない。テストで全数検証する（NFR-007.2）。

### 3.3 スキャン判定（`workers/decode.worker.ts`）

1. メインスレッドから `{ bits: Uint8Array, size: 3N, quiet: 12, text: string }` を転送。
2. Worker 内で、各条件について
   - サブモジュールを `scale` px に拡大した輝度バッファを生成
   - 半径 `blur` の**箱ぼかしを 2 回**適用（ガウシアン近似 = カメラの softness を模す）
   - `RGBLuminanceSource` → `HybridBinarizer` → `BinaryBitmap` → `QRCodeReader().decode()`
3. 復号テキストが入力と完全一致した場合のみ success。
4. 9 条件の結果配列と成功数を返す。

条件マトリクス: `scale ∈ {2, 3, 5}` × `blur ∈ {0, 1, 2}`。

**レース制御**: リクエストごとに連番 ID を振り、Worker からの応答 ID が
最新でなければ破棄する（FR-008.6）。

### 3.4 再計算の粒度（NFR-003.4）

| 変更対象 | 再サンプリング | ハーフトーン | 判定 |
|----------|--------------|-------------|------|
| text / ecc | ✔ (サイズ変化のため) | ✔ | ✔ |
| 画像 / zoom / offset / 明度 / コントラスト / 反転 | ✔ | ✔ | ✔ |
| λ / 保護レベル | — (キャッシュ再利用) | ✔ | ✔ |
| 書き出し解像度 | — | — | — |

`useMemo` の依存配列でこの粒度を表現する。判定は 300ms デバウンス。

---

## 4. デザイン方針（NFR-006）

**方向性: Darkroom / Print-shop editorial**

ハーフトーンは印刷技術由来の概念なので、「製版・刷版の作業台」を思わせる方向に寄せる。

- **配色**: 生成りの紙色 `oklch(96% 0.008 85)` を地に、インク墨 `oklch(21% 0.012 265)`。
  アクセントは**トンボ（レジストレーションマーク）の朱** `oklch(58% 0.19 32)` 1 色のみ。
  意味付け: 朱 = 現在値・アクティブ・警告の階調に限定して使う（装飾では使わない）。
- **タイポグラフィ**: 見出しに `Archivo Variable`（凝縮グロテスク）、
  数値・ラベルに `IBM Plex Mono`。数値は必ず等幅で出し、スライダー操作中に幅が揺れないようにする。
- **レイヤー**: 用紙 → パネル（微かな影と 1px の罫）→ プレビュー台（沈んだ暗色の面）の 3 層。
  プレビュー台だけ暗くすることで、白い QR が「刷り上がり」に見える。
- **テクスチャ**: 背景に極薄いハーフトーンドットの CSS グラデーションを敷き、
  アプリのテーマ自体を表現する（`prefers-reduced-motion` とは独立、静的）。
- **グリッド**: 左に制御レール（固定幅 340px）、右に比較プレビュー。
  1024px 未満で 1 カラムに落とす。均一なカードグリッドは使わない。
- 姉妹アプリ (Manrope + Instrument Serif、明るいカード基調) とは別物になる。

---

## 5. リスクと対策

| # | リスク | 対策 |
|---|--------|------|
| R-1 | ハーフトーン化でスキャン不能になる | 判定を「実デコード」で行い（FR-008）、改善助言を出す。既定値（λ=0.35 / 保護=標準 / ECC=H）は安全側に振る |
| R-2 | ZXing のバンドルが重く初期表示を害する | Worker 内で動的 import。初期バンドルから完全に排除し、build 後に実測して確認 |
| R-3 | 3N×3N の誤差拡散がスライダー操作で重い | Float32Array での 1 次元処理、割り当てゼロのループ。実測して NFR-003.2 を確認 |
| R-4 | 位置合わせパターン座標表の実装ミス | version 1–40 の表をテストで検証（既知の値と件数） |
| R-5 | Vite の Worker + 動的 import がビルドで壊れる | `new Worker(new URL(...), {type:'module'})` 形式を使い、build 後の実ファイルで検証 |
| R-6 | 誤差クランプの値が不適切で縞が出る | ±0.55 を初期値とし、実画像で目視確認して調整 |

---

## 6. 将来拡張（今回はやらない）

- 論文にある誤り訂正符号の再エンコード最適化（等価コードワード探索による画像適合度向上）
- カラー画像対応（3 チャネル別ハーフトーン / パレット制約）
- ブルーノイズ・ドット集中型など誤差拡散以外のハーフトーン手法の選択
- SVG / PDF 書き出し

---

## 7. 検証計画

1. `npm test` — 単体テスト（NFR-007）
2. `npm run build` — 型チェック + 本番ビルド、バンドルサイズ実測
3. `grep` による外部通信コードの不在確認（AC-09）
4. Playwright（Bash から直接起動）による実ブラウザ検証:
   - コンソールエラー 0 件（AC-13）
   - 画像アップロード → ハーフトーン生成 → 判定表示 → PNG 書き出しの通し
   - 360 / 768 / 1024 / 1440px でのレイアウト崩れ・横スクロール確認（AC-10）
   - キーボードのみでの到達確認（AC-11）
5. 書き出した PNG を ZXing で独立にデコードし、テキスト一致を確認（AC-05）
