type Session = { users: [bigint, bigint]; touched: number };
export const espSessions = new Map<string, Session>();
export const TTL_MS = 10 * 60 * 1000;
export function touch(id: string) {
  const s = espSessions.get(id);
  if (s) {
    s.touched = Date.now();
  }
}
setInterval(() => {
  const now = Date.now();
  espSessions.forEach((s, id) => {
    if (now - s.touched > TTL_MS) {
      espSessions.delete(id);
    }
  });
}, 30_000);
