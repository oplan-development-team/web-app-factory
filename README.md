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
| クリップボード詩人（Clipboard Poet） | [Pages](https://oplan-development-team.github.io/web-app-factory/clipboard-poet/) | プロトタイプ（採否待ち） |
| 架空の美術館キャプションジェネレーター | [Pages](https://oplan-development-team.github.io/web-app-factory/museum-caption-generator/) | プロトタイプ（採否待ち） |
| 声の地層（Voice Strata Poster） | [Pages](https://oplan-development-team.github.io/web-app-factory/voice-strata-poster/) | プロトタイプ（採否待ち） |
| レシート詩集ジェネレーター | [Pages](https://oplan-development-team.github.io/web-app-factory/receipt-poem-generator/) | プロトタイプ（採否待ち） |
| サイアノタイプ・ポスターメーカー | [Pages](https://oplan-development-team.github.io/web-app-factory/cyanotype-poster-maker/) | 完成 |
| レシート詩集ポスター（Receipt Poetry Scroll） | [Pages](https://oplan-development-team.github.io/web-app-factory/receipt-poetry-scroll/) | プロトタイプ（採否待ち） |
| アンビエント映画字幕オーバーレイ | [Pages](https://oplan-development-team.github.io/web-app-factory/ambient-subtitle-cam/) | プロトタイプ（採否待ち） |
| 等高線ドローイング（Contour Draw） | [Pages](https://oplan-development-team.github.io/web-app-factory/contour-draw/) | プロトタイプ（採否待ち） |
| 等高線ポートレート（Contour Portrait） | [Pages](https://oplan-development-team.github.io/web-app-factory/contour-portrait/) | プロトタイプ（採否待ち） |
| 締切フライト案内板 | [Pages](https://oplan-development-team.github.io/web-app-factory/deadline-departure-board/) | プロトタイプ（採否待ち） |
| 標本図鑑プレート・ジェネレーター | [Pages](https://oplan-development-team.github.io/web-app-factory/specimen-plate-generator/) | プロトタイプ（採否待ち） |
| タブ庭園（Tab Guilt Garden） | [Pages](https://oplan-development-team.github.io/web-app-factory/tab-guilt-garden/) | プロトタイプ（採否待ち） |
| タイピング心電図 | — （Pages未対応、下記参照） | 保留 |

タイピング心電図は `deploy.json` の `pages` が `false`（ビルドが`dist/`を生成しない構成のため、現状Pagesワークフローの対象外）。
