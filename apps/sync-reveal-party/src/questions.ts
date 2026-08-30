export type QuestionCategory = 'number' | 'text' | 'choice';

export interface NumberQuestion {
  id: string;
  category: 'number';
  prompt: string;
  min: number;
  max: number;
}

export interface TextQuestion {
  id: string;
  category: 'text';
  prompt: string;
}

export interface ChoiceQuestion {
  id: string;
  category: 'choice';
  prompt: string;
  optionA: string;
  optionB: string;
}

export type Question = NumberQuestion | TextQuestion | ChoiceQuestion;

let seq = 0;
function nid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

export const QUESTIONS: Question[] = [
  // --- number (1-100 系) ---
  { id: nid('num'), category: 'number', prompt: '1〜100で、いま思い浮かんだ数字は？', min: 1, max: 100 },
  { id: nid('num'), category: 'number', prompt: '2人の相性度を1〜100点でつけるなら？', min: 1, max: 100 },
  { id: nid('num'), category: 'number', prompt: '今日の元気度を1〜100で表すと？', min: 1, max: 100 },
  { id: nid('num'), category: 'number', prompt: 'このゲームの面白さを1〜100点でつけるなら？', min: 1, max: 100 },
  { id: nid('num'), category: 'number', prompt: '今からラーメンを何分待てる？（分・1〜100）', min: 1, max: 100 },
  { id: nid('num'), category: 'number', prompt: '一週間の幸福度を1〜100で表すと？', min: 1, max: 100 },
  { id: nid('num'), category: 'number', prompt: '今の眠気レベルを1〜100で表すと？', min: 1, max: 100 },
  { id: nid('num'), category: 'number', prompt: '生まれ変わったら何歳若返りたい？（0〜100）', min: 0, max: 100 },
  { id: nid('num'), category: 'number', prompt: '今すぐ100万円もらえるなら仕事を何日休みたい？（0〜100）', min: 0, max: 100 },
  { id: nid('num'), category: 'number', prompt: '今の空腹度を1〜100で表すと？', min: 1, max: 100 },
  { id: nid('num'), category: 'number', prompt: '人生でこれまで旅行した都道府県の数は？（1〜47）', min: 1, max: 47 },
  { id: nid('num'), category: 'number', prompt: '好きな数字を1〜100でひとつ挙げるなら？', min: 1, max: 100 },
  { id: nid('num'), category: 'number', prompt: '今日の運勢を1〜100点でつけるなら？', min: 1, max: 100 },
  { id: nid('num'), category: 'number', prompt: '休憩なしで何分ゲームを続けられる？（分・1〜100）', min: 1, max: 100 },

  // --- text (自由記述) ---
  { id: nid('txt'), category: 'text', prompt: '今食べたいものは？' },
  { id: nid('txt'), category: 'text', prompt: '今いちばん行きたい場所は？' },
  { id: nid('txt'), category: 'text', prompt: '好きな動物をひとつ挙げるなら？' },
  { id: nid('txt'), category: 'text', prompt: '今週やり残していることは？' },
  { id: nid('txt'), category: 'text', prompt: '子供の頃の好きな遊びは？' },
  { id: nid('txt'), category: 'text', prompt: '今欲しいものは？' },
  { id: nid('txt'), category: 'text', prompt: '休日にしたいことは？' },
  { id: nid('txt'), category: 'text', prompt: '好きな季節は？' },
  { id: nid('txt'), category: 'text', prompt: '今日の気分を一言でいうと？' },
  { id: nid('txt'), category: 'text', prompt: '好きな飲み物は？' },
  { id: nid('txt'), category: 'text', prompt: '無人島に持っていくなら何？' },
  { id: nid('txt'), category: 'text', prompt: '一番好きな色は？' },
  { id: nid('txt'), category: 'text', prompt: '今日のランチに食べたいものは？' },
  { id: nid('txt'), category: 'text', prompt: '好きなおやつは？' },
  { id: nid('txt'), category: 'text', prompt: '今すぐ旅行するなら行きたい国は？' },

  // --- choice (2択) ---
  { id: nid('cho'), category: 'choice', prompt: '海 or 山？', optionA: '海', optionB: '山' },
  { id: nid('cho'), category: 'choice', prompt: '犬 or 猫？', optionA: '犬', optionB: '猫' },
  { id: nid('cho'), category: 'choice', prompt: '朝型 or 夜型？', optionA: '朝型', optionB: '夜型' },
  { id: nid('cho'), category: 'choice', prompt: 'ご飯 or パン？', optionA: 'ご飯', optionB: 'パン' },
  { id: nid('cho'), category: 'choice', prompt: '温泉 or プール？', optionA: '温泉', optionB: 'プール' },
  { id: nid('cho'), category: 'choice', prompt: '甘い or しょっぱい？', optionA: '甘い', optionB: 'しょっぱい' },
  { id: nid('cho'), category: 'choice', prompt: 'インドア or アウトドア？', optionA: 'インドア', optionB: 'アウトドア' },
  { id: nid('cho'), category: 'choice', prompt: '電話 or メッセージ？', optionA: '電話', optionB: 'メッセージ' },
  { id: nid('cho'), category: 'choice', prompt: '寒い方 or 暑い方？', optionA: '寒い方', optionB: '暑い方' },
  { id: nid('cho'), category: 'choice', prompt: '本 or 映画？', optionA: '本', optionB: '映画' },
  { id: nid('cho'), category: 'choice', prompt: 'コーヒー or 紅茶？', optionA: 'コーヒー', optionB: '紅茶' },
  { id: nid('cho'), category: 'choice', prompt: '窓側 or 通路側？', optionA: '窓側', optionB: '通路側' },
];

/**
 * 直近履歴を避けつつランダムに次のお題を選ぶ。
 * avoidIds に含まれない候補から選び、候補が尽きたら全体から選ぶ。
 */
export function pickNextQuestion(avoidIds: readonly string[]): Question {
  const avoidSet = new Set(avoidIds);
  const pool = QUESTIONS.filter((q) => !avoidSet.has(q.id));
  const candidates = pool.length > 0 ? pool : QUESTIONS;
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}
