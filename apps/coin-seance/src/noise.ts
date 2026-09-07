// 軽量な自前実装の Perlin ノイズ（外部ライブラリ非依存）。
// Ken Perlin の改良版アルゴリズムを 2D 用に簡略化したもの。
// ドリフト中の玉の徘徊軌道生成にのみ使用する。

const PERMUTATION_SIZE = 256;

function buildPermutationTable(seed: number): Uint8Array {
  const p = new Uint8Array(PERMUTATION_SIZE);
  for (let i = 0; i < PERMUTATION_SIZE; i++) p[i] = i;

  // xorshift ベースの決定論的擬似乱数（seed 固定で再現可能）
  let state = seed >>> 0 || 1;
  const rand = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };

  for (let i = PERMUTATION_SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i]!;
    p[i] = p[j]!;
    p[j] = tmp;
  }

  const doubled = new Uint8Array(PERMUTATION_SIZE * 2);
  for (let i = 0; i < PERMUTATION_SIZE * 2; i++) doubled[i] = p[i % PERMUTATION_SIZE]!;
  return doubled;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export class PerlinNoise2D {
  private perm: Uint8Array;

  constructor(seed = 1337) {
    this.perm = buildPermutationTable(seed);
  }

  /** -1..1 の範囲を返す 2D Perlin ノイズ */
  noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = fade(xf);
    const v = fade(yf);

    const p = this.perm;
    const aa = p[p[X]! + Y]!;
    const ab = p[p[X]! + Y + 1]!;
    const ba = p[p[X + 1]! + Y]!;
    const bb = p[p[X + 1]! + Y + 1]!;

    const x1 = lerp(u, grad(aa, xf, yf), grad(ba, xf - 1, yf));
    const x2 = lerp(u, grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1));

    return lerp(v, x1, x2);
  }
}

/** 2 本の独立したノイズ軸から滑らかな 2D 徘徊ベクトルを作るヘルパー */
export class DriftField {
  private noiseX: PerlinNoise2D;
  private noiseY: PerlinNoise2D;
  private t = 0;

  constructor(seed = 42) {
    this.noiseX = new PerlinNoise2D(seed);
    this.noiseY = new PerlinNoise2D(seed + 991);
  }

  /**
   * @param dt 経過秒数
   * @param frequency ノイズをサンプルする時間スケール（大きいほど速く変化）
   * @returns -1..1 に正規化された x, y 方向ベクトル
   */
  step(dt: number, frequency: number): { x: number; y: number } {
    this.t += dt * frequency;
    // オフセットをずらして参照することで x/y の相関を弱める
    const x = this.noiseX.noise(this.t, 0.13);
    const y = this.noiseY.noise(this.t + 87.3, 0.71);
    return { x, y };
  }

  reset(): void {
    this.t = 0;
  }
}
