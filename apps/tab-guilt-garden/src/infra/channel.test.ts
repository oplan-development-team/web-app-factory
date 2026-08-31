import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ChannelMessage } from '../domain/types';
import { GardenChannel } from './channel';

const original = globalThis.BroadcastChannel;

afterEach(() => {
  globalThis.BroadcastChannel = original;
  vi.restoreAllMocks();
});

/** Minimal in-process stand-in that delivers to every other instance. */
function installFakeBroadcastChannel() {
  const instances: FakeChannel[] = [];

  class FakeChannel {
    onmessage: ((ev: { data: ChannelMessage }) => void) | null = null;
    closed = false;
    constructor(public name: string) {
      instances.push(this);
    }
    postMessage(data: ChannelMessage) {
      for (const other of instances) {
        if (other === this || other.closed) continue;
        other.onmessage?.({ data });
      }
    }
    close() {
      this.closed = true;
    }
  }

  globalThis.BroadcastChannel = FakeChannel as unknown as typeof BroadcastChannel;
  return instances;
}

describe('with BroadcastChannel available', () => {
  test('delivers messages to other tabs', () => {
    installFakeBroadcastChannel();
    const a = new GardenChannel();
    const b = new GardenChannel();

    const received: ChannelMessage[] = [];
    b.onMessage((m) => received.push(m));

    a.post({ type: 'planted', id: 'x' });

    expect(received).toEqual([{ type: 'planted', id: 'x' }]);
  });

  test('does not echo a message back to its sender', () => {
    installFakeBroadcastChannel();
    const a = new GardenChannel();
    const seen: ChannelMessage[] = [];
    a.onMessage((m) => seen.push(m));

    a.post({ type: 'reset' });

    expect(seen).toEqual([]);
  });

  test('fans out to every registered listener', () => {
    installFakeBroadcastChannel();
    const a = new GardenChannel();
    const b = new GardenChannel();
    const first: ChannelMessage[] = [];
    const second: ChannelMessage[] = [];
    b.onMessage((m) => first.push(m));
    b.onMessage((m) => second.push(m));

    a.post({ type: 'buried', id: 'ghost' });

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
  });

  test('carries the buried id so peers know which plant died (AC-202a)', () => {
    installFakeBroadcastChannel();
    const a = new GardenChannel();
    const b = new GardenChannel();
    let got: ChannelMessage | null = null;
    b.onMessage((m) => {
      got = m;
    });

    a.post({ type: 'buried', id: 'the-ghost' });

    expect(got).toEqual({ type: 'buried', id: 'the-ghost' });
  });

  test('a closed channel stops receiving', () => {
    installFakeBroadcastChannel();
    const a = new GardenChannel();
    const b = new GardenChannel();
    const seen: ChannelMessage[] = [];
    b.onMessage((m) => seen.push(m));

    b.close();
    a.post({ type: 'heartbeat', id: 'x' });

    expect(seen).toEqual([]);
  });
});

describe('without BroadcastChannel (AC-202b)', () => {
  test('constructing, posting and closing are all safe no-ops', () => {
    // Older browsers, or hardened environments, simply lack the API. The tick
    // loop still reconciles via localStorage, so this must degrade silently.
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = undefined;

    const c = new GardenChannel();
    const seen: ChannelMessage[] = [];
    c.onMessage((m) => seen.push(m));

    expect(() => c.post({ type: 'reset' })).not.toThrow();
    expect(() => c.close()).not.toThrow();
    expect(seen).toEqual([]);
  });
});
