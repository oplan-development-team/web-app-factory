import { describe, expect, test, vi } from 'vitest';
import { CHANNEL_NAME } from '../domain/constants';
import type { ChannelMessage } from '../domain/types';
import { GardenChannel } from './channel';

/** Minimal stand-in: jsdom does not implement BroadcastChannel. */
function fakeChannel() {
  const channel = {
    name: '',
    onmessage: null as null | ((ev: MessageEvent<unknown>) => void),
    postMessage: vi.fn(),
    close: vi.fn(),
  };
  const factory = (name: string) => {
    channel.name = name;
    return channel as unknown as BroadcastChannel;
  };
  return { channel, factory };
}

describe('GardenChannel', () => {
  test('opens a channel under the versioned name', () => {
    const { channel, factory } = fakeChannel();
    const gc = new GardenChannel(factory);
    expect(gc.available).toBe(true);
    expect(channel.name).toBe(CHANNEL_NAME);
  });

  test('degrades to a no-op when the API is unavailable', () => {
    const gc = new GardenChannel(() => {
      throw new Error('BroadcastChannel unavailable');
    });
    expect(gc.available).toBe(false);
    expect(() => gc.post({ kind: 'progress' })).not.toThrow();
  });

  test('forwards posts to the underlying channel', () => {
    const { channel, factory } = fakeChannel();
    new GardenChannel(factory).post({ kind: 'joined', id: 'a' });
    expect(channel.postMessage).toHaveBeenCalledWith({ kind: 'joined', id: 'a' });
  });

  test('delivers valid messages to every listener', () => {
    const { channel, factory } = fakeChannel();
    const gc = new GardenChannel(factory);
    const seen: ChannelMessage[] = [];
    gc.onMessage((m) => seen.push(m));
    gc.onMessage((m) => seen.push(m));

    channel.onmessage?.({ data: { kind: 'left', id: 'b' } } as MessageEvent<unknown>);
    expect(seen).toEqual([
      { kind: 'left', id: 'b' },
      { kind: 'left', id: 'b' },
    ]);
  });

  test('ignores anything that is not one of our messages', () => {
    const { channel, factory } = fakeChannel();
    const gc = new GardenChannel(factory);
    const listener = vi.fn();
    gc.onMessage(listener);

    channel.onmessage?.({ data: null } as MessageEvent<unknown>);
    channel.onmessage?.({ data: 'hello' } as MessageEvent<unknown>);
    channel.onmessage?.({ data: { kind: 'drop-tables' } } as MessageEvent<unknown>);
    expect(listener).not.toHaveBeenCalled();
  });

  test('a failing post does not propagate into the tick loop', () => {
    const { channel, factory } = fakeChannel();
    channel.postMessage.mockImplementation(() => {
      throw new Error('channel closed');
    });
    expect(() => new GardenChannel(factory).post({ kind: 'progress' })).not.toThrow();
  });

  test('close detaches listeners and marks the channel unavailable', () => {
    const { channel, factory } = fakeChannel();
    const gc = new GardenChannel(factory);
    const listener = vi.fn();
    gc.onMessage(listener);

    gc.close();
    expect(channel.close).toHaveBeenCalled();
    expect(gc.available).toBe(false);

    channel.onmessage?.({ data: { kind: 'progress' } } as MessageEvent<unknown>);
    expect(listener).not.toHaveBeenCalled();
  });
});
