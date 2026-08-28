import { CHANNEL_NAME } from './constants';
import type { ChannelMessage } from './types';

type Listener = (msg: ChannelMessage) => void;

/**
 * Thin wrapper around BroadcastChannel. Falls back to a no-op broadcaster if
 * the API is unavailable (older browsers) -- the periodic tick loop in
 * main.ts still keeps every tab eventually consistent via localStorage.
 */
export class GardenChannel {
  private bc: BroadcastChannel | null = null;
  private listeners: Listener[] = [];

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(CHANNEL_NAME);
      this.bc.onmessage = (ev: MessageEvent<ChannelMessage>) => {
        for (const listener of this.listeners) listener(ev.data);
      };
    }
  }

  post(msg: ChannelMessage): void {
    this.bc?.postMessage(msg);
  }

  onMessage(listener: Listener): void {
    this.listeners.push(listener);
  }

  close(): void {
    this.bc?.close();
  }
}
