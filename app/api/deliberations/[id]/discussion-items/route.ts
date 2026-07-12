export const dynamic = "force-dynamic";

/**
 * GET /api/deliberations/[id]/discussion-items
 * 
 * Unified endpoint for ThreadedDiscussionTab that returns propositions, claims,
 * and arguments with threading metadata in a single response.
 * 
 * Combines data from:
 * - /api/deliberations/[id]/propositions (social layer)
 * - /api/deliberations/[id]/claims (claim layer)
 * - /api/deliberations/[id]/arguments/aif (argument layer with metadata)
 * 
 * Returns unified ThreadNode format with parent/target relationships preserved.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { since as startTimer, addServerTiming } from "@/lib/server/timing";
import { parseISO } from "date-fns";

const Query = z.object({
  // Filtering
  authorId: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  type: z.enum(["all", "proposition", "claim", "argument"]).optional().default("all"),
  
  // Pagination
  limit: z.coerce.number().min(1).max(500).optional().default(100),
  
  // Include options
  includeMetadata: z.coerce.boolean().optional().default(true),
  includeAuthors: z.coerce.boolean().optional().default(true),
});

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const t = startTimer();
  const url = new URL(req.url);
  
  const parsed = Query.safeParse({
    authorId: url.searchParams.get("authorId") ?? undefined,
    since: url.searchParams.get("since") ?? undefined,
    until: url.searchParams.get("until") ?? undefined,
    type: url.searchParams.get("type") ?? "all",
    limit: url.searchParams.get("limit") ?? undefined,
    includeMetadata: url.searchParams.get("includeMetadata") ?? undefined,
    includeAuthors: url.searchParams.get("includeAuthors") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400, ...NO_STORE }
    );
  }

  const { authorId, since, until, type, limit, includeMetadata, includeAuthors } = parsed.data;
  const deliberationId = params.id;

  // Build date filter
  const dateFilter: any = {};
  if (since) dateFilter.gte = parseISO(since);
  if (until) dateFilter.lt = parseISO(until);

  const items: any[] = [];
  const authorIds = new Set<string>();

  // 1. Fetch Propositions
  if (type === "all" || type === "proposition") {
    const where: any = { deliberationId };
    if (authorId) where.authorId = authorId;
    if (since || until) where.createdAt = dateFilter;

    const propositions = await prisma.proposition.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        deliberationId: true,
        authorId: true,
        text: true,
        mediaType: true,
        mediaUrl: true,
        status: true,
        voteUpCount: true,
        voteDownCount: true,
        endorseCount: true,
        replyCount: true,
        promotedClaimId: true,
        createdAt: true,
        // No parentId/targetId in Proposition schema
        // Threading will be handled through PropositionReply
      },
    });

    for (const p of propositions) {
      authorIds.add(p.authorId);
      items.push({
        id: p.id,
        type: "proposition",
        text: p.text,
        authorId: p.authorId,
        timestamp: p.createdAt.toISOString(),
        parentId: null, // Propositions are top-level
        targetId: null,
        targetType: null,
        metadata: {
          status: p.status,
          voteUpCount: p.voteUpCount,
          voteDownCount: p.voteDownCount,
          endorseCount: p.endorseCount,
          replyCount: p.replyCount,
          promotedClaimId: p.promotedClaimId,
          mediaType: p.mediaType,
          mediaUrl: p.mediaUrl,
        },
      });
    }
  }

  // 2. Fetch Claims
  if (type === "all" || type === "claim") {
    const where: any = { deliberationId };
    if (authorId) where.createdById = authorId;
    if (since || until) where.createdAt = dateFilter;

    const claims = await prisma.claim.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        text: true,
        createdAt: true,
        createdById: true,
      },
    });

    for (const c of claims) {
      if (c.createdById) authorIds.add(c.createdById);
      
      items.push({
        id: c.id,
        type: "claim",
        text: c.text,
        authorId: c.createdById || "system",
        timestamp: c.createdAt.toISOString(),
        claimId: c.id,
        parentId: null, // Claims are generally top-level
        targetId: null,
        targetType: null,
        metadata: {},
      });
    }
  }

  // 3. Fetch Arguments with AIF metadata
  if (type === "all" || type === "argument") {
    const where: any = { deliberationId };
    if (authorId) where.authorId = authorId;
    if (since || until) where.createdAt = dateFilter;

    const args = await prisma.argument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        text: true,
        authorId: true,
        createdAt: true,
        claimId: true,
        conclusionClaimId: true, // For attack generation
        confidence: true,
        // AIF metadata
        argumentSchemes: {
          select: {
            schemeId: true,
            confidence: true,
            isPrimary: true,
            scheme: {
              select: {
                key: true,
                name: true,
              },
            },
          },
        },
        // Attack relationships
        outgoingEdges: {
          where: {
            type: { not: "support" as any },
          },
          select: {
            type: true,
            attackSubtype: true,
            toArgumentId: true,
          },
        },
        incomingEdges: {
          where: {
            type: { not: "support" as any },
          },
          select: {
            type: true,
            attackSubtype: true,
            fromArgumentId: true,
          },
        },
      },
    });

    if (includeMetadata) {
      // Batch fetch CQ data for all arguments
      const argIds = args.map(a => a.id);
      
      // Count total CQs per argument
      const totalCQs = await prisma.cQStatus.groupBy({
        by: ["targetId"],
        where: {
          targetType: "argument",
          targetId: { in: argIds },
        },
        _count: {
          id: true,
        },
      });

      // Count satisfied CQs per argument
      const satisfiedCQs = await prisma.cQStatus.groupBy({
        by: ["targetId"],
        where: {
          targetType: "argument",
          targetId: { in: argIds },
          satisfied: true,
        },
        _count: {
          id: true,
        },
      });

      const totalMap = new Map(totalCQs.map(row => [row.targetId, row._count.id]));
      const satisfiedMap = new Map(satisfiedCQs.map(row => [row.targetId, row._count.id]));

      const cqMap = new Map(argIds.map(id => [
        id,
        { 
          required: totalMap.get(id) || 0,
          satisfied: satisfiedMap.get(id) || 0,
        }
      ]));

      // Process arguments
      for (const arg of args) {
        authorIds.add(arg.authorId);
        
        const primaryScheme = arg.argumentSchemes.find(s => s.isPrimary);
        const cqs = cqMap.get(arg.id);

        // Determine parent/target from attack edges
        const incomingAttack = arg.incomingEdges[0]; // Most recent attack targeting this
        const parentId = incomingAttack?.fromArgumentId || null;

        items.push({
          id: arg.id,
          type: "argument",
          text: arg.text,
          authorId: arg.authorId,
          timestamp: arg.createdAt.toISOString(),
          argumentId: arg.id,
          claimId: arg.conclusionClaimId, // Use conclusion claim for attacks
          parentId,
          targetId: parentId, // For arguments, parent and target are same
          targetType: parentId ? "argument" : null,
          schemeKey: primaryScheme?.scheme?.key,
          schemeName: primaryScheme?.scheme?.name,
          cqRequired: cqs?.required || 0,
          cqSatisfied: cqs?.satisfied || 0,
          // Raw authored argument confidence (intrinsic weight), not an evidential
          // accrual score. Use ?? so a legitimate stored 0 is preserved and a
          // missing value stays null (the badge hides instead of fabricating 60%).
          confidence: arg.confidence ?? null,
          attacks: {
            REBUTS: arg.outgoingEdges.filter(e => e.attackSubtype === "REBUT").length,
            UNDERCUTS: arg.outgoingEdges.filter(e => e.attackSubtype === "UNDERCUT").length,
            UNDERMINES: arg.outgoingEdges.filter(e => e.attackSubtype === "UNDERMINE").length,
          },
          metadata: {
            schemes: arg.argumentSchemes.map(s => ({
              key: s.scheme.key,
              name: s.scheme.name,
              confidence: s.confidence,
              isPrimary: s.isPrimary,
            })),
            outgoingAttacks: arg.outgoingEdges.length,
            incomingAttacks: arg.incomingEdges.length,
          },
        });
      }
    } else {
      // Simplified version without metadata
      for (const arg of args) {
        authorIds.add(arg.authorId);
        items.push({
          id: arg.id,
          type: "argument",
          text: arg.text,
          authorId: arg.authorId,
          timestamp: arg.createdAt.toISOString(),
          argumentId: arg.id,
          claimId: arg.claimId,
          parentId: null,
          targetId: null,
          targetType: null,
        });
      }
    }
  }

  // Sort all items by timestamp (newest first)
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // 4. Fetch author information if requested
  let authors: any[] = [];
  if (includeAuthors && authorIds.size > 0) {
    const userRecords = await prisma.user.findMany({
      where: { auth_id: { in: Array.from(authorIds) } },
      select: {
        auth_id: true,
        name: true,
        username: true,
        image: true,
      },
    });

    authors = userRecords.map(u => ({
      id: u.auth_id,
      name: u.name || u.username || `User ${u.auth_id.slice(0, 8)}`,
      image: u.image,
    }));
  }

  const response = {
    items,
    authors,
    meta: {
      deliberationId,
      total: items.length,
      types: {
        propositions: items.filter(i => i.type === "proposition").length,
        claims: items.filter(i => i.type === "claim").length,
        arguments: items.filter(i => i.type === "argument").length,
      },
      filters: { authorId, since, until, type },
    },
  };

  const res = NextResponse.json(response, NO_STORE);
  addServerTiming(res, [{ name: "total", durMs: t() }]);
  return res;
}
