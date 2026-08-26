# New_Service_App

単発・小規模なWebアプリを複数つくって試していくための作業ディレクトリ。1つの製品ではなく、独立したアプリの寄せ集め。

- 各アプリのアイディア・進行状況は [`PROJECTS.md`](./PROJECTS.md) を参照。
- 開発の進め方・エージェント構成などは [`.claude/CLAUDE.md`](./.claude/CLAUDE.md) を参照。

## プレビュー（GitHub Pages）

`apps/<slug>/` にバックエンド不要（完全クライアントサイド）で `deploy.json` の `pages` が `true` のアプリは、mainへのマージ時に自動でGitHub Pagesにデプロイされる（`.github/workflows/pages-deploy.yml`）。すべてのプレビューへのリンクは [Pages一覧ページ](https://oplan-development-team.github.io/web-app-factory/) からも辿れる。

**これはあくまで動作確認・共有用のプレビューであり、本番デプロイは行わない。** 本番運用する場合は `.claude/CLAUDE.md` の「本番デプロイの方針（コンテナ化）」に従い、Dockerでのデプロイが必須。

| アプリ | プレビュー | ステータス |
|---|---|---|
| 生まれた瞬間の星空ポスタージェネレーター | [Pages](https://oplan-development-team.github.io/web-app-factory/birth-sky-poster/) | 完成 |
| ハーフトーンQR | [Pages](https://oplan-development-team.github.io/web-app-factory/halftone-qr/) | 完成 |
| QRコードデザインツール | [Pages](https://oplan-development-team.github.io/web-app-factory/qr-code-designer/) | 完成 |
| オリジナル家紋ジェネレーター「家紋帳」 | [Pages](https://oplan-development-team.github.io/web-app-factory/kamon-generator/) | 完成 |
| 署名のリボン光跡 | [Pages](https://oplan-development-team.github.io/web-app-factory/signature-ribbon-poster/) | 完成 |
| 架空の美術館キャプションジェネレーター | [Pages](https://oplan-development-team.github.io/web-app-factory/museum-caption-generator/) | プロトタイプ（採否待ち） |
| 声の地層（Voice Strata Poster） | [Pages](https://oplan-development-team.github.io/web-app-factory/voice-strata-poster/) | プロトタイプ（採否待ち） |
| レシート詩集ジェネレーター | [Pages](https://oplan-development-team.github.io/web-app-factory/receipt-poem-generator/) | プロトタイプ（採否待ち） |
| サイアノタイプ・ポスターメーカー | [Pages](https://oplan-development-team.github.io/web-app-factory/cyanotype-poster-maker/) | プロトタイプ（採否待ち） |
| タイピング心電図 | — （Pages未対応、下記参照） | 保留 |

タイピング心電図は `deploy.json` の `pages` が `false`（ビルドが`dist/`を生成しない構成のため、現状Pagesワークフローの対象外）。
