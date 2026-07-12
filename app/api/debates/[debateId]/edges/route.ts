export const dynamic = "force-dynamic";

// src/app/api/debates/[debateId]/edges/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabaseAdmin';
import { EdgeType } from '@/lib/aif/types';
type CreateEdgeRequest = {
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
  metadata?: Record<string, unknown>;
};

export async function POST(req: NextRequest, ctx: { params: { debateId: string } }) {
  try {
    const debateId = ctx.params.debateId;
    const body = (await req.json()) as CreateEdgeRequest;
    if (!body?.sourceId || !body?.targetId || !body?.edgeType) {
      return NextResponse.json({ error: 'sourceId, targetId, and edgeType are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('edges')
      .insert({
        source_id: body.sourceId,
        target_id: body.targetId,
        edge_type: body.edgeType,
        metadata: body.metadata ?? {},
        debate_id: debateId
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ edge: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unexpected error' }, { status: 500 });
  }
}
