export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createBlockFromElement } from "@/lib/actions/blocks.actions";

export async function POST(req: NextRequest) {
  const { pageSlug, elementId } = await req.json();
  if (!pageSlug || !elementId) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const row = await createBlockFromElement({ pageSlug, elementId });
  return NextResponse.json(row);
}
