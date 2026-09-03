
### [14:45:00] prototype-builder（初回実装） — shot-splice-brutal実装完了、visual-qaで2件の実バグを検出・修正
- 結果: apps/shot-splice-brutal/ にVite+TypeScriptで実装。frontend-designでネオブルータリズム(暗室配色: クリーム地+コバルトブルー+アシッドライム+警告オレンジ)を先に決定してから着手。重なり自動検出は粗探索→精密探索の2段階アルゴリズムを自前実装し、合成PNGの400x1000pxテスト画像(既知overlap=120px)で完全一致を確認。
- visual-qaフェーズで実際にブラウザ操作して検証したところ、コードは書けていたが目視で気づけない不具合を2件発見・修正した。
  1. `.stage-empty[hidden]`が`.stage-empty{display:flex}`と同じ詳細度で衝突し、画像読込後も空状態メッセージが消えずレイアウトが崩れていた → `.stage-empty[hidden]{display:none}`を明示追加。
  2. 差分表示モード(mix-blend-mode:difference)が、初期状態(前面画像=TOP)では常に何も見えない致命的なバグだった。前面トグルでz-indexが入れ替わるのに対し、blend-modeは`#layer-bottom-wrap`固定で付けていたため、blend対象レイヤーが背面に回ると不透明な前面レイヤーに完全に隠されていた。CSSセレクタを`front-top`クラスと連動させ、実際に前面(z-index上位)にあるレイヤー側にblendを付けるよう修正。修正後、既知overlap画像で重なり領域が正しく黒帯として表示されることを確認。
  3. 副次的に、空状態のスロットでTOP/BOTTOMバッジがヒントテキストと重なって読めなくなっていたのも発見・修正(slot-bodyのpadding-topを確保)。
- コントラスト比・line-height継承・キーボードフォーカスの可視性も数値で裏取り済み(本文15:1、ボタン5.6〜14:1、readoutパネル10〜11:1、ボタン/入力欄のline-heightはbodyの1.5でなく明示的に1.2、Tabキーでの実フォーカスでoutline 3px可視化を確認)。
- `npm run build`・`docker build`・コンテナ起動(curl 200確認、後片付け済み)も全て独立検証済み。
