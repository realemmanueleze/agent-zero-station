type Listener = (count: number) => void;
const listeners = new Set<Listener>();

export function publishWaiting(count: number): void {
  for (const listener of listeners) {
    listener(count);
  }
}

export function subscribeWaiting(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
