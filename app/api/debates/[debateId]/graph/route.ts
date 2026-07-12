export const dynamic = "force-dynamic";

// src/app/api/debates/[debateId]/graph/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabaseAdmin';
import type { AIFGraph, AnyNode, Edge } from '@/lib/aif/types';

export async function GET(_req: NextRequest, ctx: { params: { debateId: string } }) {
  try {
    const debateId = ctx.params.debateId;

    const [{ data: nodes, error: nerr }, { data: edges, error: eerr }] = await Promise.all([
      supabaseAdmin.from('nodes').select('*').eq('debate_id', debateId),
      supabaseAdmin.from('edges').select('*').eq('debate_id', debateId)
    ]);

    if (nerr) return NextResponse.json({ error: nerr.message }, { status: 400 });
    if (eerr) return NextResponse.json({ error: eerr.message }, { status: 400 });

    const toNode = (r: any): AnyNode => ({
      id: r.id, nodeType: r.node_type, content: r.content, metadata: r.metadata,
      createdAt: r.created_at, updatedAt: r.updated_at, creatorId: r.creator_id, debateId: r.debate_id,
      ...(r.node_type === 'I' && { claimText: r.claim_text }),
      ...(r.node_type === 'L' && { claimText: r.claim_text, speakerId: r.speaker_id, ilocutionType: r.illocution_type, propositionalContent: r.propositional_content, targetMoveId: r.target_move_id }),
      ...(r.node_type === 'RA' && { schemeId: r.scheme_id, schemeType: r.scheme_type, inferenceType: r.inference_type }),
      ...(r.node_type === 'CA' && { schemeId: r.scheme_id, conflictType: r.conflict_type }),
      ...(r.node_type === 'PA' && { schemeId: r.scheme_id, preferenceType: r.preference_type, justification: r.justification }),
      ...(r.node_type === 'TA' && { schemeId: r.scheme_id, schemeType: r.scheme_type, inferenceType: r.inference_type, protocolRuleId: r.protocol_rule_id })
    }) as AnyNode;

    const toEdge = (r: any): Edge => ({
      id: r.id, sourceId: r.source_id, targetId: r.target_id, edgeType: r.edge_type, metadata: r.metadata,
      createdAt: r.created_at, debateId: r.debate_id
    });

    const graph: AIFGraph = {
      nodes: (nodes ?? []).map(toNode),
      edges: (edges ?? []).map(toEdge),
      metadata: { debateId }
    };

    return NextResponse.json({ graph });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unexpected error' }, { status: 500 });
  }
}
