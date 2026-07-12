export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';
import { getCurrentUserId } from '@/lib/serverutils';
import crypto from 'crypto';
import { mintClaimMoid } from '@/lib/ids/mintMoid';
import { PaginationQuery, makePage } from '@/lib/server/pagination';
import { since as startTimer, addServerTiming } from '@/lib/server/timing';
import { isValid, parseISO } from 'date-fns';
 import { emitBus } from '@/lib/server/bus';
// import { bus } from '@/lib/bus';
import  bus  from '@/lib/server/bus';


const SaveSchema = z.object({
  claimText: z.string().min(2),
  reasonsText: z.array(z.string()).min(1),
  evidenceLinks: z.array(z.string().url()).optional().default([]),
  anticipatedObjectionsText: z.array(z.string()).optional().default([]),
  counterText: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: z.enum(['draft','published']).default('draft'),
  hostEmbed: z.enum(['article','post','room_thread']).optional(),
  hostId: z.string().optional(),
  warrantText: z.string().optional(), // optional field we discussed
  quantifier: z.enum(["SOME","MANY","MOST","ALL"]).optional(),
modality: z.enum(["COULD","LIKELY","NECESSARY"]).optional(),
  cardId: z.string().optional(),
});

const canonicalize = (o: any) =>
  JSON.stringify(o, Object.keys(o).sort(), 2)
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();

function mintMoid(payload: any) {
  const canon = canonicalize(payload);
  return crypto.createHash('sha256').update(canon).digest('hex');
}

const Query = PaginationQuery.extend({
  status: z.enum(['draft','published']).optional(),
  authorId: z.string().optional(),
  since: z.string().optional(),  // ISO date/time
  until: z.string().optional(),  // ISO date/time (exclusive)
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const t = startTimer();
  const deliberationId = params.id;
  const url = new URL(req.url);

  const wantsPage = url.searchParams.has('cursor') || url.searchParams.has('limit') || url.searchParams.get('page') === '1';

  const parsed = Query.safeParse({
    cursor: url.searchParams.get('cursor') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    sort: url.searchParams.get('sort') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    authorId: url.searchParams.get('authorId') ?? undefined,
    since: url.searchParams.get('since') ?? undefined,
    until: url.searchParams.get('until') ?? undefined,
  });

  if (!parsed.success && wantsPage) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Legacy (no pagination flags): keep old response shape, but apply filters too
  if (!wantsPage) {
    const q = parsed.success ? parsed.data : { status: url.searchParams.get('status') ?? undefined } as any;
    const where: any = { deliberationId };
    if (q.status) where.status = q.status;
    if (q.authorId) where.authorId = q.authorId;
    if (q.since) where.createdAt = { ...(where.createdAt ?? {}), gte: parseISO(q.since) };
    if (q.until) where.createdAt = { ...(where.createdAt ?? {}), lt: parseISO(q.until) };

    const rows = await prisma.deliberationCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, deliberationId: true, authorId: true, status: true, createdAt: true,
        claimId: true, claimText: true, reasonsText: true, evidenceLinks: true,
        anticipatedObjectionsText: true, counterText: true, confidence: true,
        hostEmbed: true, hostId: true, warrantText: true,
        claim: { select: { id: true, text: true } },
      },
    });
    return NextResponse.json({ cards: rows });
  }

  // Paginated path
  const { cursor, limit, sort, status, authorId, since, until } = parsed.data!;
  const [field, dir] = (sort ?? 'createdAt:desc').split(':') as ['createdAt','asc'|'desc'];

  const where: any = { deliberationId };
  if (status) where.status = status;
  if (authorId) where.authorId = authorId;
  if (since) where.createdAt = { ...(where.createdAt ?? {}), gte: parseISO(since) };
  if (until) where.createdAt = { ...(where.createdAt ?? {}), lt: parseISO(until) };

  const rows = await prisma.deliberationCard.findMany({
    where,
    orderBy: [{ [field]: dir }, { id: dir }],
    take: (limit ?? 50) + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, deliberationId: true, authorId: true, status: true, createdAt: true,
      claimId: true, claimText: true, reasonsText: true, evidenceLinks: true,
      anticipatedObjectionsText: true, counterText: true, confidence: true,
      hostEmbed: true, hostId: true, warrantText: true,
      claim: { select: { id: true, text: true } },
    },
  });

  const page = makePage(rows, limit ?? 50);
  const res = NextResponse.json(page, { headers: { 'Cache-Control': 'no-store' } });
  addServerTiming(res, [{ name: 'total', durMs: t() }]);
  return res;
}

// POST create/update card (server derives author)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const deliberationId = params.id;
    const body = await req.json().catch(() => ({}));
    const input = SaveSchema.parse(body);

    // compute MOID from content fields (not status/host)
    const moid = mintMoid({
      claimText: input.claimText,
      reasonsText: input.reasonsText,
      evidenceLinks: input.evidenceLinks,
      anticipatedObjectionsText: input.anticipatedObjectionsText,
      counterText: input.counterText ?? null,
      confidence: input.confidence ?? null,
      warrantText: input.warrantText ?? null,
    });

    if (input.cardId) {
      const updated = await prisma.deliberationCard.update({
        where: { id: input.cardId },
        data: {
          claimText: input.claimText,
          reasonsText: input.reasonsText,
          evidenceLinks: input.evidenceLinks,
          anticipatedObjectionsText: input.anticipatedObjectionsText,
          counterText: input.counterText ?? null,
          confidence: input.confidence ?? null,
          status: input.status,
          warrantText: input.warrantText ?? null,
          hostEmbed: input.hostEmbed ?? null,
          hostId: input.hostId ?? null,
          moid,
        },
      });
      emitBus('cards:changed', { deliberationId });

      return NextResponse.json({ ok: true, card: updated });
    }
    
         // create or reuse claim first
const moidClaim = crypto.createHash('sha256').update(input.claimText).digest('hex');
const claim = await prisma.claim.upsert({
  where: { moid: moidClaim },
  update: {},
  create: {
    text: input.claimText,
    createdById: String(userId),
    deliberationId,
    moid: moidClaim,
  },
});

// then create the card linked to that claim
const created = await prisma.deliberationCard.create({
  data: {
    deliberationId,
    authorId: String(userId),
    claimText: input.claimText,
    claimId: claim.id,
    reasonsText: input.reasonsText,
    evidenceLinks: input.evidenceLinks,
    anticipatedObjectionsText: input.anticipatedObjectionsText,
    counterText: input.counterText ?? null,
    confidence: input.confidence ?? null,
    status: input.status,
    hostEmbed: input.hostEmbed ?? null,
    warrantText: input.warrantText ?? null,
    hostId: input.hostId ?? null,
    moid,
  },
});




// Auto-harvest reasons -> supports edges
for (const r of input.reasonsText) {
  if (!r.trim()) continue;
  const moid = crypto.createHash('sha256').update(r.trim()).digest('hex');
  const reasonClaim = await prisma.claim.upsert({
    where: { moid },
    update: {},
    create: {
      text: r.trim(),
      createdById: String(userId),
      deliberationId,
      moid,
    },
  });
  await prisma.claimEdge.upsert({
    where: {
      unique_from_to_type_attack: {
        fromClaimId: reasonClaim.id,
        toClaimId: claim.id,
        type: 'supports',
        attackType: 'SUPPORTS',
      },
    },
    update: {},
    create: {
      deliberationId,
      fromClaimId: reasonClaim.id,
      toClaimId: claim.id,
      type: 'supports',
      attackType: 'SUPPORTS',
    },
  });
}
// Auto-harvest objections -> rebuts edges
for (const o of input.anticipatedObjectionsText) {
  if (!o.trim()) continue;
  try {
    const moid = crypto.createHash('sha256').update(o.trim()).digest('hex');
    const objClaim = await prisma.claim.upsert({
      where: { moid },
      update: {},
      create: {
        text: o.trim(),
        createdById: String(userId),
        deliberationId,
        moid,
      },
    });

    await prisma.claimEdge.upsert({
      where: {
        unique_from_to_type_attack: {
          fromClaimId: objClaim.id,
          toClaimId: claim.id,
          type: 'rebuts',
          attackType: 'REBUTS',
        },
      },
      update: { targetScope: 'conclusion' },
      create: {
        deliberationId,
        fromClaimId: objClaim.id,
        toClaimId: claim.id,
        type: 'rebuts',
        attackType: 'REBUTS',
        targetScope: 'conclusion',
      },
    });
  } catch (err) {
    console.error(`[auto-harvest objection] failed for "${o}"`, err);
    // you could also collect these in an array if you want to report partial failures
  }
}

// Auto-harvest warrant text -> ClaimWarrant
if (input.warrantText?.trim()) {
  try {
    await prisma.claimWarrant.upsert({
      where: { claimId: claim.id },
      update: { text: input.warrantText.trim() },
      create: {
        claimId: claim.id,
        text: input.warrantText.trim(),
        createdBy: String(userId),
      },
    });
  } catch (err) {
    console.error(`[auto-harvest warrant] failed for claim ${claim.id}`, err);
  }
}

     // Create the argument with qualifiers
const argument = await prisma.argument.create({
  data: {
    deliberationId,
    claimId: claim.id,
    text: input.claimText,
    quantifier: input.quantifier ?? null,
    modality: input.modality ?? null,
    confidence: input.confidence ?? null,
    authorId: String(userId),
  },
});
// bus.emit('cards:changed', { deliberationId });

return NextResponse.json({
  ok: true,
  card: created,
  argument, // ✅ now it's defined
  harvested: {
    reasons: input.reasonsText.length,
    objections: input.anticipatedObjectionsText.length,
  },
});
  } catch (e: any) {
    console.error('[cards] failed', e);
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}
