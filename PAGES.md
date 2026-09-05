# PAGES

`apps/<slug>/` にバックエンド不要（完全クライアントサイド）で `deploy.json` の `pages` が `true` のアプリの、GitHub Pagesプレビュー一覧。mainへのマージ時に自動でデプロイされる（`.github/workflows/pages-deploy.yml`）。すべてのプレビューへのリンクは [Pages一覧ページ](https://oplan-development-team.github.io/web-app-factory/) からも辿れる。

**これはあくまで動作確認・共有用のプレビューであり、本番デプロイは行わない。** 本番運用する場合は `.claude/CLAUDE.md` の「本番デプロイの方針（コンテナ化）」に従い、Dockerでのデプロイが必須。

| アプリ | 説明 | プレビュー | ステータス |
|---|---|---|---|
| 生まれた瞬間の星空ポスタージェネレーター | 日時・場所を入力すると、その瞬間その場所から見えていた星空を天文計算で再現し、測量図風の円形星図ポスターにする | [Pages](https://oplan-development-team.github.io/web-app-factory/birth-sky-poster/) | 完成 |
| ハーフトーンQR | 画像を網点に分解し、QRコードの模様そのものに溶け込ませるジェネレーター | [Pages](https://oplan-development-team.github.io/web-app-factory/halftone-qr/) | 完成 |
| QRコードデザインツール | ロゴ埋め込み・ドット形状・グラデーションに対応した、デザイン性の高いQRコード生成ツール | [Pages](https://oplan-development-team.github.io/web-app-factory/qr-code-designer/) | 完成 |
| オリジナル家紋ジェネレーター「家紋帳」 | 名前や誕生日などの文字列をシードに、左右対称・点対称の家紋風紋様を自動生成する | [Pages](https://oplan-development-team.github.io/web-app-factory/kamon-generator/) | 完成 |
| 署名のリボン光跡 | マウス/タッチで描いた署名を、速度に応じて発光するリボンとして描き、ポスターに書き出す | [Pages](https://oplan-development-team.github.io/web-app-factory/signature-ribbon-poster/) | 完成 |
| クリップボード詩人（Clipboard Poet） | セッション中にコピーしたテキスト断片を、感熱レシート風に溜め込みながら「見つけ詩」に組み替える | [Pages](https://oplan-development-team.github.io/web-app-factory/clipboard-poet/) | プロトタイプ（採否待ち） |
| 架空の美術館キャプションジェネレーター | 手元の物（弁当の空き容器など）の写真から、現代アート展の壁面解説文風のキャプションを自動生成するネタツール | [Pages](https://oplan-development-team.github.io/web-app-factory/museum-caption-generator/) | プロトタイプ（採否待ち） |
| 声の地層（Voice Strata Poster） | マイクで録った声の音量・ピッチ・間を、地質調査のボーリングコア風の縞地層としてリアルタイム描画する | [Pages](https://oplan-development-team.github.io/web-app-factory/voice-strata-poster/) | プロトタイプ（採否待ち） |
| レシート詩集ジェネレーター | 品名・数量・金額を入力すると感熱レシート風にプレビューされ、「詩として読む」切替で品名だけの詩に姿を変える | [Pages](https://oplan-development-team.github.io/web-app-factory/receipt-poem-generator/) | プロトタイプ（採否待ち） |
| サイアノタイプ・ポスターメーカー | 写真をプルシアンブルーの二階調に変換し、植物標本ラベル付きのサイアノタイプ風ポスターにする | [Pages](https://oplan-development-team.github.io/web-app-factory/cyanotype-poster-maker/) | 完成 |
| The Column Daily（コラムメディアサイト） | ヴィンテージ新聞・エディトリアルスタイルのコラムメディアサイト（記事閲覧・検索・投稿UIのデモ） | [Pages](https://oplan-development-team.github.io/web-app-factory/column-daily/) | 完成 |
| レシート詩集ポスター（Receipt Poetry Scroll） | 買い物リスト等の行区切りテキストを、値段付きの感熱紙ロール風縦長ポスターに変換する（姉妹アプリと違い値段は自動算出） | [Pages](https://oplan-development-team.github.io/web-app-factory/receipt-poetry-scroll/) | プロトタイプ（採否待ち） |
| アンビエント映画字幕オーバーレイ | Webカメラ映像に、音量・動き検出だけで映画風のフェイク字幕をリアルタイムに重ねるネタツール | [Pages](https://oplan-development-team.github.io/web-app-factory/ambient-subtitle-cam/) | プロトタイプ（採否待ち） |
| 等高線ドローイング（Contour Draw） | マウス/タッチで自由に描いた線を、測量図・地形図風の等高線ポスターに変換する | [Pages](https://oplan-development-team.github.io/web-app-factory/contour-draw/) | プロトタイプ（採否待ち） |
| 等高線ポートレート（Contour Portrait） | アップロードした写真の明暗を標高に見立て、等高線だけで描く測量図風ポートレート・ジェネレーター | [Pages](https://oplan-development-team.github.io/web-app-factory/contour-portrait/) | プロトタイプ（採否待ち） |
| 締切フライト案内板 | 複数の締切・予定日を登録すると、空港の発着案内板のようなパタパタ表示で残り日数を見せるボード | [Pages](https://oplan-development-team.github.io/web-app-factory/deadline-departure-board/) | プロトタイプ（採否待ち） |
| 標本図鑑プレート・ジェネレーター | 手元の植物・貝殻などの写真を、銅版画エングレービング風の19世紀博物誌図版に変換する | [Pages](https://oplan-development-team.github.io/web-app-factory/specimen-plate-generator/) | プロトタイプ（採否待ち） |
| タブ庭園（Tab Guilt Garden） | このアプリを開いた各タブに苗が生え、放置するとしおれ、閉じると墓標が残る「タブを溜め込みがちな自分」への自虐ジョークツール。放置ゲームとしての階級・実績もあり | [Pages](https://oplan-development-team.github.io/web-app-factory/tab-guilt-garden/) | 完成 |
| 液だまり（Puddle Tilt） | 端末を傾けると画面の中の水たまりが実際に流れ・波打ち、油膜のように虹色に光る感覚トイ | [Pages](https://oplan-development-team.github.io/web-app-factory/puddle-tilt/) | プロトタイプ（採否待ち） |
| 校正記号diffビューア（Proofmark Diff） | 改稿前後のテキストを、紙の校正で使われる校正記号（トルツメ・キャレット・ルビ訂正・移動矢印）の見た目で差分表示する | [Pages](https://oplan-development-team.github.io/web-app-factory/proofmark-diff/) | プロトタイプ（採否待ち） |
| オーロラ・テルミン（Aurora Theremin） | マウス/指の位置と速度でWeb Audioのテルミン風シンセを演奏し、録音・ループ・重ね録りもできる楽器トイ | [Pages](https://oplan-development-team.github.io/web-app-factory/aurora-theremin/) | プロトタイプ（採否待ち） |
| クラドニ図形ポスタージェネレーター（Chladni Cymatics Poster Lab） | 振動モードを指定すると、砂粒子がChladni図形の節線に収束する物理シミュレーションを描画し、実験記録ポスターとして書き出す | [Pages](https://oplan-development-team.github.io/web-app-factory/chladni-poster-lab/) | プロトタイプ（採否待ち） |
| スクショ継ぎ足し工房（暗室版） | 2枚に分けたスクリーンショットの重なりを自動検出し1枚に継ぎ足す。写真暗室・アナログ現像室スタイル | [Pages](https://oplan-development-team.github.io/web-app-factory/shot-splice-darkroom/) | プロトタイプ（採否待ち） |
| スクショ継ぎ足し工房（スイス様式版） | 同上の機能をスイス/インターナショナル・スタイルの計測器デザインで | [Pages](https://oplan-development-team.github.io/web-app-factory/shot-splice-grid/) | プロトタイプ（採否待ち） |
| スクショ継ぎ足し工房（ネオブルータリズム版） | 同上の機能をネオブルータリズムの荒々しい実用ツールデザインで | [Pages](https://oplan-development-team.github.io/web-app-factory/shot-splice-brutal/) | プロトタイプ（採否待ち） |
| スクショ継ぎ足し（Shot Splice） | 複数枚のスクリーンショットの重なりを自動検出して1枚に継ぎ足す。iOSライク・モバイルファーストの本実装版 | [Pages](https://oplan-development-team.github.io/web-app-factory/shot-splice/) | 完成 |
| 傾きガチャ（Tilt Gacha） | 端末を振ると、その瞬間の傾きに応じた幾何学模様が1枚出現し、12種の型を集める図鑑が埋まっていく感覚トイ | [Pages](https://oplan-development-team.github.io/web-app-factory/tilt-gacha/) | 完成 |
| ブルーノート風ジャズジャケット・ジェネレーター（Blue Note Cover Studio） | 架空のバンド名・アルバム名から、ブルーノート・レコードのグラフィックデザイン規範（斜めデュオトーン写真ブロック・極端な字間タイポグラフィ・限定2色配色）に従ったジャケットを自動生成する | [Pages](https://oplan-development-team.github.io/web-app-factory/blue-note-cover-studio/) | プロトタイプ（採否待ち） |
| 墨流しマーブリング・スタジオ（Suminagashi Marbling Studio） | 水盤にインクを落とし、櫛・渦でなぞって模様を作り込み、紙に「浸して引き上げ」て継ぎ目のないタイル/ポスターとして持ち帰るデジタル工芸ツール | [Pages](https://oplan-development-team.github.io/web-app-factory/suminagashi-marbling/) | プロトタイプ（採否待ち） |
| 枯山水コンポーザー（Karesansui Composer） | 砂庭に石を置くと、石を避けながら砂紋（箒目）が自動で流れる禅庭シミュレーター。完成した庭をPNG/SVGポスターとして書き出せる | [Pages](https://oplan-development-team.github.io/web-app-factory/karesansui-composer/) | プロトタイプ（採否待ち） |
| 黒塗りメタデータ開示装置（Redacted EXIF） | 写真のEXIF/GPS/端末情報を「情報公開請求で黒塗りされた公文書」として演出的に開示し、GPS地点を一度きりプレビューしてからワンクリックでメタデータを完全除去する | [Pages](https://oplan-development-team.github.io/web-app-factory/redacted-exif/) | プロトタイプ（採否待ち） |
| タイピング心電図 | 打鍵のkeydown間隔だけを計測し、病院の心電図モニター風UIでリアルタイムに波形と診断結果を描くネタツール | — （Pages未対応、下記参照） | 保留 |

タイピング心電図は `deploy.json` の `pages` が `false`（ビルドが`dist/`を生成しない構成のため、現状Pagesワークフローの対象外）。
