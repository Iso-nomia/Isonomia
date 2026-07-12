export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { zJudgeForce } from 'packages/ludics-rest/zod';
import { forceConcession, closeBranch } from 'packages/ludics-engine/judge';
import { LudicError } from 'packages/ludics-core/errors';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = zJudgeForce.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'BAD_REQUEST', issues: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const { dialogueId, action, target, data } = parsed.data;

    if (action === 'FORCE_CONCESSION') {
      if (!target?.designId || !target?.locusPath) {
        return NextResponse.json(
          { ok: false, error: { code: 'BAD_REQUEST', message: 'Missing target.designId or target.locusPath' } },
          { status: 400 },
        );
      }
      const res = await forceConcession({
        dialogueId,
        judgeId: 'system',
        targetDesignId: target.designId,
        locus: target.locusPath,
        text: data?.text || 'FORCED',
      });
      return NextResponse.json({ ok: true, ...res });
    }

    if (action === 'CLOSE_BRANCH') {
      if (!target?.designId || !target?.locusPath) {
        return NextResponse.json(
          { ok: false, error: { code: 'BAD_REQUEST', message: 'Missing target.designId or target.locusPath' } },
          { status: 400 },
        );
      }
      const res = await closeBranch(target.designId, target.locusPath);
      return NextResponse.json({ ok: true, ...res });
    }

    return NextResponse.json(
      { ok: false, error: { code: 'UNSUPPORTED_ACTION', message: String(action) } },
      { status: 400 },
    );
  } catch (err: any) {
    if (err instanceof LudicError) {
      return NextResponse.json(
        { ok: false, error: { code: err.code, message: err.message, info: err.info ?? null } },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: err?.message ?? 'Unknown error' } },
      { status: 500 },
    );
  }
}
