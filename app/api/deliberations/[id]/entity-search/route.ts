// app/api/deliberations/[id]/entity-search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const QuerySchema = z.object({
  targetType: z.enum(['argument', 'claim', 'card', 'inference']),
  q: z.string().optional().default(''),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deliberationId = params.id;
  const { searchParams } = new URL(req.url);

  const parsed = QuerySchema.safeParse({
    targetType: searchParams.get('targetType'),
    q: searchParams.get('q') ?? '',
    limit: searchParams.get('limit') ?? '10',
  });

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid parameters' },
      { status: 400 }
    );
  }

  const { targetType, q, limit } = parsed.data;
  const searchTerm = q.trim();

  try {
    if (targetType === 'argument') {
      const rows = await prisma.argument.findMany({
        where: {
          deliberationId,
          ...(searchTerm
            ? {
                OR: [
                  { text: { contains: searchTerm, mode: 'insensitive' } },
                  { id: { contains: searchTerm } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          text: true,
          authorId: true,
          createdAt: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      const items = rows.map((r) => ({
        id: r.id,
        label: r.text.slice(0, 100) + (r.text.length > 100 ? '...' : ''),
        subtitle: `by ${r.authorId} • ${new Date(r.createdAt).toLocaleDateString()}`,
      }));

      return NextResponse.json({ ok: true, items });
    }

    if (targetType === 'claim') {
      const rows = await prisma.claim.findMany({
        where: {
          deliberationId,
          ...(searchTerm
            ? {
                OR: [
                  { text: { contains: searchTerm, mode: 'insensitive' } },
                  { id: { contains: searchTerm } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          text: true,
          createdById: true,
          createdAt: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      const items = rows.map((r) => ({
        id: r.id,
        label: r.text.slice(0, 100) + (r.text.length > 100 ? '...' : ''),
        subtitle: `by ${r.createdById} • ${new Date(r.createdAt).toLocaleDateString()}`,
      }));

      return NextResponse.json({ ok: true, items });
    }

    if (targetType === 'card') {
      const rows = await prisma.deliberationCard.findMany({
        where: {
          deliberationId,
          ...(searchTerm
            ? {
                OR: [
                  { id: { contains: searchTerm } },
                  { claim: { text: { contains: searchTerm, mode: 'insensitive' } } },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          claimId: true,
          createdAt: true,
          claim: {
            select: {
              text: true,
            },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      const items = rows.map((r) => ({
        id: r.id,
        label: r.claim?.text
          ? r.claim.text.slice(0, 100) + (r.claim.text.length > 100 ? '...' : '')
          : `Card ${r.id.slice(0, 8)}`,
        subtitle: new Date(r.createdAt).toLocaleDateString(),
      }));

      return NextResponse.json({ ok: true, items });
    }

    if (targetType === 'inference') {
      // For inferences, you might want to search ArgumentEdges or ClaimEdges
      // This is a placeholder - adjust based on your actual inference structure
      const rows = await prisma.argumentEdge.findMany({
        where: {
          deliberationId,
          ...(searchTerm ? { id: { contains: searchTerm } } : {}),
        },
        select: {
          id: true,
          fromArgumentId: true,
          toArgumentId: true,
          type: true,
          createdAt: true,
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      const items = rows.map((r) => ({
        id: r.id,
        label: `${r.type}: ${r.fromArgumentId.slice(0, 6)}… → ${r.toArgumentId.slice(0, 6)}…`,
        subtitle: new Date(r.createdAt).toLocaleDateString(),
      }));

      return NextResponse.json({ ok: true, items });
    }

    return NextResponse.json(
      { ok: false, error: 'Unsupported target type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Entity search error:', error);
    return NextResponse.json(
      { ok: false, error: 'Search failed' },
      { status: 500 }
    );
  }
}