// Simple keyed mutex to serialize compiles per deliberation (in-process)
const queues = new Map<string, Promise<void>>();

export async function withCompileLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  let release: () => void;
  const next = new Promise<void>(r => (release = r));
  queues.set(key, prev.then(() => next));

  try {
    await prev; // wait for previous holder
    return await fn();
  } finally {
    release!();
    // cleanup if no one is queued on top
    if (queues.get(key) === next) queues.delete(key);
  }
}
