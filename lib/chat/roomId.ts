// lib/chat/roomKey.ts
export function dmRoomId(conversationId: string, a: string, b: string) {
  const [x, y] = [a, b].map(String).sort((m, n) => (BigInt(m) < BigInt(n) ? -1 : 1));
  return `dm:${conversationId}:${x}:${y}`;
}
