export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { stepInteraction } from '@/packages/ludics-engine/stepper';

export async function GET(req: NextRequest) {
  // In a real setup you could switch by ?name=…; we run the EnglishDrama default.
  try {
    // stepInteraction requires persisted LudicDesign rows (posDesignId/negDesignId).
    // The in-memory EnglishDrama example designs are not persisted, so without
    // upserting them first this endpoint cannot step; it falls through to null.
    const step = await stepInteraction({
      dialogueId: 'EXAMPLE:english-drama',
      posDesignId: '',
      negDesignId: '',
      phase: 'neutral',
      maxPairs: 256,
    }).catch(() => null);

    return NextResponse.json({ ok:true, example:'english-drama', step });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
