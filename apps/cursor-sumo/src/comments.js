// 行司風の煽りコメント生成。決まり方に応じてカテゴリを判定し、複数バリエーションから選ぶ。

const NARROW = [
  { main: "きわどい寄り切り!", sub: "残せるか…と思われたが軍配は{winner}に" },
  { main: "際どい残しならず", sub: "{loser}、俵一枚のところで力尽きる" },
  { main: "紙一重の攻防!", sub: "{winner}が僅差でこれを制す" },
];

const OVERWHELMING = [
  { main: "圧倒的な押し出し!", sub: "{loser}、なすすべなく土俵を割る" },
  { main: "一気呵成の突き出し!", sub: "{winner}の勢い止まらず" },
  { main: "問答無用の押し相撲!", sub: "{loser}、為すすべなし" },
];

const REVERSAL = [
  { main: "大逆転!", sub: "攻めていた{loser}が一転、土俵の外へ" },
  { main: "形勢逆転の一撃!", sub: "{winner}、土俵際でうっちゃった!" },
  { main: "まさかの逆転劇!", sub: "優勢だった{loser}が最後に沈む" },
];

const GENERIC = [
  { main: "勝負あり!", sub: "{winner}、力強く勝ち名乗り" },
  { main: "決着!", sub: "{loser}、土俵の外へ運ばれる" },
  { main: "軍配は{winner}に!", sub: "堂々の一番であった" },
];

const FINAL_COMMENTS = [
  { main: "これにて勝負あり!", sub: "{winner}、見事3番を制する!" },
  { main: "本日の取組、これまで!", sub: "{winner}に軍配、大歓声!" },
  { main: "千秋楽の一番、決着!", sub: "{winner}が土俵を制した!" },
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fill(template, winnerLabel, loserLabel) {
  return template.replace(/\{winner\}/g, winnerLabel).replace(/\{loser\}/g, loserLabel);
}

/**
 * 決着の状況から演出カテゴリを判定する。
 * @param {object} info { overshoot: number, loserSpeed: number, loserWasAdvancing: boolean }
 */
export function decideCategory(info) {
  const { overshoot, loserSpeed, loserWasAdvancing } = info;

  if (loserWasAdvancing && loserSpeed > 140) {
    return "reversal";
  }
  if (overshoot < 14 && loserSpeed < 260) {
    return "narrow";
  }
  if (overshoot > 55 || loserSpeed > 300) {
    return "overwhelming";
  }
  return "generic";
}

const CATEGORY_MAP = {
  narrow: NARROW,
  overwhelming: OVERWHELMING,
  reversal: REVERSAL,
  generic: GENERIC,
};

export function generateRoundComment(category, winnerLabel, loserLabel) {
  const pool = CATEGORY_MAP[category] || GENERIC;
  const t = pick(pool);
  return {
    main: fill(t.main, winnerLabel, loserLabel),
    sub: fill(t.sub, winnerLabel, loserLabel),
  };
}

export function generateFinalComment(winnerLabel, loserLabel) {
  const t = pick(FINAL_COMMENTS);
  return {
    main: fill(t.main, winnerLabel, loserLabel),
    sub: fill(t.sub, winnerLabel, loserLabel),
  };
}
