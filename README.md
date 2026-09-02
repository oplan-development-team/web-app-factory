# New_Service_App

単発・小規模なWebアプリを複数つくって試していくための作業ディレクトリ。1つの製品ではなく、独立したアプリの寄せ集め。

- 各アプリのアイディア・進行状況は [`PROJECTS.md`](./PROJECTS.md) を参照。
- 開発の進め方・エージェント構成などは [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) を参照。

## プレビュー（GitHub Pages）

`apps/<slug>/` にバックエンド不要（完全クライアントサイド）で `deploy.json` の `pages` が `true` のアプリは、mainへのマージ時に自動でGitHub Pagesにデプロイされる（`.github/workflows/pages-deploy.yml`）。一覧は [`PAGES.md`](./PAGES.md) を参照（すべてのプレビューへのリンクは [Pages一覧ページ](https://oplan-development-team.github.io/web-app-factory/) からも辿れる）。

**これはあくまで動作確認・共有用のプレビューであり、本番デプロイは行わない。** 本番運用する場合は `.claude/CLAUDE.md` の「本番デプロイの方針（コンテナ化）」に従い、Dockerでのデプロイが必須。

## ハイライト

全一覧は [`PAGES.md`](./PAGES.md) を参照。ここには気に入っているものだけ残す。

| アプリ | 説明 | プレビュー | ステータス |
|---|---|---|---|
| 生まれた瞬間の星空ポスタージェネレーター | 日時・場所を入力すると、その瞬間その場所から見えていた星空を天文計算で再現し、測量図風の円形星図ポスターにする | [Pages](https://oplan-development-team.github.io/web-app-factory/birth-sky-poster/) | 完成 |
| オリジナル家紋ジェネレーター「家紋帳」 | 名前や誕生日などの文字列をシードに、左右対称・点対称の家紋風紋様を自動生成する | [Pages](https://oplan-development-team.github.io/web-app-factory/kamon-generator/) | 完成 |
| レシート詩集ジェネレーター | 品名・数量・金額を入力すると感熱レシート風にプレビューされ、「詩として読む」切替で品名だけの詩に姿を変える | [Pages](https://oplan-development-team.github.io/web-app-factory/receipt-poem-generator/) | プロトタイプ（採否待ち） |
| サイアノタイプ・ポスターメーカー | 写真をプルシアンブルーの二階調に変換し、植物標本ラベル付きのサイアノタイプ風ポスターにする | [Pages](https://oplan-development-team.github.io/web-app-factory/cyanotype-poster-maker/) | 完成 |
| 等高線ドローイング（Contour Draw） | マウス/タッチで自由に描いた線を、測量図・地形図風の等高線ポスターに変換する | [Pages](https://oplan-development-team.github.io/web-app-factory/contour-draw/) | プロトタイプ（採否待ち） |
| タブ庭園（Tab Guilt Garden） | このアプリを開いた各タブに苗が生え、放置するとしおれ、閉じると墓標が残る「タブを溜め込みがちな自分」への自虐ジョークツール。放置ゲームとしての階級・実績もあり | [Pages](https://oplan-development-team.github.io/web-app-factory/tab-guilt-garden/) | 完成 |
| 液だまり（Puddle Tilt） | 端末を傾けると画面の中の水たまりが実際に流れ・波打ち、油膜のように虹色に光る感覚トイ | [Pages](https://oplan-development-team.github.io/web-app-factory/puddle-tilt/) | プロトタイプ（採否待ち） |
| オーロラ・テルミン（Aurora Theremin） | マウス/指の位置と速度でWeb Audioのテルミン風シンセを演奏し、録音・ループ・重ね録りもできる楽器トイ | [Pages](https://oplan-development-team.github.io/web-app-factory/aurora-theremin/) | プロトタイプ（採否待ち） |
| クラドニ図形ポスタージェネレーター（Chladni Cymatics Poster Lab） | 振動モードを指定すると、砂粒子がChladni図形の節線に収束する物理シミュレーションを描画し、実験記録ポスターとして書き出す | [Pages](https://oplan-development-team.github.io/web-app-factory/chladni-poster-lab/) | プロトタイプ（採否待ち） |
