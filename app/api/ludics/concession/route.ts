export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { zConcession } from 'packages/ludics-rest/zod';
import { concede } from 'packages/ludics-engine/concession';
import { LudicError } from 'packages/ludics-core/errors';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = zConcession.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'BAD_REQUEST', issues: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const res = await concede(parsed.data);
    return NextResponse.json({ ...res, ok: true });
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
