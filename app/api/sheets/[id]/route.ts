import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { z } from 'zod';
import {
  buildAttackGraph,
  toDefeatGraphFromAttackMap,
  labellingToSets,
  policyLabelling,
  resolveSemanticsPolicy,
} from '@/lib/argumentation';

const Q = z.object({
  // Optional per-request override; when absent the stored per-deliberation
  // setting (Deliberation.argumentSemantics) is used, then the engine default.
  semantics: z.enum(['preferred','grounded','stable']).optional(),
});

// Enhanced type with Phase 2 metadata
type SheetNode = {
  id: string;                   // render key (diagramId for sheet nodes; argumentId for deliberation)
  title: string | null;
  diagramId?: string | null;    // prefer for UI lookup
  claimId?: string | null;      // lets the reader bridge to /evidential
  argumentId?: string | null;   // FK to Argument (for joining with AIF metadata)
  
  // Phase 2.1: Scheme metadata
  schemeKey?: string | null;
  schemeName?: string | null;
  
  // Phase 2.1: CQ status
  cqStatus?: {
    open: number;
    answered: number;
    total: number;
    keys: string[];
  } | null;
  
  // Phase 2.1: Conflict metadata
  conflictCount?: number;
  
  // Phase 2.1: Preference rank
  preferenceRank?: number | null;
  
  // Phase 2.1: Toulmin structure depth
  toulminDepth?: number | null;
};
type SheetEdge = { fromId: string; toId: string; kind: 'support'|'rebut'|'undercut'; targetScope?: 'premise'|'inference'|'conclusion'|null };
type AcceptanceLabel = 'accepted'|'rejected'|'undecided';

/**
 * Phase 2.1: Compute enhanced metadata for a debate node
 * Fetches scheme, CQ status, conflict count, and Toulmin depth
 */
async function computeNodeMetadata(argumentId: string, deliberationId: string): Promise<Partial<SheetNode>> {
  // Fetch argument with scheme relation
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      id: true,
      schemeId: true,
      scheme: {
        select: {
          key: true,
          name: true,
        }
      }
    }
  });

  if (!arg) return {};

  // Fetch conflict count (CA-nodes targeting this argument)
  // TODO: Re-enable after Prisma client regenerates
  let conflictCount = 0;
  try {
    conflictCount = await (prisma as any).conflictApplication.count({
      where: {
        deliberationId,
        OR: [
          { conflictedArgumentId: argumentId },
          { conflictingArgumentId: argumentId },
        ]
      }
    });
  } catch (e) {
    console.warn('ConflictApplication query failed:', e);
  }

  // Fetch preference rank (simple: count of preferences favoring this argument)
  let preferenceCount = 0;
  try {
    preferenceCount = await (prisma as any).preferenceApplication.count({
      where: {
        deliberationId,
        preferredArgumentId: argumentId,
      }
    });
  } catch (e) {
    console.warn('PreferenceApplication query failed:', e);
  }

  // Compute Toulmin depth (max inference chain depth via ArgumentEdge)
  // This is a simplified version - could be enhanced with recursive depth calculation
  const maxDepth = await prisma.argumentEdge.count({
    where: {
      toArgumentId: argumentId,
      type: 'support',
    }
  });

  // TODO: CQ status computation - requires ArgumentDiagram.cqStatus field
  // For now, return placeholder
  const cqStatus = null;

  return {
    schemeKey: arg.scheme?.key ?? arg.schemeId ?? null,
    schemeName: arg.scheme?.name ?? null,
    cqStatus,
    conflictCount,
    preferenceRank: preferenceCount > 0 ? preferenceCount / 10.0 : null, // Normalize to 0-1 scale
    toulminDepth: maxDepth > 0 ? maxDepth : null,
  };
}


const normalizeEdgeKind = (k: string): 'support'|'rebut'|'undercut'|null => {
  // debateEdge.kind uses plurals/extra types; collapse to AF attacks/support
  if (k === 'supports' || k === 'support') return 'support';
  if (k === 'rebuts'   || k === 'objects' || k === 'rebut') return 'rebut';
  if (k === 'undercuts'|| k === 'undercut') return 'undercut';
  // refines/restates/clarifies/depends_on are non-attacking; ignore for AF
  return null;
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Sheet id semantics:
 * - If it looks like "delib:<id>", we treat <id> as deliberationId.
 * - Otherwise we assume it's directly a deliberationId (for convenience).
 */

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { semantics: semanticsOverride } = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const rawId = decodeURIComponent(params.id || '').trim();
  if (!rawId) return NextResponse.json({ error: 'Missing sheet id' }, { status: 400 });

  // --- Mode A: explicit deliberation sheet via "delib:<id>" or a bare deliberation id
  const deliberationId = rawId.startsWith('delib:') ? rawId.slice(6) : rawId;

  // Phase 4b: the acceptance-semantics policy is a stored per-deliberation
  // setting; an explicit ?semantics= query param overrides it for this request.
  const delibSetting = await prisma.deliberation
    .findUnique({ where: { id: deliberationId }, select: { argumentSemantics: true } })
    .catch(() => null);
  const policy = resolveSemanticsPolicy({
    override: semanticsOverride,
    stored: delibSetting?.argumentSemantics ?? null,
  });

  // If a DebateSheet with this id exists, prefer the *sheet-backed* view.
  const sheet = await prisma.debateSheet.findUnique({
    where: { id: rawId },
    select: { id: true, rulesetJson: true },
  });

  let nodes: SheetNode[] = [];
  let edges: SheetEdge[] = [];
  let acceptance: { semantics: string; labels: Record<string, AcceptanceLabel> } = { semantics: policy, labels: {} };
  let resolvedDelibId: string | null = null;

  

  if (sheet) {
    // --- Mode B: real DebateSheet (DebateNode/DebateEdge)
    const [dNodes, dEdges] = await Promise.all([
      prisma.debateNode.findMany({
        where: { sheetId: rawId },
        select: { id: true, title: true, diagramId: true, argumentId: true, claimId: true },
      }),
      prisma.debateEdge.findMany({
        where: { sheetId: rawId },
        select: { fromId: true, toId: true, kind: true },
      }),
    ]);

    // Try to derive a deliberation from any bridged argument (needed for metadata computation)
    const bridgedArg = dNodes.find(n => n.argumentId)?.argumentId;
    if (bridgedArg) {
      const arg = await prisma.argument.findUnique({ where: { id: bridgedArg }, select: { deliberationId: true } });
      resolvedDelibId = arg?.deliberationId ?? null;
    }

    // Fetch argument conclusion text for all nodes with argumentId
    const argIdToText = new Map<string, string>();
    const argIds = dNodes.filter(n => n.argumentId).map(n => n.argumentId!);
    if (argIds.length > 0) {
      const args = await prisma.argument.findMany({
        where: { id: { in: argIds } },
        select: { 
          id: true, 
          conclusion: { select: { text: true } } 
        }
      });
      args.forEach(a => {
        if (a.conclusion?.text) {
          argIdToText.set(a.id, a.conclusion.text);
        }
      });
    }

    // Build nodes + a mapping from DebateNode.id -> renderId (diagramId|argumentId|id)
const idMap = new Map<string,string>();

// Phase 2.1: Compute metadata for nodes with argumentId
const metadataMap = new Map<string, Partial<SheetNode>>();
const nodesWithArgs = dNodes.filter(n => n.argumentId);
if (nodesWithArgs.length > 0 && resolvedDelibId) {
  const metadataPromises = nodesWithArgs.map(n => 
    computeNodeMetadata(n.argumentId!, resolvedDelibId!)
  );
  const metadataResults = await Promise.all(metadataPromises);
  nodesWithArgs.forEach((n, idx) => {
    metadataMap.set(n.argumentId!, metadataResults[idx]);
  });
}

nodes = dNodes.map(n => {
  const renderId = n.diagramId ?? n.argumentId ?? n.id;
  idMap.set(n.id, renderId);
  const metadata = n.argumentId ? metadataMap.get(n.argumentId) || {} : {};
  // Use argument conclusion text if available, otherwise fall back to node title or renderId
  const displayTitle = n.argumentId && argIdToText.has(n.argumentId) 
    ? argIdToText.get(n.argumentId)!
    : (n.title ?? renderId);
  return {
    id: renderId,
    title: displayTitle,
    diagramId: n.diagramId ?? null,
    claimId: n.claimId ?? null,
    argumentId: n.argumentId ?? null,  // Add argumentId for UI to join with AIF data
    ...metadata,  // Spread enhanced metadata
  };
});

// Map edges to render ids and normalize kinds
edges = dEdges
  .map(e => {
    const k = normalizeEdgeKind(e.kind);
    if (!k) return null;
    const fromId = idMap.get(e.fromId) ?? e.fromId;
    const toId   = idMap.get(e.toId)   ?? e.toId;
    return {
      fromId,
      toId,
      kind: k,
      targetScope: k === 'undercut' ? 'inference' : k === 'rebut' ? 'conclusion' : null
    };
  })
  .filter(Boolean) as SheetEdge[];

    // Acceptance on AF projection of sheet edges
    const ids = nodes.map(n => n.id);
    const attacks = edges
      .filter(e => e.kind === 'rebut' || e.kind === 'undercut')
      .map(e => ({ from: e.fromId, to: e.toId, type: e.kind }));
    const attackMap = buildAttackGraph(ids, attacks);
    const dg = toDefeatGraphFromAttackMap(ids, attackMap);
    const { IN, OUT } = labellingToSets(policyLabelling(dg, policy));
    const labels: Record<string, AcceptanceLabel> = {};
    for (const id of ids) labels[id] = IN.has(id) ? 'accepted' : OUT.has(id) ? 'rejected' : 'undecided';
    acceptance = { semantics: policy, labels };

    // resolvedDelibId already set earlier in this block
  } else {
    // --- Mode A (deliberation-backed)
    const [args, aEdges] = await Promise.all([
      prisma.argument.findMany({
        where: { deliberationId },
        select: { id: true, text: true, claimId: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.argumentEdge.findMany({
        where: { deliberationId },
        select: { fromArgumentId: true, toArgumentId: true, type: true, targetScope: true },
      }),
    ]);

    // Phase 2.1: Compute enhanced metadata for each argument
    const metadataPromises = args.map(a => computeNodeMetadata(a.id, deliberationId));
    const metadataResults = await Promise.all(metadataPromises);

    nodes = args.map((a, idx) => ({
      id: a.id,
      title: a.text?.slice(0, 140) || a.id,
      diagramId: a.id,
      claimId: a.claimId ?? null,
      ...metadataResults[idx],  // Spread enhanced metadata
    }));

    edges = aEdges.map(e => ({
      fromId: e.fromArgumentId,
      toId:   e.toArgumentId,
      kind:   (e.type === 'rebut' ? 'rebut' : e.type === 'undercut' ? 'undercut' : 'support'),
      targetScope: e.targetScope ?? (e.type === 'rebut' ? 'conclusion' : e.type === 'undercut' ? 'inference' : null),
    }));

    // AF acceptance on argument graph
    const A = nodes.map(n => n.id);
    const attacks = aEdges
      .filter(e => e.type === 'rebut' || e.type === 'undercut')
      .map(e => ({ from: e.fromArgumentId, to: e.toArgumentId, type: e.type as 'rebut'|'undercut' }));
    const attackMap = buildAttackGraph(A, attacks);
    const dg = toDefeatGraphFromAttackMap(A, attackMap);
    const { IN, OUT } = labellingToSets(policyLabelling(dg, policy));
    const labels: Record<string, AcceptanceLabel> = {};
    for (const id of A) labels[id] = IN.has(id) ? 'accepted' : OUT.has(id) ? 'rejected' : 'undecided';
    acceptance = { semantics: policy, labels };
    resolvedDelibId = deliberationId;
  }

  // Unresolved WHYs only when we know the deliberation
  let unresolved: Array<{ nodeId: string; cqKey: string; cqText?: string }> = [];
  if (resolvedDelibId) {
    const mv = await prisma.dialogueMove.findMany({
      where: { deliberationId: resolvedDelibId },
      orderBy: { createdAt: 'asc' },
      select: { targetType:true, targetId:true, kind:true, payload:true, createdAt:true },
      take: 2000,
    });
    const byTarget = new Map<string, any[]>();
    for (const m of mv) {
      if (!m.targetType || !m.targetId) continue;
      const k = `${m.targetType}:${m.targetId}`;
      (byTarget.get(k) ?? byTarget.set(k, []).get(k)!).push(m);
    }
    
    const rawUnresolved: Array<{ nodeId: string; cqKey: string }> = [];
    for (const [_k, list] of byTarget) {
      list.sort((a, b) => +a.createdAt - +b.createdAt);
      const stack: any[] = [];
      for (const m of list) {
        if (m.kind === 'WHY') stack.push(m);
        if (m.kind === 'GROUNDS' || m.kind === 'RETRACT' || (m.kind === 'ASSERT' && (m.payload as any)?.as === 'CONCEDE')) {
          stack.pop();
        }
      }
      const tail = stack.at(-1);
      if (tail && tail.targetType === 'argument') {
        rawUnresolved.push({ nodeId: String(tail.targetId), cqKey: String((tail.payload as any)?.cqId ?? 'default') });
      }
    }
    
    // Fetch CQ text for all unresolved CQs
    const cqKeys = [...new Set(rawUnresolved.map(u => u.cqKey))];
    const cqTextMap = new Map<string, string>();
    if (cqKeys.length > 0) {
      const cqs = await prisma.criticalQuestion.findMany({
        where: { cqKey: { in: cqKeys } },
        select: { cqKey: true, text: true }
      });
      cqs.forEach(cq => {
        if (cq.cqKey) {
          cqTextMap.set(cq.cqKey, cq.text);
        }
      });
    }
    
    // Map to include CQ text
    unresolved = rawUnresolved.map(u => ({
      nodeId: u.nodeId,
      cqKey: u.cqKey,
      cqText: cqTextMap.get(u.cqKey)
    }));
  }

  const title = sheet ? `Debate sheet • ${rawId.slice(0,18)}…` : `Debate sheet • ${String(resolvedDelibId).slice(0,6)}…`;

  return NextResponse.json({
    sheet: {
      title,
      deliberationId,
      nodes,
      edges,
      acceptance,
      unresolved,
      loci: [{ id: `l0:${sheet ? rawId : resolvedDelibId}`, locusPath: '0', open: true, closable: false }],
      rulesetJson: sheet?.rulesetJson ?? null,
    }
  }, { headers: { 'Cache-Control': 'no-store' } });
}