import Redis from 'ioredis-mock';

const redis = new Redis();

jest.mock('@/lib/redis', () => ({ __esModule: true, default: redis }));

jest.mock('node-fetch', () => (
  jest.fn(async () => ({ ok: true }))
));

describe('retry worker', () => {
  it('consumes 50 messages', async () => {
    const { runOnce } = await import('@/jobs/embed_retry_worker');
    for (let i = 0; i < 50; i++) {
      await redis.xadd('embedding_dlq', '*', 'mediaId', `id${i}`, 'error', 'e', 'ts', '1');
    }
    await runOnce();
    const len = await redis.xlen('embedding_dlq');
    expect(len).toBe(0);
  });
});

