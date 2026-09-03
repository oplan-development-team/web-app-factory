import { describe, expect, it, vi } from 'vitest';

import { createShots, intakeMessage, sortByName } from '../../src/ui/intake';

function file(name: string, type = 'image/png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

const deps = (decode = vi.fn(async () => ({ source: {} as CanvasImageSource, width: 100, height: 400 }))) => {
  let n = 0;
  return {
    decode,
    averageColor: () => ({ r: 1, g: 2, b: 3 }),
    makeId: () => `id-${(n += 1)}`,
  };
};

describe('sortByName', () => {
  it('orders numerically, not lexically', () => {
    const files = [file('shot-10.png'), file('shot-2.png'), file('shot-1.png')];
    expect(sortByName(files).map((f) => f.name)).toEqual(['shot-1.png', 'shot-2.png', 'shot-10.png']);
  });

  it('does not mutate the input', () => {
    const files = [file('b.png'), file('a.png')];
    sortByName(files);
    expect(files[0]?.name).toBe('b.png');
  });
});

describe('createShots', () => {
  it('decodes every image and records its size', async () => {
    const result = await createShots([file('a.png'), file('b.png')], deps());
    expect(result.shots).toHaveLength(2);
    expect(result.shots[0]).toMatchObject({
      id: 'id-1',
      name: 'a.png',
      naturalWidth: 100,
      naturalHeight: 400,
      averageColor: { r: 1, g: 2, b: 3 },
    });
    expect(result.skipped).toEqual([]);
  });

  it('skips files that are clearly not images (E-08)', async () => {
    const result = await createShots([file('notes.txt', 'text/plain'), file('a.png')], deps());
    expect(result.shots.map((s) => s.name)).toEqual(['a.png']);
    expect(result.skipped).toEqual(['notes.txt']);
  });

  it('still tries to decode a file with no reported type', async () => {
    const decode = vi.fn(async () => ({ source: {} as CanvasImageSource, width: 10, height: 10 }));
    const result = await createShots([file('mystery', '')], deps(decode));
    expect(decode).toHaveBeenCalled();
    expect(result.shots).toHaveLength(1);
  });

  it('keeps going when one file fails to decode (E-08)', async () => {
    const decode = vi.fn(async (f: File) => {
      if (f.name === 'broken.png') throw new Error('corrupt');
      return { source: {} as CanvasImageSource, width: 100, height: 400 };
    });
    const result = await createShots([file('broken.png'), file('ok.png')], deps(decode));
    expect(result.shots.map((s) => s.name)).toEqual(['ok.png']);
    expect(result.skipped).toEqual(['broken.png']);
  });

  it('rejects a zero-sized decode', async () => {
    const decode = vi.fn(async () => ({ source: {} as CanvasImageSource, width: 0, height: 0 }));
    const result = await createShots([file('empty.png')], deps(decode));
    expect(result.shots).toHaveLength(0);
    expect(result.skipped).toEqual(['empty.png']);
  });

  it('preserves the given order', async () => {
    const result = await createShots([file('z.png'), file('a.png')], deps());
    expect(result.shots.map((s) => s.name)).toEqual(['z.png', 'a.png']);
  });
});

describe('intakeMessage', () => {
  it('is silent when nothing happened', () => {
    expect(intakeMessage(0, [], 0, 12)).toBeNull();
  });

  it('reports a clean batch as a success', () => {
    expect(intakeMessage(3, [], 0, 12)).toEqual({ tone: 'success', message: '3枚を読み込みました。' });
  });

  it('names the files it skipped', () => {
    const result = intakeMessage(1, ['x.txt', 'y.pdf'], 0, 12);
    expect(result?.tone).toBe('error');
    expect(result?.message).toContain('x.txt、y.pdf');
  });

  it('explains the cap', () => {
    const result = intakeMessage(2, [], 4, 12);
    expect(result?.tone).toBe('error');
    expect(result?.message).toContain('上限12枚');
  });
});
