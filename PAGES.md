# PAGES

`apps/<slug>/` にバックエンド不要（完全クライアントサイド）で `deploy.json` の `pages` が `true` のアプリの、GitHub Pagesプレビュー一覧。mainへのマージ時に自動でデプロイされる（`.github/workflows/pages-deploy.yml`）。すべてのプレビューへのリンクは [Pages一覧ページ](https://oplan-development-team.github.io/web-app-factory/) からも辿れる。

**これはあくまで動作確認・共有用のプレビューであり、本番デプロイは行わない。** 本番運用する場合は `.claude/CLAUDE.md` の「本番デプロイの方針（コンテナ化）」に従い、Dockerでのデプロイが必須。

| アプリ | 説明 | プレビュー | ステータス | 作成日 |
|---|---|---|---|---|
| 生まれた瞬間の星空ポスタージェネレーター | 日時・場所を入力すると、その瞬間その場所から見えていた星空を天文計算で再現し、測量図風の円形星図ポスターにする | [Pages](https://oplan-development-team.github.io/web-app-factory/birth-sky-poster/) | 完成 | 2026-08-21 |
| ハーフトーンQR | 画像を網点に分解し、QRコードの模様そのものに溶け込ませるジェネレーター | [Pages](https://oplan-development-team.github.io/web-app-factory/halftone-qr/) | 完成 | 2026-08-18 |
| QRコードデザインツール | ロゴ埋め込み・ドット形状・グラデーションに対応した、デザイン性の高いQRコード生成ツール | [Pages](https://oplan-development-team.github.io/web-app-factory/qr-code-designer/) | 完成 | 2026-08-17 |
| オリジナル家紋ジェネレーター「家紋帳」 | 名前や誕生日などの文字列をシードに、左右対称・点対称の家紋風紋様を自動生成する | [Pages](https://oplan-development-team.github.io/web-app-factory/kamon-generator/) | 完成 | 2026-08-24 |
| 署名のリボン光跡 | マウス/タッチで描いた署名を、速度に応じて発光するリボンとして描き、ポスターに書き出す | [Pages](https://oplan-development-team.github.io/web-app-factory/signature-ribbon-poster/) | 完成 | 2026-08-24 |
| クリップボード詩人（Clipboard Poet） | セッション中にコピーしたテキスト断片を、感熱レシート風に溜め込みながら「見つけ詩」に組み替える | [Pages](https://oplan-development-team.github.io/web-app-factory/clipboard-poet/) | プロトタイプ（採否待ち） | 2026-08-25 |
| 架空の美術館キャプションジェネレーター | 手元の物（弁当の空き容器など）の写真から、現代アート展の壁面解説文風のキャプションを自動生成するネタツール | [Pages](https://oplan-development-team.github.io/web-app-factory/museum-caption-generator/) | プロトタイプ（採否待ち） | 2026-08-21 |
| 声の地層（Voice Strata Poster） | マイクで録った声の音量・ピッチ・間を、地質調査のボーリングコア風の縞地層としてリアルタイム描画する | [Pages](https://oplan-development-team.github.io/web-app-factory/voice-strata-poster/) | プロトタイプ（採否待ち） | 2026-08-25 |
| レシート詩集ジェネレーター | 品名・数量・金額を入力すると感熱レシート風にプレビューされ、「詩として読む」切替で品名だけの詩に姿を変える | [Pages](https://oplan-development-team.github.io/web-app-factory/receipt-poem-generator/) | プロトタイプ（採否待ち） | 2026-08-25 |
| サイアノタイプ・ポスターメーカー | 写真をプルシアンブルーの二階調に変換し、植物標本ラベル付きのサイアノタイプ風ポスターにする | [Pages](https://oplan-development-team.github.io/web-app-factory/cyanotype-poster-maker/) | 完成 | 2026-08-26 |
| サウンド・レコードレーベル・ジェネレーター（Vinyl Groove Label） | 音声の振幅エンベロープをレコード盤面の同心円グルーヴに変調して描画し、高解像度PNGで書き出せるツール | [Pages](https://oplan-development-team.github.io/web-app-factory/vinyl-groove-label/) | プロトタイプ（採否待ち） | 2026-08-28 |
| The Column Daily（コラムメディアサイト） | ヴィンテージ新聞・エディトリアルスタイルのコラムメディアサイト（記事閲覧・検索・投稿UIのデモ） | [Pages](https://oplan-development-team.github.io/web-app-factory/column-daily/) | 完成 | 2026-08-28 |
| レシート詩集ポスター（Receipt Poetry Scroll） | 買い物リスト等の行区切りテキストを、値段付きの感熱紙ロール風縦長ポスターに変換する（姉妹アプリと違い値段は自動算出） | [Pages](https://oplan-development-team.github.io/web-app-factory/receipt-poetry-scroll/) | プロトタイプ（採否待ち） | 2026-08-26 |
| アンビエント映画字幕オーバーレイ | Webカメラ映像に、音量・動き検出だけで映画風のフェイク字幕をリアルタイムに重ねるネタツール | [Pages](https://oplan-development-team.github.io/web-app-factory/ambient-subtitle-cam/) | プロトタイプ（採否待ち） | 2026-08-26 |
| 等高線ドローイング（Contour Draw） | マウス/タッチで自由に描いた線を、測量図・地形図風の等高線ポスターに変換する | [Pages](https://oplan-development-team.github.io/web-app-factory/contour-draw/) | プロトタイプ（採否待ち） | 2026-08-27 |
| 等高線ポートレート（Contour Portrait） | アップロードした写真の明暗を標高に見立て、等高線だけで描く測量図風ポートレート・ジェネレーター | [Pages](https://oplan-development-team.github.io/web-app-factory/contour-portrait/) | プロトタイプ（採否待ち） | 2026-08-24 |
| 締切フライト案内板 | 複数の締切・予定日を登録すると、空港の発着案内板のようなパタパタ表示で残り日数を見せるボード | [Pages](https://oplan-development-team.github.io/web-app-factory/deadline-departure-board/) | プロトタイプ（採否待ち） | 2026-08-24 |
| 標本図鑑プレート・ジェネレーター | 手元の植物・貝殻などの写真を、銅版画エングレービング風の19世紀博物誌図版に変換する | [Pages](https://oplan-development-team.github.io/web-app-factory/specimen-plate-generator/) | プロトタイプ（採否待ち） | 2026-08-24 |
| タブ庭園（Tab Guilt Garden） | このアプリを開いた各タブに苗が生え、放置するとしおれ、閉じると墓標が残る「タブを溜め込みがちな自分」への自虐ジョークツール。放置ゲームとしての階級・実績もあり | [Pages](https://oplan-development-team.github.io/web-app-factory/tab-guilt-garden/) | 完成 | 2026-08-26 |
| 液だまり（Puddle Tilt） | 端末を傾けると画面の中の水たまりが実際に流れ・波打ち、油膜のように虹色に光る感覚トイ | [Pages](https://oplan-development-team.github.io/web-app-factory/puddle-tilt/) | プロトタイプ（採否待ち） | 2026-08-31 |
| 校正記号diffビューア（Proofmark Diff） | 改稿前後のテキストを、紙の校正で使われる校正記号（トルツメ・キャレット・ルビ訂正・移動矢印）の見た目で差分表示する | [Pages](https://oplan-development-team.github.io/web-app-factory/proofmark-diff/) | プロトタイプ（採否待ち） | 2026-08-28 |
| オーロラ・テルミン（Aurora Theremin） | マウス/指の位置と速度でWeb Audioのテルミン風シンセを演奏し、録音・ループ・重ね録りもできる楽器トイ | [Pages](https://oplan-development-team.github.io/web-app-factory/aurora-theremin/) | プロトタイプ（採否待ち） | 2026-08-29 |
| ハーモノグラフ・ジェネレーター 振り子の詩 | 複数の減衰振り子の合成ベクトルをリアルタイム計算し、実機ハーモノグラフ玩具さながらのインクの渦巻き曲線を紙面に描く作品性ツール | [Pages](https://oplan-development-team.github.io/web-app-factory/harmonograph-generator/) | プロトタイプ（採否待ち） | 2026-08-29 |
| クラドニ図形ポスタージェネレーター（Chladni Cymatics Poster Lab） | 振動モードを指定すると、砂粒子がChladni図形の節線に収束する物理シミュレーションを描画し、実験記録ポスターとして書き出す | [Pages](https://oplan-development-team.github.io/web-app-factory/chladni-poster-lab/) | プロトタイプ（採否待ち） | 2026-08-30 |
| せーのテレパシー（Sync Reveal Party Game） | 2人で画面を回し使いし、伏せ字で入力したお題への回答を「せーの」で同時公開して一致度を競うパーティーゲーム | [Pages](https://oplan-development-team.github.io/web-app-factory/sync-reveal-party/) | プロトタイプ（採否待ち） | 2026-08-30 |
| スクショ継ぎ足し工房（暗室版） | 2枚に分けたスクリーンショットの重なりを自動検出し1枚に継ぎ足す。写真暗室・アナログ現像室スタイル | [Pages](https://oplan-development-team.github.io/web-app-factory/shot-splice-darkroom/) | プロトタイプ（採否待ち） | 2026-09-01 |
| スクショ継ぎ足し工房（スイス様式版） | 同上の機能をスイス/インターナショナル・スタイルの計測器デザインで | [Pages](https://oplan-development-team.github.io/web-app-factory/shot-splice-grid/) | プロトタイプ（採否待ち） | 2026-09-01 |
| スクショ継ぎ足し工房（ネオブルータリズム版） | 同上の機能をネオブルータリズムの荒々しい実用ツールデザインで | [Pages](https://oplan-development-team.github.io/web-app-factory/shot-splice-brutal/) | プロトタイプ（採否待ち） | 2026-09-01 |
| スクショ継ぎ足し（Shot Splice） | 複数枚のスクリーンショットの重なりを自動検出して1枚に継ぎ足す。iOSライク・モバイルファーストの本実装版 | [Pages](https://oplan-development-team.github.io/web-app-factory/shot-splice/) | 完成 | 2026-09-01 |
| 傾きガチャ（Tilt Gacha） | 端末を振ると、その瞬間の傾きに応じた幾何学模様が1枚出現し、12種の型を集める図鑑が埋まっていく感覚トイ | [Pages](https://oplan-development-team.github.io/web-app-factory/tilt-gacha/) | 完成 | 2026-09-02 |
| ブルーノート風ジャズジャケット・ジェネレーター（Blue Note Cover Studio） | 架空のバンド名・アルバム名から、ブルーノート・レコードのグラフィックデザイン規範（斜めデュオトーン写真ブロック・極端な字間タイポグラフィ・限定2色配色）に従ったジャケットを自動生成する | [Pages](https://oplan-development-team.github.io/web-app-factory/blue-note-cover-studio/) | プロトタイプ（採否待ち） | 2026-09-01 |
| 墨流しマーブリング・スタジオ（Suminagashi Marbling Studio） | 水盤にインクを落とし、櫛・渦でなぞって模様を作り込み、紙に「浸して引き上げ」て継ぎ目のないタイル/ポスターとして持ち帰るデジタル工芸ツール | [Pages](https://oplan-development-team.github.io/web-app-factory/suminagashi-marbling/) | プロトタイプ（採否待ち） | 2026-08-31 |
| 年輪ポスター（Life Rings） | 生まれた年と人生の出来事を入力すると、有機的に歪んだ年輪・節・放射割れ・木目テクスチャを持つ「自分だけの年輪ポスター」を書き出せるツール | [Pages](https://oplan-development-team.github.io/web-app-factory/life-rings-poster/) | プロトタイプ（採否待ち） | 2026-08-31 |
| 枯山水コンポーザー（Karesansui Composer） | 砂庭に石を置くと、石を避けながら砂紋（箒目）が自動で流れる禅庭シミュレーター。完成した庭をPNG/SVGポスターとして書き出せる | [Pages](https://oplan-development-team.github.io/web-app-factory/karesansui-composer/) | プロトタイプ（採否待ち） | 2026-09-02 |
| 架空紙幣スタジオ（Guilloche Currency Studio） | 国名・通貨単位・額面・肖像シードから、ギヨーシェ彫刻風の紋様を自前実装で生成し、実在しない国の紙幣として高解像度PNG/SVGで書き出す | [Pages](https://oplan-development-team.github.io/web-app-factory/guilloche-currency-studio/) | プロトタイプ（採否待ち） | 2026-09-03 |
| リソグラフ再現ポスターメーカー（Riso Print Simulator） | 写真・テキスト・図形を2〜3色のリソグラフ風インク版に分解し、網点化・版ズレ・オーバープリントまで再現してポスターとして書き出すツール | [Pages](https://oplan-development-team.github.io/web-app-factory/riso-print-simulator/) | プロトタイプ（採否待ち） | 2026-09-04 |
| 黒塗りメタデータ開示装置（Redacted EXIF） | 写真のEXIF/GPS/端末情報を「情報公開請求で黒塗りされた公文書」として演出的に開示し、GPS地点を一度きりプレビューしてからワンクリックでメタデータを完全除去する | [Pages](https://oplan-development-team.github.io/web-app-factory/redacted-exif/) | プロトタイプ（採否待ち） | 2026-09-05 |
| カーソル相撲（Cursor Sumo） | 同じキーボードを囲んだ2人が円形の力士を土俵から押し出し合う、突っ張りダッシュと行司の煽りコメントが核のローカル対戦フィジックスゲーム | [Pages](https://oplan-development-team.github.io/web-app-factory/cursor-sumo/) | プロトタイプ（採否待ち） | 2026-09-06 |
| タイピング心電図 | 打鍵のkeydown間隔だけを計測し、病院の心電図モニター風UIでリアルタイムに波形と診断結果を描くネタツール | — （Pages未対応、下記参照） | 保留 | 2026-08-24 |
| 指先の集会 — コイン・セアンス | 複数人が同じ画面に指を置き、多点タッチの重心を「玉」として追跡・自律ドリフトさせる疑似こっくりさんボード | [Pages](https://oplan-development-team.github.io/web-app-factory/coin-seance/) | プロトタイプ（採否待ち） | 2026-09-07 |
| 紙雪の結晶スタジオ（Kirigami Snowflake Studio） | 「折る→切る→開く」の紙工作手順を疑似体験しながら六角対称の切り紙雪結晶をデザインし、ハサミで作れるSVG型紙とPNG完成イメージを書き出せるツール | [Pages](https://oplan-development-team.github.io/web-app-factory/kirigami-snowflake-studio/) | プロトタイプ（採否待ち） | 2026-09-08 |
| 浮遊光庭（Ambient Tab Garden） | このアプリを複数タブで開くと、タブごとに光のパーティクル群が育つ観賞用アンビエント・ジェネレーティブアート。放置時間で貯まる「きらめき」でアップグレードしていく | [Pages](https://oplan-development-team.github.io/web-app-factory/ambient-tab-garden/) | 完成 | 2026-09-08 |
| ステンドグラス・コンポーザー（Rosette Glass Composer） | ゴシック窓の輪郭内に宝石色の点を打つと、距離場ベースの鉛線分割で1枚のステンドグラスが自動生成され、バックライト/自然光の2状態でPNG書き出しできる | [Pages](https://oplan-development-team.github.io/web-app-factory/rosette-glass-composer/) | プロトタイプ（採否待ち） | 2026-09-09 |
| 線香花火シミュレーター（Ephemeral Sparkler） | 花火の先端を長押しすると蕾→牡丹→松葉→散り際の4段階で燃え、消えた瞬間までの光跡を長時間露光風の記念写真として持ち帰れる一期一会の体験アプリ | [Pages](https://oplan-development-team.github.io/web-app-factory/ephemeral-sparkler/) | プロトタイプ（採否待ち） | 2026-09-10 |
| クイックドロー・デュエル（Quick Draw Duel） | 1台の端末を挟んだ対面2人対戦。ランダム遅延後の「DRAW!」サインに先に反応した方が勝ち、フライングは即BANGで敗北する早撃ちリアクションゲーム | [Pages](https://oplan-development-team.github.io/web-app-factory/quick-draw-duel/) | プロトタイプ（採否待ち） | 2026-09-10 |

タイピング心電図は `deploy.json` の `pages` が `false`（ビルドが`dist/`を生成しない構成のため、現状Pagesワークフローの対象外）。
