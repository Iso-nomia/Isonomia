import fetch from 'node-fetch';
import redis from '@/lib/redis';
import { getRedis } from '@/lib/redis';
const GROUP = 'retry_group';
const BATCH = 50;
const MAX_RETRY = 3;
const EMBED_URL: string | undefined = process.env.EMBEDDING_URL;
if (!EMBED_URL) {
  throw new Error('[embed_retry_worker] EMBEDDING_URL env var is required');
}
const EMBED_URL_RESOLVED: string = EMBED_URL;

export async function runOnce() {
  const redis = getRedis();
if (redis) {

  await redis.xgroup('CREATE', 'embedding_dlq', GROUP, '0', 'MKSTREAM').catch(() => {});
  const res: any = await redis.xreadgroup('GROUP', GROUP, 'worker', 'COUNT', BATCH, 'STREAMS', 'embedding_dlq', '>');
  if (!res) return;
  const messages = res[0][1] as [string, string[]][];
  const ids: string[] = [];
  const ack: string[] = [];
  const metas: Record<string, any> = {};
  for (const [id, fields] of messages) {
    const obj: any = {};
    for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i + 1];
    ids.push(obj.mediaId);
    ack.push(id);
    metas[id] = obj;
  }
  const resp = await fetch(EMBED_URL_RESOLVED, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (resp.ok) {
    await redis.xack('embedding_dlq', GROUP, ...ack);
  } else {
    for (const id of ack) {
      const meta = metas[id];
      const r = Number(meta.retry || '0') + 1;
      if (r >= MAX_RETRY) {
        await redis.xadd('embedding_dlq_dead', '*', 'mediaId', meta.mediaId, 'error', meta.error, 'ts', meta.ts, 'retry', r.toString());
      } else {
        await redis.xadd('embedding_dlq', '*', 'mediaId', meta.mediaId, 'error', meta.error, 'ts', meta.ts, 'retry', r.toString());
      }
      await redis.xack('embedding_dlq', GROUP, id);
    }
  }
}
}
if (require.main === module) {
  runOnce().then(() => process.exit(0));
}
