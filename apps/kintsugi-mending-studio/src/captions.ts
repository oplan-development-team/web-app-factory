/** Short affirmations of kintsugi's aesthetic: breakage and repair as part
 * of an object's history, not a flaw to hide. Cycled via "次の言葉". */
export const CAPTIONS: string[] = [
  '割れは終わりではなく、器がたどった時間の証である',
  '継いだ線の分だけ、この器はまだ生きようとしている',
  '欠けたところに、光が集まるようにできている',
  '傷を隠さず、傷を歩ませる',
  '壊れたことより、継がれたことを覚えていたい',
  '金の線は、痛みではなく記憶の地図',
  '完全でなくなった器は、はじめて唯一になる',
  '割れた日も、この器の誕生日である',
];

export function captionAt(index: number): string {
  const n = CAPTIONS.length;
  return CAPTIONS[((index % n) + n) % n]!;
}
