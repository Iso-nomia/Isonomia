let spy: any;

jest.mock('@/lib/redis', () => ({ __esModule: true, default: { xadd: jest.fn(async () => {}) } }));

describe('logToDlq', () => {
  it('logs once per id', async () => {
    const redis = (await import('@/lib/redis')).default as any;
    const { logToDlq } = await import('@/app/api/embed/route');
    await logToDlq('a', new Error('err'));
    await logToDlq('b', new Error('err'));
    expect(redis.xadd).toHaveBeenCalledTimes(2);
  });
});
