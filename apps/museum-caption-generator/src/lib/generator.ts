import { ADJECTIVES, EPITHETS, FIRST_NAMES, LAST_NAMES, MATERIALS, NOUNS } from './vocabulary';
import type { GeneratedCaption, ImageAnalysis, MoodTag, WeightedItem } from './types';

/** タグが一致するほど選ばれやすくなる重み付きランダム抽選。 */
function pickWeighted(items: WeightedItem[], activeTags: MoodTag[]): string {
  const weighted = items.map((item) => {
    const matches = item.tags.filter((tag) => activeTags.includes(tag)).length;
    return { item, weight: 1 + matches * 3 };
  });
  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.item.text;
  }
  return weighted[weighted.length - 1].item.text;
}

function pickMany(items: WeightedItem[], activeTags: MoodTag[], count: number): string[] {
  const pool = [...items];
  const result: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const text = pickWeighted(pool, activeTags);
    result.push(text);
    const idx = pool.findIndex((p) => p.text === text);
    if (idx >= 0) pool.splice(idx, 1);
  }
  return result;
}

function pickFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateArtistName(): string {
  const first = pickFrom(FIRST_NAMES);
  const last = pickFrom(LAST_NAMES);
  const base = `${first}・${last}`;
  if (Math.random() < 0.3) {
    const epithet = pickWeighted(EPITHETS, ['neutral']);
    return `${base}(通称「${epithet}」)`;
  }
  return base;
}

function generateYear(): string {
  const year = 1974 + Math.floor(Math.random() * 51);
  const formats = [
    `${year}年`,
    `${year}年頃`,
    `${year}年(第二稿)`,
    '制作年不詳(本人曰く「先週」)',
    `${year}年、記憶違いでなければ`,
    `およそ二十一世紀、${year}年前後`,
    `${year}年、あるいはその模造`,
  ];
  return pickFrom(formats);
}

function generateDimensions(aspectRatio: number): string {
  const longSide = 42 + Math.random() * 138;
  let width: number;
  let height: number;
  if (aspectRatio >= 1) {
    width = longSide;
    height = longSide / aspectRatio;
  } else {
    height = longSide;
    width = longSide * aspectRatio;
  }
  const w = width.toFixed(1);
  const h = height.toFixed(1);
  const suffixes = ['', '', '(額装含まず)', '(可変、作家の気分による)', '(展示空間に応じて増減)'];
  const suffix = pickFrom(suffixes);
  return `${h} × ${w} cm${suffix ? ` ${suffix}` : ''}`;
}

function generateTitle(tags: MoodTag[]): string {
  const adj = () => pickWeighted(ADJECTIVES, tags);
  const noun = () => pickWeighted(NOUNS, tags);
  const num = 1 + Math.floor(Math.random() * 47);

  const templates = [
    () => `${adj()}${noun()}`,
    () => `${noun()}、あるいは${adj()}${noun()}への註釈`,
    () => `無題(${noun()})`,
    () => `${noun()}について ― ${adj()}記録`,
    () => `${adj()}${noun()}、No.${num}`,
    () => `《${adj()}${noun()}》`,
    () => `${noun()}のための習作`,
  ];
  return pickFrom(templates)();
}

function generateMedium(tags: MoodTag[]): string {
  const count = 2 + Math.floor(Math.random() * 3);
  return pickMany(MATERIALS, tags, count).join('、');
}

function generateBody(tags: MoodTag[]): string {
  const adj = () => pickWeighted(ADJECTIVES, tags);
  const noun = () => pickWeighted(NOUNS, tags);

  const openings = [
    () => `本作は、${adj()}${noun()}を主題に据えながら、鑑賞者の視線そのものを作品の一部へと変換する。`,
    () => `一見すると日常の断片に過ぎないが、その実、${noun()}の不可能性を静かに告発している。`,
    () => `作家は${adj()}${noun()}に長らく取り憑かれており、本作はその執着の暫定的な結論である。`,
  ];

  const toneByTag: Partial<Record<MoodTag, () => string>> = {
    warm: () => `画面を満たす${adj()}${noun()}は、鑑賞者の体温をそのまま作品の温度として横領する。`,
    cool: () => `${adj()}${noun()}が支配する画面は、あらゆる親密さを拒絶しながらも、なお見る者を引き止める。`,
    dark: () => `深く沈んだ諧調は、${noun()}という主題に対する作家なりの誠実さの表明でもある。`,
    light: () => `画面にあふれる${noun()}は、救済というにはあまりに素朴で、それゆえに眩しい。`,
    mono: () => `色彩を欠いた画面は、判断を保留したまま、ただ${noun()}だけを差し出す。`,
    neutral: () => `画面に反復する${noun()}は、意味の確定を先延ばしにし続ける装置として機能している。`,
    mid: () => `過不足のない諧調のなかで、${noun()}だけが静かに輪郭を主張している。`,
  };

  const closings = [
    () => `もはやこれは記録ではなく、${noun()}についての祈りである。`,
    () => `批評的距離を取ろうとするたび、作品はその距離ごと鑑賞者を巻き込んでいく。`,
    () => `私たちはここに、${adj()}${noun()}の、あまりに正直な自画像を見る。`,
    () => `かくして凡庸は、${adj()}${noun()}という名のもとに、静かに更新される。`,
    () => `結論を急いではならない。これは${noun()}についての、まだ途中の弁明なのだから。`,
  ];

  const finalWords = [
    () => `展示空間に置かれた瞬間、それはもう写真ではなく、証言となる。`,
    () => `本作の前でしばらく足を止めることを、作家は鑑賞者に強く要請している。`,
    () => `解釈を焦らず、まずは${adj()}${noun()}のかたわらに立ってみてほしい。`,
  ];

  const primaryTag = tags.find((t) => toneByTag[t]) ?? 'neutral';
  const toneSentence = (toneByTag[primaryTag] ?? toneByTag.neutral)!();

  const sentences = [pickFrom(openings)(), toneSentence, pickFrom(closings)()];
  if (Math.random() < 0.55) {
    sentences.push(pickFrom(finalWords)());
  }
  return sentences.join('');
}

export function generateCaption(analysis: ImageAnalysis): GeneratedCaption {
  const tags = analysis.tags;
  return {
    title: generateTitle(tags),
    artist: generateArtistName(),
    year: generateYear(),
    medium: generateMedium(tags),
    dimensions: generateDimensions(analysis.aspectRatio),
    body: generateBody(tags),
  };
}
