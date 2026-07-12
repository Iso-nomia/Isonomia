import express from 'express';
import request from 'supertest';
import Redis from 'ioredis-mock';
import { NextRequest } from 'next/server';

let mockPrisma: any;
const redis = new Redis();

jest.mock('@/lib/redis', () => ({ __esModule: true, default: redis }));

jest.mock('@/lib/prismaclient', () => {
  mockPrisma = {
    canonicalMedia: { findMany: jest.fn() },
    $executeRawUnsafe: jest.fn(),
  };
  return { prisma: mockPrisma };
});

jest.mock('openai', () => {
  return class { embeddings = { create: jest.fn(async () => ({ data: [{ embedding: Array(3072).fill(0) }], usage: { total_tokens: 5 } })) }; };
});

describe('embed integration', () => {
  it('embeds missing ids', async () => {
    const { POST } = await import('@/app/api/embed/route');
    mockPrisma.canonicalMedia.findMany.mockResolvedValue([
      { id: '1', title: 'a', description: '', metadata: {}, embedding: [1] },
      { id: '2', title: 'b', description: '', metadata: {}, embedding: [1] },
      { id: '3', title: 'c', description: '', metadata: {}, embedding: null },
    ]);

    const app = express();
    app.use(express.json());
    app.post('/api/embed', async (req, res) => {
      const r = await POST(new NextRequest('http://localhost/api/embed', { method: 'POST', body: JSON.stringify(req.body) }));
      const text = await r.text();
      res.status(r.status).set(Object.fromEntries(r.headers.entries())).send(text);
    });

    const resp = await request(app).post('/api/embed').send({ ids: ['1','2','3'] });
    expect(resp.status).toBe(200);
    expect(resp.body.processed).toEqual(['3']);
    expect(resp.body.tokens).toBeGreaterThan(0);
  });
});
