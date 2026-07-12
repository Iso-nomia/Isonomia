export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { forkBlock } from "@/lib/actions/blocks.actions";

export async function POST(_: NextRequest, ctx: { params: { id: string } }) {
  const row = await forkBlock({ blockId: ctx.params.id });
  return NextResponse.json(row);
}
