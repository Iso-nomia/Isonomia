export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { faxBranch } from 'packages/ludics-engine/fax';

const zBody = z.object({
  dialogueId: z.string(),
  fromDesignId: z.string(),
  toDesignId: z.string(),
  fromLocusPath: z.string(),
  toLocusPath: z.string(),
  includeActs: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = zBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  const res = await faxBranch(parsed.data);
  return NextResponse.json(res);
}
