export const dynamic = "force-dynamic";

// src/app/api/debates/[debateId]/nodes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabaseAdmin';
import type { NodeType, IlocutionType, InferenceType, SchemeType, PreferenceType, ConflictType } from '@/lib/aif/types';

type CreateNodeRequest = {
  nodeType: NodeType;
  content: string;
  metadata?: Record<string, unknown>;
  claimText?: string;
  speakerId?: string;
  ilocutionType?: IlocutionType;
  propositionalContent?: string;
  targetMoveId?: string;
  schemeId?: string;
  schemeType?: SchemeType;
  inferenceType?: InferenceType;
  conflictType?: ConflictType;
  preferenceType?: PreferenceType;
  justification?: string;
  protocolRuleId?: string;
  creatorId?: string; // optional override (generally not needed if using auth.uid())
};

export async function POST(req: NextRequest, ctx: { params: { debateId: string } }) {
  try {
    const debateId = ctx.params.debateId;
    const body = (await req.json()) as CreateNodeRequest;

    if (!debateId) return NextResponse.json({ error: 'Missing debateId' }, { status: 400 });
    if (!body?.nodeType || !body?.content) {
      return NextResponse.json({ error: 'nodeType and content are required' }, { status: 400 });
    }
    // Minimal type-specific checks
    if (body.nodeType === 'I' && !body.claimText) {
      return NextResponse.json({ error: 'I-node requires claimText' }, { status: 400 });
    }
    if (body.nodeType === 'L' && (!body.speakerId || !body.ilocutionType)) {
      return NextResponse.json({ error: 'L-node requires speakerId and ilocutionType' }, { status: 400 });
    }
    if ((body.nodeType === 'RA' || body.nodeType === 'TA') && !body.inferenceType) {
      return NextResponse.json({ error: 'RA/TA require inferenceType' }, { status: 400 });
    }
    if (body.nodeType === 'CA' && !body.conflictType) {
      return NextResponse.json({ error: 'CA-node requires conflictType' }, { status: 400 });
    }
    if (body.nodeType === 'PA' && !body.preferenceType) {
      return NextResponse.json({ error: 'PA-node requires preferenceType' }, { status: 400 });
    }

    const insert = {
      node_type: body.nodeType,
      content: body.content,
      metadata: body.metadata ?? {},
      creator_id: body.creatorId ?? null,
      debate_id: debateId,
      claim_text: body.claimText ?? null,
      speaker_id: body.speakerId ?? null,
      illocution_type: body.ilocutionType ?? null,
      propositional_content: body.propositionalContent ?? null,
      target_move_id: body.targetMoveId ?? null,
      scheme_id: body.schemeId ?? null,
      scheme_type: body.schemeType ?? null,
      inference_type: body.inferenceType ?? null,
      conflict_type: body.conflictType ?? null,
      preference_type: body.preferenceType ?? null,
      justification: body.justification ?? null,
      protocol_rule_id: body.protocolRuleId ?? null
    };

    const { data, error } = await supabaseAdmin
      .from('nodes')
      .insert(insert)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ node: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Unexpected error' }, { status: 500 });
  }
}
