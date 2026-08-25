---
name: app-factory
description: New_Service_App専用の自律プロトタイピング・パイプライン。アイディア出しから動くプロトタイプまでを一括で生成する。「新しいアプリのアイディアを1つプロトタイプまで作って」のような依頼で使う。
---

# app-factory

New_Service_App（`apps/` 配下に単発・小規模アプリを寄せ集めるプロジェクト）専用の、自律プロトタイピング・パイプライン。既存の人間発フロー（コンセプト提示→検討・提案→擦り合わせ→制作移行、詳細は `.claude/CLAUDE.md` の「開発フロー・体制」を参照）とは別の、もう一つの生成レーン。

## 使うタイミング

- ユーザーから「新しいアプリのアイディアを1つ、プロトタイプまで作ってほしい」のような依頼があったとき
- `schedule` / `CronCreate` による定期実行の対象としても想定している（アイディアの在庫を自律的に増やす用途）

## やること

`Workflow` ツールを呼び出す前に、**必ずBashで一意な`runId`を生成する**（各エージェントが活動ログのファイル名に使う識別子。同日に複数実行が並行してもログファイルがコンフリクトしないようにするため）。

```bash
RUN_ID="$(date +%Y%m%d-%H%M%S)-$RANDOM"
```

`Workflow` ツールを次のように呼び出す。**`scriptPath`には、このチェックアウト（現在の作業ディレクトリ）における`.claude/workflows/app-factory.js`の絶対パスを渡す。** ローカル環境・GitHub Actions・Routines等、実行環境によってリポジトリのチェックアウト先は異なる（例: `/home/runner/work/<repo>/<repo>/`、`/home/user/<repo>/` 等）。**特定の環境の絶対パスを決め打ちで使い回さないこと。** 分からなければ `git rev-parse --show-toplevel` 等で現在のチェックアウト先を確認してから組み立てる。

```
Workflow({
  scriptPath: "<git rev-parse --show-toplevelで得られるパス>/.claude/workflows/app-factory.js",
  args: { runId: "<上で生成したRUN_ID>" }
})
```

ワークフローは以下の6段を自律的に実行する。

### ユーザー自身のアイディアを起点にする場合

ユーザーがすでに具体的なアイディアを持っている場合（`PROJECTS.md`の「アイディア」セクションにある案や、その場で伝えられた案）は、Ideate/Critiqueを省略し、`args.seedIdea` にそのアイディアを渡す（`args.runId` は上記と同様に必ず渡す）。

```
Workflow({
  scriptPath: "<このチェックアウトでの絶対パス>/.claude/workflows/app-factory.js",
  args: { runId: "<生成したRUN_ID>", seedIdea: { title: "...", summary: "...", targetUser: "..." } }
})
```

この場合、パイプラインはConceptフェーズから始まり、Build → Design QA → Verifyと進む。自律生成と同じ品質担保（frontend-design呼び出し・Anti-Template Policy検証・機械的な動作確認）を、ユーザー起点のアイディアにもそのまま適用できる。

1. **Ideate** — `idea-scout` を3レンズ（実用ツール／ビジュアル・作品性／遊び心・実験）で並行実行し候補を集める
2. **Critique** — `idea-critic` を2体並行実行し採点する。最高スコアが採用ライン（10点満点中7点）に届かなければ、批評結果をフィードバックとしてIdeateに戻し、有望な方向性を深掘りしたり弱点を避けた候補を追加生成する（最大2ラウンド）
3. **Concept** — `concept-developer` が要件・スタイル方向・技術スタックに具体化する
4. **Build** — `prototype-builder` が `apps/<slug>/` に実装する（実装前に `frontend-design` スキルを必ず呼ぶ）
5. **Review & Fix** — `design-qa-critic` 2体と `prototype-verifier` 1体を並行実行し、Anti-Template Policyへの適合・実際の動作・Dockerビルドの成否（prototype-builderの自己申告を信用せず独立確認、確認後はimage/containerを削除）を検証する。指摘があれば `prototype-builder` に差し戻して修正させ、再度検証する（最大2ラウンド）。**バグ修正はメインセッションが肩代わりせず、必ずこのループの中でprototype-builderに行わせる。**

各エージェントの役割の詳細は `.claude/agents/idea-scout.md` 等、個別のファイルを参照。各エージェントは作業の最後に、自身のエージェント定義に埋め込まれたBashコマンドを実行して `.claude/logs/app-factory/<runId>.md` に活動記録を1件残す（`pipeline-log` スキルはこの規約のドキュメントであり、エージェントに「スキルを呼べ」と間接的に指示するとログが書かれないことがあったため、具体的なコマンドを各エージェント定義に直接埋め込む方式にしている）。Workflowの戻り値だけでは追えない各エージェントの判断は、このログで追える。ログファイルは実行ごとに一意な`runId`をキーにしており、日付をキーにしていた旧方式で発生していた「複数ブランチが同じ日付ファイルに書き込んでマージコンフリクトする」問題は起きない。

## ワークフロー完了後にやること

Workflowの戻り値を鵜呑みにせず、必ず次を行ってから報告する。

1. `apps/<slug>/` が実際に存在し、README・package.json・`deploy.json`等、実装らしい中身が入っているかを確認する（`ls` で十分）
2. `qaPassed` が `false`、または `verify.overallOk` が `false` の場合は、その旨を隠さずユーザーに伝える（機械的に握りつぶさない）
3. `PROJECTS.md` の「アイディア」セクションに採用元と同名の項目があれば取り除き、「プロトタイプ」セクション（無ければ「進行中」の直後に新設する）に、タイトル・一言概要・ディレクトリパス・スタイル方向・QA/Verify結果の要約を追記する
4. `.claude/logs/app-factory/<runId>.md` を `.claude/logs/app-factory/<slug>.md` にリネームする（`git mv`）。後から見返すときにslug名の方が探しやすいための整理で、必須ではないが行っておく
5. **生成されたブランチはmainに直接マージしてよい**（`git merge --no-ff` 等）。採否の判断そのものはPROJECTS.mdのステータス（「プロトタイプ」＝採否待ち）で表現するものであり、マージの有無とは切り離して扱う方針（マージ＝採用ではない）。マージ後は `origin/main` にpushする。
6. `apps/<slug>/deploy.json` の `pages` が `true` なら、ルート `README.md` の一覧テーブルに `https://oplan-development-team.github.io/web-app-factory/<slug>/` へのリンクを1行追加する（実際のデプロイはmainへのpushをトリガーに `.github/workflows/pages-deploy.yml` が行う。この場に完了を待つ必要はない）。`pages` が `false` の場合はREADMEに「Pages未対応」の旨だけ一言添える。
7. ユーザーには、出たアイディア候補（採用されなかったものも含め何が出たか）・採用理由・プロトタイプの場所・QA/Verifyの結果・Pagesプレビューの有無を簡潔に報告する

## 制約

- 1回の実行で使うエージェント数はおよそ15〜20体を目安とする（Ideate/CritiqueとReview & Fixがそれぞれ最大2ラウンドまでループするため、以前の想定より増える）。肥大化しすぎないよう、各ループには上限ラウンド数を必ず設定する
- 外部有料APIキーや継続的なインフラ費用が前提のアイディアは避ける
- バグや指摘の修正はメインセッションが肩代わりしない。必ずBuild/Review & Fixループの中でprototype-builderに差し戻す
- この仕組み自体は発展途上として運用する。エージェントの役割分担・プロンプト・ワークフローの各段の粒度は、実際に回した結果を見ながら随時見直してよい
