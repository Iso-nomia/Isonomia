export const dynamic = "force-dynamic";

/**
 * AIF Neighborhood API Route - Schema Corrected
 * 
 * File: app/api/arguments/[id]/aif-neighborhood/route.ts
 * 
 * FIXED for actual Prisma schema:
 * 1. ArgumentEdge uses fromArgumentId/toArgumentId
 * 2. No ArgumentDiagram linked to Argument
 * 3. Arguments use simple ArgumentPremise -> Claim structure
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import type { AifSubgraph, AifNode, AifEdge, AifEdgeRole } from '@/lib/arguments/diagram';
import { buildAifNeighborhood, getNeighborhoodSummary } from '@/lib/arguments/diagram-neighborhoods';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const argumentId = params.id;
  const url = new URL(req.url);

  // Parse query parameters
  const depth = Number(url.searchParams.get('depth')) || 1;
  const summaryOnly = url.searchParams.get('summaryOnly') === 'true';
  const includeSupporting = url.searchParams.get('includeSupporting') !== 'false';
  const includeOpposing = url.searchParams.get('includeOpposing') !== 'false';
  const includePreferences = url.searchParams.get('includePreferences') !== 'false';

  try {
    // Validate depth
    if (depth < 0 || depth > 5) {
      return NextResponse.json(
        { ok: false, error: 'Depth must be between 0 and 5' },
        { status: 400 }
      );
    }

    // If summary only, return connection counts without full graph
    if (summaryOnly) {
      const summary = await getNeighborhoodSummary(argumentId);
      return NextResponse.json({ ok: true, summary });
    }

    // Build the full AIF neighborhood
    const aif = await buildAifNeighborhood(argumentId, depth, {
      includeSupporting,
      includeOpposing,
      includePreferences,
    });

    return NextResponse.json({ ok: true, aif });

  } catch (error) {
    console.error('Error fetching AIF neighborhood:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to fetch neighborhood'
      },
      { status: 500 }
    );
  }
}
