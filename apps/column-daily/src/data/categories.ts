import type { Category, CategoryName } from './types';

export const CATEGORIES: readonly Category[] = [
  {
    name: 'ライフスタイル',
    slug: 'lifestyle',
    blurb: '毎日をすこし整える、暮らし方の話。',
    icon: 'cup',
  },
  {
    name: 'エッセイ',
    slug: 'essay',
    blurb: '書き手の目を通して見えた、小さな景色。',
    icon: 'nib',
  },
  {
    name: '仕事術',
    slug: 'work',
    blurb: '続けられるかたちに、仕事を仕立て直す。',
    icon: 'case',
  },
  {
    name: 'フード',
    slug: 'food',
    blurb: '台所と食卓から始まる、日々の記録。',
    icon: 'plate',
  },
  {
    name: '旅',
    slug: 'travel',
    blurb: '知らない道を歩いた日のこと。',
    icon: 'mountain',
  },
  {
    name: '暮らし',
    slug: 'living',
    blurb: '住まいと道具と、手入れの時間。',
    icon: 'house',
  },
  {
    name: 'カルチャー',
    slug: 'culture',
    blurb: '本と音と、街のあちこちで出会うもの。',
    icon: 'book',
  },
  {
    name: 'その他',
    slug: 'other',
    blurb: 'どこにも置きにくい、けれど残しておきたい話。',
    icon: 'asterisk',
  },
];

const BY_SLUG = new Map(CATEGORIES.map((category) => [category.slug, category]));
const BY_NAME = new Map(CATEGORIES.map((category) => [category.name, category]));

export function findCategoryBySlug(slug: string | undefined): Category | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}

export function categoryByName(name: CategoryName): Category {
  const category = BY_NAME.get(name);
  if (!category) {
    throw new Error(`Unknown category: ${name}`);
  }
  return category;
}

export function categorySlug(name: CategoryName): string {
  return categoryByName(name).slug;
}
