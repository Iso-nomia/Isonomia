export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { upsertVote } from "@/lib/actions/poll.actions";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { state } = await upsertVote({
      pollId: BigInt(params.id),
      kind: body.kind,
      optionIdx: body.optionIdx,
      value: body.value,
    });
    return NextResponse.json({ ok: true, state });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
