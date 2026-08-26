const PLACE_FRAGMENTS = [
  '銀座',
  '青山',
  '神楽坂',
  '代官山',
  '谷中',
  '蔵前',
  '日本橋',
  '西荻窪',
  '月島',
  '神保町',
  '立石',
  '早稲田',
  '浅草',
  '中目黒',
  '祐天寺',
  '根津',
];

const SHOP_FRAGMENTS = [
  '詩集堂',
  '散財堂',
  '夜想軒',
  '余白社',
  '偏愛堂',
  '漂流市場',
  '午睡堂',
  '紙魚書房',
  '無銘商店',
  '未収金堂',
  '空想座',
  '記名軒',
  '独白堂',
  '見切り品店',
];

const PREFIX_POOL = ['', '', '', '謎の', '正体不明の'];

/** それっぽい謎の店名をランダム生成する。 */
export function generateStoreName(rnd: () => number = Math.random): string {
  const prefix = PREFIX_POOL[Math.floor(rnd() * PREFIX_POOL.length)];
  const place = PLACE_FRAGMENTS[Math.floor(rnd() * PLACE_FRAGMENTS.length)];
  const shop = SHOP_FRAGMENTS[Math.floor(rnd() * SHOP_FRAGMENTS.length)];
  return `${prefix}${place} ${shop}`;
}
