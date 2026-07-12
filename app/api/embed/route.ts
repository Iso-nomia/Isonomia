export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getRedis } from "@/lib/redis";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import OpenAI from "openai";
const openai = new OpenAI();

const schema = z.object({ ids: z.array(z.string()).max(200) });

function downsample(vec: number[]): number[] {
  const out = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    const off = i * 4;
    out[i] = (vec[off] + vec[off + 1] + vec[off + 2] + vec[off + 3]) / 4;
  }
  return Array.from(out);
}

async function logToDlq(mediaId: string, err: Error) {
  const redis = getRedis();
if (redis) {
  
  await redis.xadd(
    "embedding_dlq",
    "*",
    "mediaId",
    mediaId,
    "error",
    err.message,
    "ts",
    Date.now().toString(),
  );
}
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }
  const ids = Array.from(new Set(parsed.data.ids));
  if (ids.length > 200) {
    return new NextResponse("", { status: 413 });
  }
  if (ids.length === 0) return NextResponse.json({ processed: [], tokens: 0 });

  const rows = await prisma.canonicalMedia.findMany({
    where: { id: { in: ids } },
    select: { id: true, title: true, metadata: true, embedding: true },
  });

  const texts: Record<string, string[]> = {};
  for (const r of rows) {
    if (r.embedding && r.embedding.length) continue;
    const tags = ((r.metadata as any)?.tags || []).slice(0, 3).join(" ");
    const text = [r.title, tags].filter(Boolean).join(" ");
    (texts[text] ||= []).push(r.id);
  }

  if (Object.keys(texts).length === 0) {
    console.log(JSON.stringify({ metric: "media.embedding.cache_hit", count: ids.length }));
    return NextResponse.json({ processed: [], tokens: 0 });
  }

  try {
    const resp = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: Object.keys(texts),
    });
    const tokenCost = resp.usage?.total_tokens ?? 0;
    const data = resp.data.map(d => downsample(d.embedding));
    const rowsSqlIds: string[] = [];
    const rowsSqlVecs: string[] = [];
    let idx = 0;
    for (const text of Object.keys(texts)) {
      const vec = data[idx++];
      for (const id of texts[text]) {
        rowsSqlIds.push(id);
        rowsSqlVecs.push(`'{${vec.join(",")}}'`);
      }
    }
    await prisma.$executeRawUnsafe(
      `WITH data AS (
        SELECT UNNEST($1::text[]) AS id, UNNEST(ARRAY[${rowsSqlVecs.join(",")} ]::float4[]) AS vec
      )
      INSERT INTO canonical_media (id, embedding)
      SELECT id, vec FROM data
      ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding;`,
      rowsSqlIds,
    );
    console.log(JSON.stringify({ metric: "media.embedding.generated", count: rowsSqlIds.length }));
    return NextResponse.json({ processed: rowsSqlIds, tokens: tokenCost });
  } catch (err: any) {
    for (const idsList of Object.values(texts)) {
      for (const id of idsList) {
        await logToDlq(id, err);
      }
    }
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
