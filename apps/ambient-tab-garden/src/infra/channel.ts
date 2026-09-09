import { CHANNEL_NAME } from '../domain/constants';
import type { ChannelMessage } from '../domain/types';

type Listener = (msg: ChannelMessage) => void;

function isChannelMessage(v: unknown): v is ChannelMessage {
  if (typeof v !== 'object' || v === null) return false;
  const kind = (v as { kind?: unknown }).kind;
  return kind === 'joined' || kind === 'left' || kind === 'progress';
}

/**
 * Thin wrapper over BroadcastChannel, used only to make cross-tab updates feel
 * instant. It is deliberately not the source of truth: localStorage is, and the
 * per-second tick re-reads it. So when this API is unavailable, or a message is
 * dropped, tabs still converge -- just a beat later.
 */
export class GardenChannel {
  private bc: BroadcastChannel | null = null;
  private listeners: Listener[] = [];

  constructor(factory: (name: string) => BroadcastChannel = defaultFactory) {
    try {
      this.bc = factory(CHANNEL_NAME);
      if (this.bc) {
        this.bc.onmessage = (ev: MessageEvent<unknown>) => {
          if (!isChannelMessage(ev.data)) return;
          for (const listener of this.listeners) listener(ev.data);
        };
      }
    } catch {
      this.bc = null;
    }
  }

  get available(): boolean {
    return this.bc !== null;
  }

  post(msg: ChannelMessage): void {
    try {
      this.bc?.postMessage(msg);
    } catch {
      // A closed or failed channel must never break the tick loop.
    }
  }

  onMessage(listener: Listener): void {
    this.listeners.push(listener);
  }

  close(): void {
    try {
      this.bc?.close();
    } catch {
      /* already gone */
    }
    this.bc = null;
    this.listeners = [];
  }
}

function defaultFactory(name: string): BroadcastChannel {
  if (typeof BroadcastChannel === 'undefined') {
    throw new Error('BroadcastChannel unavailable');
  }
  return new BroadcastChannel(name);
}
