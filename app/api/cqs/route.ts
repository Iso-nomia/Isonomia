export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import crypto from 'node:crypto';
import { suggestionForCQ } from '@/lib/argumentation/cqSuggestions';
import { ArgCQArraySchema, ArgCQ } from '@/lib/types/argument';
import { TargetType } from '@prisma/client';
import { T } from 'tldraw';
const QuerySchema = z.object({
  targetType: z.enum(['claim', 'argument']),
  targetId: z.string().min(1),
  scheme: z.string().min(1).optional(),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // ✅ validate query params first
  const parsed = QuerySchema.safeParse({
    targetType: url.searchParams.get('targetType') ?? '',
    targetId: url.searchParams.get('targetId') ?? '',
    scheme: url.searchParams.get('scheme') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { targetType, targetId, scheme: filterScheme } = parsed.data;

  // fetch scheme instances
  const instances = await prisma.schemeInstance.findMany({
    where: { targetType, targetId },
    select: {
      scheme: { select: { key: true, title: true, cq: true } },
    },
  });

  // optional filter by scheme
  const filtered = filterScheme
    ? instances.filter((i) => i.scheme?.key === filterScheme)
    : instances;

  const keys = filtered
    .map((i) => i.scheme?.key)
    .filter(Boolean) as string[];

  // Phase 0.1: Fetch burden of proof metadata for CQs
  const criticalQuestions = await prisma.criticalQuestion.findMany({
    where: {
      schemeId: { in: keys },
    },
    select: {
      schemeId: true,
      cqKey: true,
      burdenOfProof: true,
      requiresEvidence: true,
      premiseType: true,
    },
  });

  // Build burden map: schemeKey -> cqKey -> burden metadata
  const burdenMap = new Map<string, Map<string, { 
    burdenOfProof: string; 
    requiresEvidence: boolean; 
    premiseType: string | null;
  }>>();
  
  criticalQuestions.forEach((cq: any) => {
    if (!cq.schemeId || !cq.cqKey) return;
    if (!burdenMap.has(cq.schemeId)) {
      burdenMap.set(cq.schemeId, new Map());
    }
    burdenMap.get(cq.schemeId)!.set(cq.cqKey, {
      burdenOfProof: cq.burdenOfProof,
      requiresEvidence: cq.requiresEvidence,
      premiseType: cq.premiseType,
    });
  });

  // fetch current statuses with response data
  const statuses = await prisma.cQStatus.findMany({
    where: { 
      targetType: targetType as TargetType,
      targetId,
      schemeKey: { in: keys },
    },
    select: {
      id: true,
      schemeKey: true,
      cqKey: true,
      satisfied: true,
      // @ts-ignore - groundsText exists in schema but Prisma types may be cached
      groundsText: true,
      statusEnum: true,
      canonicalResponseId: true,
      canonicalResponse: {
        select: {
          id: true,
          groundsText: true,
          contributorId: true,
          upvotes: true,
          downvotes: true,
          createdAt: true,
        },
      },
      responses: {
        where: {
          responseStatus: { in: ["PENDING", "APPROVED", "CANONICAL"] },
        },
        select: {
          id: true,
          responseStatus: true,
        },
      },
    },
  });

  const statusMap = new Map<
    string,
    Map<
      string,
      {
        id: string; // ✅ CQStatus ID
        satisfied: boolean;
        groundsText?: string;
        statusEnum?: string;
        canonicalResponse?: any;
        pendingCount: number;
        approvedCount: number;
        totalResponseCount: number;
        whyCount: number; // Phase 8: Dialogue move counts
        groundsCount: number; // Phase 8: Dialogue move counts
      }
    >
  >();
  keys.forEach((k) => statusMap.set(k, new Map()));
  
  // Phase 8: Fetch DialogueMove counts for each CQ
  // Optimized: Use aggregated query instead of O(n*m) loop
  const moveCounts = await prisma.$queryRaw<Array<{ cq_key: string; kind: string; count: bigint }>>`
    SELECT 
      payload->>'cqKey' as cq_key,
      kind,
      COUNT(*) as count
    FROM "DialogueMove"
    WHERE "targetType" = ${targetType as string}
      AND "targetId" = ${targetId}
      AND payload->>'cqKey' IS NOT NULL
    GROUP BY payload->>'cqKey', kind
  `;

  // Build counts map from aggregated results
  const dialogueCountsMap = new Map<string, Map<string, { whyCount: number; groundsCount: number }>>();
  
  for (const row of moveCounts) {
    const cqKey = row.cq_key;
    if (!cqKey) continue;

    // Find which schemeKey this cqKey belongs to
    for (const [schemeKey, cqMap] of statusMap) {
      if (cqMap.has(cqKey)) {
        if (!dialogueCountsMap.has(schemeKey)) {
          dialogueCountsMap.set(schemeKey, new Map());
        }
        if (!dialogueCountsMap.get(schemeKey)!.has(cqKey)) {
          dialogueCountsMap.get(schemeKey)!.set(cqKey, { whyCount: 0, groundsCount: 0 });
        }
        
        const counts = dialogueCountsMap.get(schemeKey)!.get(cqKey)!;
        const count = Number(row.count);
        if (row.kind === 'WHY') {
          counts.whyCount = count;
        } else if (row.kind === 'GROUNDS') {
          counts.groundsCount = count;
        }
        break; // Found the scheme, no need to continue
      }
    }
  }
  
  statuses.forEach((s) => {
    // @ts-ignore - Prisma types may be cached, these fields exist in schema
    const pendingCount = s.responses.filter((r: any) => r.responseStatus === "PENDING").length;
    // @ts-ignore - Prisma types may be cached, these fields exist in schema
    const approvedCount = s.responses.filter(
      (r: any) => r.responseStatus === "APPROVED" || r.responseStatus === "CANONICAL"
    ).length;
    
    // Phase 8: Get dialogue move counts for this CQ
    const dialogueCounts = dialogueCountsMap.get(s.schemeKey)?.get(s.cqKey) ?? { whyCount: 0, groundsCount: 0 };
    
    statusMap.get(s.schemeKey)?.set(s.cqKey, {
      id: s.id, // ✅ Include CQ status ID for frontend queries
      satisfied: s.satisfied,
      // @ts-ignore - Prisma types may be cached, these fields exist in schema
      groundsText: s.groundsText ?? undefined,
      // @ts-ignore - Prisma types may be cached, these fields exist in schema
      statusEnum: s.statusEnum,
      // @ts-ignore - Prisma types may be cached, these fields exist in schema
      canonicalResponse: s.canonicalResponse,
      pendingCount,
      approvedCount,
      // @ts-ignore - Prisma types may be cached, these fields exist in schema
      totalResponseCount: s.responses.length,
      whyCount: dialogueCounts.whyCount, // Phase 8
      groundsCount: dialogueCounts.groundsCount, // Phase 8
    });
  });

  const schemes = filtered.map((i) => {
    const key = i.scheme?.key ?? 'generic';
    const title = i.scheme?.title ?? key;

    // ✅ validate cq JSON here
    const parsedCqs = ArgCQArraySchema.safeParse(i.scheme?.cq ?? []);
    const cqs: ArgCQ[] = parsedCqs.success ? parsedCqs.data : [];

    const merged = cqs.map((cq) => {
      const status = statusMap.get(key)?.get(cq.key);
      const burden = burdenMap.get(key)?.get(cq.key);
      return {
        id: status?.id, // Include CQStatus ID
        key: cq.key,
        text: cq.text,
        satisfied: status?.satisfied ?? false,
        groundsText: status?.groundsText, // Include stored grounds text
        suggestion: suggestionForCQ(key, cq.key),
        // Phase 0.1: Burden of Proof metadata
        burdenOfProof: burden?.burdenOfProof ?? 'PROPONENT',
        requiresEvidence: burden?.requiresEvidence ?? false,
        premiseType: burden?.premiseType ?? null,
      };
    });

    return { key, title, cqs: merged };
  });

  // ETag handling
  const body = { targetType, targetId, schemes };
  const etag = crypto
    .createHash('sha1')
    .update(JSON.stringify(body))
    .digest('base64');

  const ifNoneMatch = req.headers.get('if-none-match');
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, 'Cache-Control': 'private, max-age=30, must-revalidate' },
    });
  }

  return NextResponse.json(body, {
    headers: { ETag: etag, 'Cache-Control': 'private, max-age=30, must-revalidate' },
  });
}

// POST handler for legacy CQ satisfaction (backward compatibility)
const PostSchema = z.object({
  targetType: z.enum(['claim', 'argument']),
  targetId: z.string().min(1),
  schemeKey: z.string().min(1),
  cqKey: z.string().min(1),
  satisfied: z.boolean(),
  groundsText: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PostSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { targetType, targetId, schemeKey, cqKey, satisfied, groundsText } = parsed.data;

    // ✅ AUTHOR-ONLY GUARD: Only claim/argument author can mark CQs satisfied (canonical answer)
    const { getCurrentUserId } = await import('@/lib/serverutils');
    const userId = await getCurrentUserId().catch(() => null);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get target author
    let targetAuthorId: string | null = null;
    if (targetType === 'claim') {
      const claim = await prisma.claim.findUnique({
        where: { id: targetId },
        select: { createdById: true }
      });
      targetAuthorId = claim ? String(claim.createdById) : null;
    } else if (targetType === 'argument') {
      const arg = await prisma.argument.findUnique({
        where: { id: targetId },
        select: { authorId: true }
      });
      targetAuthorId = arg ? String(arg.authorId) : null;
    }

    const isAuthor = targetAuthorId === String(userId);
    
    if (!isAuthor) {
      return NextResponse.json({ 
        error: 'Only the claim/argument author can mark CQs satisfied (canonical answer). Use the Community Responses feature to contribute.',
        hint: 'community_response_feature'
      }, { status: 403 });
    }

    // Upsert CQStatus record
    const status = await prisma.cQStatus.upsert({
      where: {
        targetType_targetId_schemeKey_cqKey: {
          targetType: targetType as TargetType,
          targetId,
          schemeKey,
          cqKey,
        },
      },
      update: {
        satisfied,
        // @ts-ignore - Prisma types may be cached, groundsText exists in schema
        groundsText: groundsText ?? null,
        updatedAt: new Date(),
      },
      create: {
        targetType: targetType as TargetType,
        targetId,
        schemeKey,
        cqKey,
        satisfied,
        // @ts-ignore - Prisma types may be cached, groundsText exists in schema
        groundsText: groundsText ?? null,
        createdById: String(userId), // ✅ Use actual user ID, not 'system'
        statusEnum: satisfied ? 'SATISFIED' : 'OPEN',
      },
    });

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('[POST /api/cqs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update CQ status' },
      { status: 500 }
    );
  }
}
