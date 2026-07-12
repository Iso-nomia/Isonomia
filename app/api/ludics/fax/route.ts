export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const zBody = z.object({
  dialogueId: z.string(),
  fromLocusPath: z.string(),
  toLocusPath: z.string(),
});

export async function POST(req: NextRequest) {
  const parsed = zBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok:false, error: parsed.error.flatten() }, { status: 400 });
  const { dialogueId, fromLocusPath, toLocusPath } = parsed.data;
  // NOTE: the previous `faxDelocate(dialogueId, fromLocusPath, toLocusPath)` helper
  // no longer exists in packages/ludics-engine/fax. Faxing now requires source/target
  // design IDs (see faxBranch / faxFromScope), which this path-only endpoint does not
  // provide, so we surface a clear unsupported-operation response.
  const res = {
    ok: false as const,
    error: 'faxDelocate is no longer supported; use the design-scoped fax APIs instead.',
    dialogueId,
    fromLocusPath,
    toLocusPath,
  };
  return NextResponse.json(res, { status: 501 });
}
