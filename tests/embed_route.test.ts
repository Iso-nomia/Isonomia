import { NextRequest } from 'next/server';

let mockPrisma: any;
let logSpy: any;

jest.mock('@/lib/prismaclient', () => {
  mockPrisma = {
    canonicalMedia: { findMany: jest.fn(), },
    $executeRawUnsafe: jest.fn(),
  };
  return { prisma: mockPrisma };
});

jest.mock('@/lib/redis', () => ({ __esModule: true, default: { xadd: jest.fn() } }));

jest.mock('openai', () => {
  return class {
    embeddings = { create: jest.fn(async () => ({ data: [{ embedding: Array(3072).fill(0) }], usage: { total_tokens: 10 } })) };
  };
});

describe('embed route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns empty when cached', async () => {
    const { POST } = await import('@/app/api/embed/route');
    mockPrisma.canonicalMedia.findMany.mockResolvedValue([
      { id: 'a', title: 't', description: 'd', metadata: {}, embedding: [1] },
    ]);
    const req = new NextRequest(new URL('http://localhost/api/embed'), { method: 'POST', body: JSON.stringify({ ids: ['a'] }) });
    const res = await POST(req);
    const body = await res.json();
    expect(body.processed.length).toBe(0);
  });
});
