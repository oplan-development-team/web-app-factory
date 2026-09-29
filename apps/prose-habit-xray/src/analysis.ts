import type {
  CategoryKey,
  CategoryResult,
  DiagnosisReport,
  Finding,
  Sentence,
  Verdict,
} from './types';
import { VERDICT_SCORE } from './types';

const TERMINATOR_RE = /[。!?！？]+/g;
const MAX_FINDINGS_PER_CARD = 8;

function truncate(s: string, max = 72): string {
  const trimmed = s.trim();
  return trimmed.length > max ? trimmed.slice(0, max) + '…' : trimmed;
}

/** 句点(。！？)を基準にした簡易文分割。鍵括弧内の句点等でも分割される割り切り仕様。 */
export function splitSentences(text: string): Sentence[] {
  const sentences: Sentence[] = [];
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  TERMINATOR_RE.lastIndex = 0;
  while ((m = TERMINATOR_RE.exec(text))) {
    const end = m.index + m[0].length;
    const slice = text.slice(last, end);
    const leading = slice.match(/^[\s　]*/);
    const leadLen = leading ? leading[0].length : 0;
    const start = last + leadLen;
    if (start < end) {
      sentences.push({ index: idx++, start, end, raw: text.slice(start, end) });
    }
    last = end;
  }
  const tail = text.slice(last);
  const leading = tail.match(/^[\s　]*/);
  const leadLen = leading ? leading[0].length : 0;
  const tailStart = last + leadLen;
  const tailCore = text.slice(tailStart).replace(/[\s　]+$/, '');
  if (tailCore.length > 0) {
    sentences.push({
      index: idx++,
      start: tailStart,
      end: tailStart + tailCore.length,
      raw: tailCore,
    });
  }
  return sentences;
}

function capFindings(findings: Finding[]): Finding[] {
  if (findings.length <= MAX_FINDINGS_PER_CARD) return findings;
  return findings.slice(0, MAX_FINDINGS_PER_CARD);
}

// ---------------------------------------------------------------------------
// (a) 「が」の連続使用
// ---------------------------------------------------------------------------
function analyzeGa(text: string, sentences: Sentence[]): CategoryResult {
  const findings: Finding[] = [];
  let fid = 0;
  const counts = sentences.map((s) => (s.raw.match(/が/g) || []).length);
  let maxCount = 0;

  sentences.forEach((s, i) => {
    const c = counts[i];
    if (c > maxCount) maxCount = c;
    if (c >= 2) {
      findings.push({
        id: `ga-multi-${fid++}`,
        category: 'ga',
        start: s.start,
        end: s.end,
        excerpt: truncate(s.raw),
        note: `1文中に「が」が${c}回出現`,
      });
    }
  });

  let maxRun = 0;
  let runStart = -1;
  for (let i = 0; i <= sentences.length; i++) {
    const has = i < sentences.length && counts[i] >= 1;
    if (has) {
      if (runStart === -1) runStart = i;
    } else {
      if (runStart !== -1) {
        const runLen = i - runStart;
        if (runLen > maxRun) maxRun = runLen;
        if (runLen >= 2) {
          const s0 = sentences[runStart];
          const s1 = sentences[i - 1];
          findings.push({
            id: `ga-run-${fid++}`,
            category: 'ga',
            start: s0.start,
            end: s1.end,
            excerpt: truncate(text.slice(s0.start, s1.end)),
            note: `「が」を含む文が${runLen}文連続`,
          });
        }
      }
      runStart = -1;
    }
  }

  let verdict: Verdict = '異常なし';
  if (maxCount >= 3 || maxRun >= 4) verdict = '要精査';
  else if (maxCount === 2 || maxRun === 3) verdict = '要注意';
  else if (maxRun === 2) verdict = '軽度';

  return {
    key: 'ga',
    label: '「が」の連続使用',
    verdict,
    findings: capFindings(findings),
    summary:
      findings.length === 0
        ? '「が」の過多な連続使用は見られません。'
        : `1文内最大${maxCount}回、連続最大${maxRun}文にわたる「が」の使用を検出。`,
    metrics: [
      { label: '1文内最大出現数', value: String(maxCount) },
      { label: '連続文数(最大)', value: String(maxRun) },
    ],
  };
}

// ---------------------------------------------------------------------------
// (b) 同一語尾の連続
// ---------------------------------------------------------------------------
const ENDING_DEFS: Array<{ label: string; re: RegExp }> = [
  { label: 'でした', re: /でした[。!?！？]+$/ },
  { label: 'ました', re: /ました[。!?！？]+$/ },
  { label: 'ません', re: /ません[。!?！？]+$/ },
  { label: 'である', re: /である[。!?！？]+$/ },
  { label: 'ます', re: /ます[。!?！？]+$/ },
  { label: 'だ', re: /だ[。!?！？]+$/ },
  { label: 'た', re: /た[。!?！？]+$/ },
];

export function endingOf(raw: string): string | null {
  for (const d of ENDING_DEFS) {
    if (d.re.test(raw)) return d.label;
  }
  return null;
}

function analyzeDougo(text: string, sentences: Sentence[]): CategoryResult {
  const findings: Finding[] = [];
  let fid = 0;
  const labels = sentences.map((s) => endingOf(s.raw));
  let maxRun = 0;

  let i = 0;
  while (i < sentences.length) {
    const label = labels[i];
    if (label === null) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < sentences.length && labels[j] === label) j++;
    const runLen = j - i;
    if (runLen > maxRun) maxRun = runLen;
    if (runLen >= 2) {
      const s0 = sentences[i];
      const s1 = sentences[j - 1];
      findings.push({
        id: `dougo-${fid++}`,
        category: 'dougo',
        start: s0.start,
        end: s1.end,
        excerpt: truncate(text.slice(s0.start, s1.end)),
        note: `「${label}」止めの文が${runLen}文連続`,
      });
    }
    i = j;
  }

  let verdict: Verdict = '異常なし';
  if (maxRun >= 4) verdict = '要精査';
  else if (maxRun === 3) verdict = '要注意';
  else if (maxRun === 2) verdict = '軽度';

  return {
    key: 'dougo',
    label: '同一語尾の連続',
    verdict,
    findings: capFindings(findings),
    summary:
      findings.length === 0
        ? '同一語尾の連続は見られません。'
        : `同一語尾が最大${maxRun}文連続しています。`,
    metrics: [{ label: '最大連続数', value: `${maxRun}文` }],
  };
}

// ---------------------------------------------------------------------------
// (c) 一文の長さのばらつき
// ---------------------------------------------------------------------------
const HIST_BUCKETS: Array<[number, number, string]> = [
  [0, 15, '0-15'],
  [16, 30, '16-30'],
  [31, 50, '31-50'],
  [51, 80, '51-80'],
  [81, 120, '81-120'],
  [121, Infinity, '121+'],
];

function analyzeLength(_text: string, sentences: Sentence[]): CategoryResult {
  const lens = sentences.map((s) => s.raw.length);
  const n = lens.length;
  const mean = n > 0 ? lens.reduce((a, b) => a + b, 0) / n : 0;
  const variance = n > 0 ? lens.reduce((a, b) => a + (b - mean) ** 2, 0) / n : 0;
  const std = Math.sqrt(variance);
  const cv = mean > 0 ? std / mean : 0;

  const histogram = HIST_BUCKETS.map(([lo, hi, label]) => ({
    label,
    count: lens.filter((l) => l >= lo && l <= hi).length,
  }));

  const findings: Finding[] = [];
  let fid = 0;
  if (n >= 3 && std > 0) {
    sentences.forEach((s, i) => {
      const z = (lens[i] - mean) / std;
      if (z >= 1.5) {
        findings.push({
          id: `length-long-${fid++}`,
          category: 'length',
          start: s.start,
          end: s.end,
          excerpt: truncate(s.raw),
          note: `極端に長い文（${lens[i]}字、平均比+${z.toFixed(1)}σ）`,
        });
      } else if (z <= -1.5 && lens[i] <= 8) {
        findings.push({
          id: `length-short-${fid++}`,
          category: 'length',
          start: s.start,
          end: s.end,
          excerpt: truncate(s.raw),
          note: `極端に短い文（${lens[i]}字）`,
        });
      }
    });
  }

  let verdict: Verdict = '異常なし';
  if (n < 3) {
    verdict = '異常なし';
  } else if (cv >= 0.8) {
    verdict = '要精査';
  } else if (cv >= 0.5) {
    verdict = '要注意';
  } else if (cv >= 0.3) {
    verdict = '軽度';
  }
  if (findings.length > 0 && verdict === '異常なし') verdict = '軽度';

  return {
    key: 'length',
    label: '一文の長さのばらつき',
    verdict,
    findings: capFindings(findings),
    summary:
      n < 3
        ? '文数が少ないため、ばらつきの評価は参考値です。'
        : `平均${mean.toFixed(1)}字 / 標準偏差${std.toFixed(1)}字（変動係数${cv.toFixed(2)}）。`,
    metrics: [
      { label: '平均文長', value: `${mean.toFixed(1)}字` },
      { label: '標準偏差', value: `${std.toFixed(1)}字` },
      { label: '変動係数', value: cv.toFixed(2) },
    ],
    histogram,
  };
}

// ---------------------------------------------------------------------------
// (d) 受動態（られる／れる）
// ---------------------------------------------------------------------------
function countPassive(raw: string): number {
  const spans: Array<[number, number]> = [];
  for (const m of raw.matchAll(/られる/g)) {
    spans.push([m.index!, m.index! + 3]);
  }
  let count = spans.length;
  for (const m of raw.matchAll(/れる/g)) {
    const idx = m.index!;
    const isInsideRareru = spans.some(([s]) => idx === s + 1);
    if (!isInsideRareru) count++;
  }
  return count;
}

function analyzePassive(_text: string, sentences: Sentence[]): CategoryResult {
  const findings: Finding[] = [];
  let fid = 0;
  let total = 0;
  sentences.forEach((s) => {
    const c = countPassive(s.raw);
    total += c;
    if (c >= 1) {
      findings.push({
        id: `passive-${fid++}`,
        category: 'passive',
        start: s.start,
        end: s.end,
        excerpt: truncate(s.raw),
        note: `受動表現が${c}回`,
      });
    }
  });

  const ratio = sentences.length > 0 ? total / sentences.length : 0;
  let verdict: Verdict = '異常なし';
  if (ratio >= 0.6) verdict = '要精査';
  else if (ratio >= 0.35) verdict = '要注意';
  else if (ratio >= 0.15) verdict = '軽度';

  return {
    key: 'passive',
    label: '受動態の頻度',
    verdict,
    findings: capFindings(findings),
    summary: `受動表現は文あたり平均${ratio.toFixed(2)}回（合計${total}回）。`,
    metrics: [
      { label: '合計出現数', value: String(total) },
      { label: '文あたり', value: ratio.toFixed(2) },
    ],
  };
}

// ---------------------------------------------------------------------------
// (e) 体言止めの頻度
// ---------------------------------------------------------------------------
const PREDICATE_FINAL = new Set([
  'る', 'た', 'だ', 'い', 'す', 'う', 'く', 'ぐ', 'む', 'ぶ', 'ぬ', 'つ', 'ず',
  'よ', 'ね', 'わ', 'の', 'か', 'ぞ', 'さ', 'け', 'げ', 'せ', 'ぜ', 'て', 'で',
  'ろ', 'り', 'じ', 'ち', 'し', 'き', 'ぎ',
]);

function isTaigenDome(raw: string): boolean {
  if (endingOf(raw) !== null) return false;
  const core = raw.replace(/[。!?！？]+$/, '').replace(/[」』）】〉》"'"']+$/, '');
  if (core.length === 0) return false;
  const lastChar = core.slice(-1);
  if (PREDICATE_FINAL.has(lastChar)) return false;
  return true;
}

function analyzeTaigen(_text: string, sentences: Sentence[]): CategoryResult {
  const findings: Finding[] = [];
  let fid = 0;
  let count = 0;
  sentences.forEach((s) => {
    if (isTaigenDome(s.raw)) {
      count++;
      findings.push({
        id: `taigen-${fid++}`,
        category: 'taigen',
        start: s.start,
        end: s.end,
        excerpt: truncate(s.raw),
        note: '体言止めの可能性',
      });
    }
  });

  const ratio = sentences.length > 0 ? count / sentences.length : 0;
  let verdict: Verdict = '異常なし';
  if (ratio > 0.35) verdict = '要精査';
  else if (ratio > 0.15) verdict = '要注意';
  else if (ratio > 0) verdict = '軽度';

  return {
    key: 'taigen',
    label: '体言止めの頻度',
    verdict,
    findings: capFindings(findings),
    summary: `全${sentences.length}文中${count}文が体言止めの可能性（簡易判定）。`,
    metrics: [
      { label: '該当文数', value: String(count) },
      { label: '出現率', value: `${(ratio * 100).toFixed(0)}%` },
    ],
  };
}

// ---------------------------------------------------------------------------
// (f) 同一の接続詞・副詞の多用
// ---------------------------------------------------------------------------
const CONJUNCTIONS = [
  'しかしながら', 'したがって', 'このように', 'そのため', 'ところが',
  'けれども', 'なぜなら', 'そして', 'しかし', 'だから', 'つまり',
  'なお', 'さらに', 'ただし', '一方', 'すると', 'また',
].sort((a, b) => b.length - a.length);

function analyzeConjunction(_text: string, sentences: Sentence[]): CategoryResult {
  const findings: Finding[] = [];
  let fid = 0;
  const wordCounts = new Map<string, number>();

  sentences.forEach((s) => {
    const trimmed = s.raw.replace(/^[\s　「『（(、,]+/, '');
    const word = CONJUNCTIONS.find((w) => trimmed.startsWith(w));
    if (word) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      findings.push({
        id: `conj-${fid++}`,
        category: 'conjunction',
        start: s.start,
        end: s.end,
        excerpt: truncate(s.raw),
        note: `文頭に「${word}」`,
      });
    }
  });

  let maxWord = '';
  let maxCount = 0;
  wordCounts.forEach((c, w) => {
    if (c > maxCount) {
      maxCount = c;
      maxWord = w;
    }
  });

  let verdict: Verdict = '異常なし';
  if (maxCount >= 4) verdict = '要精査';
  else if (maxCount === 3) verdict = '要注意';
  else if (maxCount === 2) verdict = '軽度';

  return {
    key: 'conjunction',
    label: '同一接続詞の多用',
    verdict,
    findings: capFindings(findings),
    summary:
      maxCount === 0
        ? '固定リスト中の接続詞・副詞の多用は見られません。'
        : `「${maxWord}」が${maxCount}回、文頭に使用されています。`,
    metrics: [
      { label: '最多語', value: maxWord || '—' },
      { label: '最多回数', value: String(maxCount) },
    ],
  };
}

// ---------------------------------------------------------------------------
// aggregator
// ---------------------------------------------------------------------------
const DIAGNOSIS_LABELS: Record<CategoryKey, string> = {
  ga: '「が」過多型',
  dougo: '語尾単調型',
  length: '文長不安定型',
  passive: '受動態多用型',
  taigen: '体言止め依存型',
  conjunction: '接続詞偏重型',
};

const CATEGORY_PRIORITY: CategoryKey[] = [
  'ga', 'dougo', 'length', 'passive', 'taigen', 'conjunction',
];

export function analyze(text: string): DiagnosisReport {
  const sentences = splitSentences(text);

  const categories: CategoryResult[] = [
    analyzeGa(text, sentences),
    analyzeDougo(text, sentences),
    analyzeLength(text, sentences),
    analyzePassive(text, sentences),
    analyzeTaigen(text, sentences),
    analyzeConjunction(text, sentences),
  ];

  const totalScore = categories.reduce((a, c) => a + VERDICT_SCORE[c.verdict], 0);
  const maxScore = categories.length * 3;

  let grade: DiagnosisReport['grade'] = 'A';
  if (totalScore > 12) grade = 'D';
  else if (totalScore > 7) grade = 'C';
  else if (totalScore > 3) grade = 'B';

  let topKey: CategoryKey | null = null;
  let topScore = 0;
  for (const key of CATEGORY_PRIORITY) {
    const cat = categories.find((c) => c.key === key)!;
    const score = VERDICT_SCORE[cat.verdict];
    if (score > topScore) {
      topScore = score;
      topKey = key;
    }
  }

  let diagnosisType = '特記すべきクセなし型';
  if (topKey && topScore > 0) {
    if (topKey === 'conjunction') {
      const conjCat = categories.find((c) => c.key === 'conjunction')!;
      const wordMetric = conjCat.metrics.find((m) => m.label === '最多語');
      diagnosisType =
        wordMetric && wordMetric.value !== '—'
          ? `「${wordMetric.value}」多用型`
          : DIAGNOSIS_LABELS.conjunction;
    } else {
      diagnosisType = DIAGNOSIS_LABELS[topKey];
    }
  }

  return {
    text,
    sentences,
    categories,
    grade,
    totalScore,
    maxScore,
    diagnosisType,
    charCount: text.length,
    sentenceCount: sentences.length,
  };
}
