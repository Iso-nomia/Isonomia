export const dynamic = "force-dynamic";

// app/api/dialogue/legal-attacks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCitationCallerUserId } from '@/lib/citation/mcpAuth';
import { legalAttacksFor } from '@/lib/dialogue/legalAttackCuesFor';

const BodySchema = z.object({ text: z.string().min(1) });

export async function POST(req: NextRequest) {
  // Cookie/Firebase first, then MCP bearer → `mcp-bot`. Pure text shape-cue
  // analysis; the gate just keeps it non-anonymous.
  const userId = await resolveCitationCallerUserId(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { text } = parsed.data;
  const { shape, options } = legalAttacksFor(text);

  // Match Option-B’s expected shape: lm.ok && lm.options.length
  return NextResponse.json({
    ok: true,
    shape,
    options, // each has { key, label, template }
  });
}
