export const meta = {
  name: 'app-factory',
  description: 'New_Service_App専用: アイディア出し→批評→コンセプト具体化→プロトタイプ実装→デザインQA→検証を自律的に回すパイプライン',
  phases: [
    { title: 'Ideate', detail: '複数レンズで候補アイディアを並行生成。批評結果が基準に届かなければ深掘りしてもう1周（最大2周）' },
    { title: 'Critique', detail: '独立した批評パネルで採点。基準未達なら次のIdeateラウンドへフィードバックを返す' },
    { title: 'Concept', detail: '採用案を要件・スタイル方向に具体化' },
    { title: 'Build', detail: 'apps/<slug>/にプロトタイプを実装' },
    { title: 'Review & Fix', detail: 'Design QA・Verifyを実行し、指摘があればprototype-builderに差し戻して再検証（最大2ラウンド）' },
  ],
}

// このプロジェクト（New_Service_App）内で完結させるため、パスは常にリポジトリルートからの相対パスで
// 表現する。絶対パスをここにハードコードしない（ローカル環境とCI環境でパスが異なるため。過去に
// 特定マシンの絶対パスがハードコードされ、CI環境で誤ったパスにプロトタイプを作ってしまう不具合があった）。

const IDEAS_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          targetUser: { type: 'string' },
          styleDirectionHint: { type: 'string' },
        },
        required: ['title', 'summary'],
      },
    },
  },
  required: ['ideas'],
}

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    rankings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          score: { type: 'number' },
          feasibleAsPrototype: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['title', 'score', 'feasibleAsPrototype', 'reason'],
      },
    },
  },
  required: ['rankings'],
}

const CONCEPT_SCHEMA = {
  type: 'object',
  properties: {
    slug: { type: 'string' },
    title: { type: 'string' },
    oneLiner: { type: 'string' },
    styleDirection: { type: 'string' },
    requirements: { type: 'array', items: { type: 'string' } },
    techStack: { type: 'string' },
    outOfScope: { type: 'array', items: { type: 'string' } },
  },
  required: ['slug', 'title', 'oneLiner', 'styleDirection', 'requirements', 'techStack'],
}

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    dirPath: { type: 'string' },
    summary: { type: 'string' },
    howToRun: { type: 'string' },
    knownIssues: { type: 'array', items: { type: 'string' } },
  },
  required: ['dirPath', 'summary', 'howToRun'],
}

const QA_SCHEMA = {
  type: 'object',
  properties: {
    passed: { type: 'boolean' },
    satisfiedQualities: { type: 'array', items: { type: 'string' } },
    violations: { type: 'array', items: { type: 'string' } },
    mustFixBeforePresent: { type: 'array', items: { type: 'string' } },
  },
  required: ['passed', 'satisfiedQualities', 'violations'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    buildOk: { type: 'boolean' },
    devServerOk: { type: 'boolean' },
    dockerBuildOk: { type: 'boolean' },
    consoleErrors: { type: 'array', items: { type: 'string' } },
    functionalNotes: { type: 'string' },
    overallOk: { type: 'boolean' },
  },
  required: ['buildOk', 'devServerOk', 'dockerBuildOk', 'overallOk'],
}

const LENSES = [
  { key: 'utility', label: '実用ツール', brief: '日常的に使いたくなる、実用性重視の小規模Webアプリ' },
  { key: 'visual', label: 'ビジュアル/作品性', brief: 'ビジュアル表現そのものが主役になる、作品として見せられるもの' },
  { key: 'playful', label: '遊び心・実験', brief: 'ニッチでも面白い、遊び心や実験性のあるもの' },
]

// args.seedIdea = { title, summary, targetUser? } を渡すと、Ideate/Critiqueを飛ばして
// そのアイディアをそのままConceptフェーズから走らせる（ユーザー自身のアイディアを起点にする経路）。
const seedIdea = (args && args.seedIdea) ? args.seedIdea : null

// args.runId: 呼び出し側がWorkflow実行前にBashで生成した一意な識別子（例: 20260825-030512-8421）。
// 各エージェントはこれを活動ログのファイル名に使う（.claude/logs/app-factory/<runId>.md）。
// 日付だけをキーにすると、同じ日に複数ブランチが並行実行した際にログファイルがコンフリクトするため、
// スクリプト自身はDate.now()/Math.random()を使えない制約もあり、実行ごとの一意性は呼び出し側に持たせている。
const runId = (args && args.runId) ? args.runId : 'unassigned-run'
const runIdNote = ` ログファイル識別子(runId): ${runId}（ログ command のファイル名にそのまま使うこと）。`

const QUALITY_BAR = 7
const MAX_IDEATE_ROUNDS = 2

let allIdeas = []
let critiques = []
let winnerIdea = null

if (seedIdea) {
  log(`ユーザー指定のアイディアを起点にします: ${seedIdea.title}`)
  allIdeas = [seedIdea]
  winnerIdea = seedIdea
} else {
  let priorFeedback = null
  for (let round = 1; round <= MAX_IDEATE_ROUNDS; round++) {
    phase('Ideate')
    log(`Ideateラウンド${round}: 3つのレンズでアイディア候補を並行生成します`)
    const feedbackNote = priorFeedback
      ? ` 前ラウンドの批評結果を踏まえてください。有望だった方向性: ${JSON.stringify(priorFeedback.promising)}。弱点として指摘された点: ${JSON.stringify(priorFeedback.weaknesses)}。既出の案(${allIdeas.map(i => i.title).join('、')})とは違う切り口を出すか、有望な方向性をさらに深掘りしてください。`
      : ''
    const ideaBatches = await parallel(LENSES.map(lens => () =>
      agent(
        `New_Service_App というプロジェクト用に、単発・小規模なWebアプリのアイディアを5つ考えてください。` +
        `割り当てレンズ:「${lens.label}」(${lens.brief})。` +
        `まずリポジトリルートの PROJECTS.md と apps/ ディレクトリを確認し、既存のアイディア・完成済み・進行中のアプリと重複しないようにしてください。` +
        `対象は個人が数時間〜1日程度で作り切れる規模。外部有料APIキーや継続的なインフラ費用が前提のものは避けてください。` +
        feedbackNote + runIdNote,
        { agentType: 'idea-scout', label: `scout:${lens.key}:r${round}`, phase: 'Ideate', schema: IDEAS_SCHEMA }
      )
    ))
    const newIdeas = ideaBatches.filter(Boolean).flatMap(b => b.ideas || [])
    allIdeas = allIdeas.concat(newIdeas)
    log(`ラウンド${round}: ${newIdeas.length}件追加、累計${allIdeas.length}件`)

    phase('Critique')
    critiques = await parallel([0, 1].map(i => () =>
      agent(
        `次のアイディア候補それぞれを、(1)プロトタイプとして数時間〜1日で作り切れるか (2)独自性 (3)実際に使われる/見てもらえそうか ` +
        `の観点で0〜10点で採点してください。厳しめに、疑わしきは低く採点してください。候補一覧: ${JSON.stringify(allIdeas)}` + runIdNote,
        { agentType: 'idea-critic', label: `critic:${i}:r${round}`, phase: 'Critique', schema: CRITIQUE_SCHEMA }
      )
    ))
    const scoreMap = {}
    critiques.filter(Boolean).forEach(c => {
      ;(c.rankings || []).forEach(r => {
        if (!scoreMap[r.title]) scoreMap[r.title] = { total: 0, count: 0, feasible: true, reasons: [] }
        scoreMap[r.title].total += r.score
        scoreMap[r.title].count += 1
        if (!r.feasibleAsPrototype) scoreMap[r.title].feasible = false
        scoreMap[r.title].reasons.push(r.reason)
      })
    })
    const ranked = Object.entries(scoreMap)
      .map(([title, v]) => ({ title, avg: v.total / v.count, feasible: v.feasible, reasons: v.reasons }))
      .filter(r => r.feasible)
      .sort((a, b) => b.avg - a.avg)
    const top = ranked.length ? ranked[0] : null
    log(`ラウンド${round}: 最高スコア ${top ? top.avg.toFixed(1) : 'N/A'}（採用ライン ${QUALITY_BAR}）`)

    if (top && top.avg >= QUALITY_BAR) {
      winnerIdea = allIdeas.find(i => i.title === top.title)
      break
    }
    if (round === MAX_IDEATE_ROUNDS) {
      winnerIdea = top ? allIdeas.find(i => i.title === top.title) : allIdeas[0]
      break
    }
    priorFeedback = {
      promising: ranked.slice(0, 3).map(r => r.title),
      weaknesses: ranked.slice(0, 5).flatMap(r => r.reasons).slice(0, 5),
    }
  }
}

if (!winnerIdea) {
  return { status: 'no-idea-survived', allIdeas, critiques }
}

phase('Concept')
const concept = await agent(
  `次のアイディアを、実装可能なコンセプトに具体化してください。` +
  `タイトル: ${winnerIdea.title} / 概要: ${winnerIdea.summary} / 対象ユーザー: ${winnerIdea.targetUser || '未指定'}。` +
  `リポジトリルートの apps/ 配下の既存ディレクトリ名と衝突しないkebab-caseのslugを決めてください。` +
  `スタイル方向は曖昧な「クリーンでミニマル」を禁止し、エディトリアル/ネオブルータリズム/ガラスモーフィズム/` +
  `ダーク or ライトラグジュアリー/ベント/スクロールテリング/スイス/レトロフューチャリズム等から具体的に1つ選んでください。` +
  `技術スタックは依存が少なく短時間で作り切れるもの（素のHTML/CSS/JS、またはVite+TS程度）を優先してください。` + runIdNote,
  { agentType: 'concept-developer', phase: 'Concept', schema: CONCEPT_SCHEMA }
)
log(`コンセプト確定: ${concept.title} / ${concept.styleDirection} / apps/${concept.slug}/`)

phase('Build')
let build = await agent(
  `次のコンセプトに基づき、リポジトリルートの apps/${concept.slug}/ 配下にプロトタイプを実装してください。` +
  `実装前に frontend-design スキルを必ず呼び出し、指定のスタイル方向を具体的なビジュアル方針(配色・タイポグラフィ・` +
  `レイアウトの理由)まで固めてから実装してください。コンセプト: ${JSON.stringify(concept)}。` +
  `プロトタイプなので網羅的なテストは不要ですが、npm run build 等が実際に通り、起動して操作できる状態まで仕上げてください。` +
  `README.md に、これがapp-factoryパイプラインによる自律生成プロトタイプであることを一言書き添えてください。` + runIdNote,
  { agentType: 'prototype-builder', phase: 'Build', schema: BUILD_SCHEMA }
)
log(`実装完了: ${build.dirPath}`)

phase('Review & Fix')
const MAX_REVIEW_ROUNDS = 2
const QA_PROMPT =
  `リポジトリルートの apps/${concept.slug}/ の実装を、CLAUDE.mdのAnti-Template Policyに照らして検証してください。` +
  `禁止パターン(画一的なカードグリッド/中央寄せグラデーションブロブのヒーロー/ライブラリのデフォルトそのまま/` +
  `単調な余白・角丸・影/グレー基調+差し色1色だけ 等)に当てはまっていないか、` +
  `階層・リズム・奥行き・タイポグラフィ・意味のある配色・作り込まれたhover/focus/active状態のうち` +
  `最低4項目を満たしているかを、実際にコードと画面を確認して厳しく判定してください。疑わしい場合はpassed=falseとしてください。` + runIdNote
const VERIFY_PROMPT =
  `リポジトリルートの apps/${concept.slug}/ を実際にビルド・起動し、主要機能を操作して動作確認してください。` +
  `コンソールエラーの有無、375/768/1440幅での見た目の破綻の有無を確認してください。` +
  `また、apps/${concept.slug}/Dockerfile を使って実際に \`docker build\` が成功するかを独立に確認し、結果をdockerBuildOkとして報告してください。` +
  `確認後は起動したプロセス・作成したDockerイメージ/コンテナを必ず終了・削除してください。` + runIdNote

let qaRounds = []
let verify = null
let reviewPassed = false

for (let round = 1; round <= MAX_REVIEW_ROUNDS; round++) {
  log(`Review & Fix ラウンド${round}: Design QA(2体)とVerifyを並行実行します`)
  const [qa0, qa1, v] = await parallel([
    () => agent(QA_PROMPT, { agentType: 'design-qa-critic', label: `qa:0:r${round}`, phase: 'Review & Fix', schema: QA_SCHEMA }),
    () => agent(QA_PROMPT, { agentType: 'design-qa-critic', label: `qa:1:r${round}`, phase: 'Review & Fix', schema: QA_SCHEMA }),
    () => agent(VERIFY_PROMPT, { agentType: 'prototype-verifier', label: `verify:r${round}`, phase: 'Review & Fix', schema: VERIFY_SCHEMA }),
  ])
  qaRounds = [qa0, qa1].filter(Boolean)
  verify = v
  const qaPassed = qaRounds.length > 0 && qaRounds.every(r => r.passed)
  reviewPassed = qaPassed && !!verify && !!verify.overallOk
  log(`ラウンド${round}: QA=${qaPassed ? '合格' : '不合格'} / Verify=${verify && verify.overallOk ? '合格' : '不合格'}`)

  if (reviewPassed || round === MAX_REVIEW_ROUNDS) break

  const fixNotes = {
    qaViolations: qaRounds.flatMap(r => r.violations || []),
    qaMustFix: qaRounds.flatMap(r => r.mustFixBeforePresent || []),
    verifyIssues: verify
      ? [
          verify.dockerBuildOk === false ? 'Dockerビルドが失敗しています。Dockerfileを見直してください。' : null,
          verify.functionalNotes,
          ...(verify.consoleErrors || []),
        ].filter(Boolean)
      : [],
  }
  log(`ラウンド${round}: 指摘があったためprototype-builderに修正を差し戻します`)
  build = await agent(
    `リポジトリルートの apps/${concept.slug}/ の実装に対して、Design QAとVerifyから次の指摘が出ています。指摘箇所を修正してください。` +
    `指摘内容: ${JSON.stringify(fixNotes)}。無関係な変更は加えず、指摘の解消に集中してください。修正後、npm run build 等が通ることを確認してください。` + runIdNote,
    { agentType: 'prototype-builder', label: `fix:r${round}`, phase: 'Review & Fix', schema: BUILD_SCHEMA }
  )
}

return {
  idea: winnerIdea,
  allCandidateIdeas: allIdeas,
  concept,
  build,
  qaRounds,
  verify,
  reviewPassed,
}
