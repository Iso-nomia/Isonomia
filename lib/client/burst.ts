// lib/client/burst.ts
type Burst = { ts: number; count: number; types: Record<string, number> };
export function coalesceBursts(
  list: any[], evt: { deliberationId?: string; type: string; ts: number },
  windowMs = 180000
) {
  const key = evt.deliberationId || 'global';
  const now = evt.ts || Date.now();

  const i = list.findIndex(x => x.kind === 'burst' && x.key === key && now - x.ts <= windowMs);
  if (i >= 0) {
    const b: Burst = list[i].burst;
    b.count += 1;
    b.types[evt.type] = (b.types[evt.type]||0) + 1;
    list[i] = { ...list[i], burst: b, ts: now };
  } else {
    list.unshift({ kind: 'burst', key, ts: now, burst: { ts: now, count: 1, types: { [evt.type]: 1 } }});
  }
  return list;
}
