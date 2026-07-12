// app/api/kb/pages/[id]/export-aif/route.ts
// Export KB page as merged AIF-JSON-LD graph
// Traverses all deliberation blocks and merges their AIF exports

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { requireKbRole } from '@/lib/kb/withSpaceAuth';
import { exportDeliberationAsAifJSONLD } from '@/lib/aif/export';
import ctx from '@/lib/aif/context.json';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const page = await prisma.kbPage.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, spaceId: true },
  });
  if (!page) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await requireKbRole(req, { spaceId: page.spaceId, need: 'reader' });

  const blocks = await prisma.kbBlock.findMany({
    where: { pageId: page.id },
    orderBy: { ord: 'asc' },
    select: { id: true, type: true, dataJson: true },
  });

  // 1) Collect all deliberationIds referenced in blocks
  const deliberationIds = new Set<string>();
  
  for (const b of blocks) {
    const d = (b.dataJson || {}) as any; // Type assertion for JSON data
    
    // claim/argument blocks may have deliberationId
    if (b.type === 'claim' && d.deliberationId) {
      deliberationIds.add(d.deliberationId);
    }
    if (b.type === 'argument' && d.deliberationId) {
      deliberationIds.add(d.deliberationId);
    }
    if (b.type === 'sheet' && d.deliberationId) {
      deliberationIds.add(d.deliberationId);
    }
    if (b.type === 'room_summary' && d.id) {
      // Room summaries reference a room - rooms are linked to deliberations via Conversation
      // For now, skip room deliberation collection (needs conversation → deliberation lookup)
      // TODO: Implement conversation → deliberation mapping
    }
  }

  // 2) Export each deliberation as AIF-JSON-LD
  const exports = await Promise.all(
    Array.from(deliberationIds).map(async (deliberationId) => {
      try {
        return await exportDeliberationAsAifJSONLD(deliberationId);
      } catch (err) {
        console.warn(`Failed to export deliberation ${deliberationId}:`, err);
        return null;
      }
    })
  );

  // 3) Merge all exports into single AIF graph
  const mergedNodes: any[] = [];
  const mergedEdges: any[] = [];
  const seenNodeIds = new Set<string>();
  const seenEdgeIds = new Set<string>();

  for (const exp of exports) {
    if (!exp) continue;
    
    // Add nodes (deduplicate by @id)
    for (const node of exp.nodes) {
      if (!seenNodeIds.has(node['@id'])) {
        seenNodeIds.add(node['@id']);
        mergedNodes.push(node);
      }
    }
    
    // Add edges (deduplicate by @id)
    for (const edge of exp.edges) {
      const edgeId = edge['@id'] || `${edge.from}_${edge.role}_${edge.to}`;
      if (!seenEdgeIds.has(edgeId)) {
        seenEdgeIds.add(edgeId);
        mergedEdges.push(edge);
      }
    }
  }

  // 4) Build final AIF-JSON-LD document
  const aifDoc = {
    '@context': ctx['@context'],
    '@id': `kb:page:${page.id}`,
    '@type': 'kb:Page',
    title: page.title,
    deliberations: Array.from(deliberationIds),
    nodes: mergedNodes,
    edges: mergedEdges,
    metadata: {
      exportedAt: new Date().toISOString(),
      nodeCount: mergedNodes.length,
      edgeCount: mergedEdges.length,
      deliberationCount: deliberationIds.size,
    },
  };

  return NextResponse.json(aifDoc, {
    status: 200,
    headers: {
      'Content-Type': 'application/ld+json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
