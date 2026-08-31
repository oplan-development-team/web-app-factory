export type Listener<T> = (state: T) => void;

/** Tiny store: enough state management for this app's form + preview wiring. */
export class Store<T extends object> {
  private state: T;
  private listeners = new Set<Listener<T>>();

  constructor(initial: T) {
    this.state = initial;
  }

  get(): T {
    return this.state;
  }

  set(patch: Partial<T> | ((s: T) => T)): void {
    this.state = typeof patch === 'function' ? (patch as (s: T) => T)(this.state) : { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  subscribe(fn: Listener<T>): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
