import { NextRequest, NextResponse } from "next/server";
import { listBlocks, createBlockFromSpec } from "@/lib/actions/blocks.actions";

export const runtime = "nodejs";

// GET unchanged as before
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get("ownerId");
  try {
    const items = await listBlocks(ownerId ?? undefined);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}

// POST: create from spec; prefer ownerId in body (dev-friendly)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // If no ownerId and you want dev friendliness:
    // const fallbackOwner = process.env.NEXT_PUBLIC_DEV_OWNER_ID;
    // const ownerId = body.ownerId ?? fallbackOwner;

    const ownerId = body.ownerId;  // require explicit owner for now
    if (!ownerId) {
      return NextResponse.json({ error: "Unauthorized: ownerId missing" }, { status: 401 });
    }

    const row = await createBlockFromSpec({
      component: body.component,
      props: body.props ?? {},
      originSlug: body.originSlug ?? null,
      originElId: body.originElId ?? null,
      ownerId,                                   // 👈 pass through
    });
    return NextResponse.json(row);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "failed" }, { status: 401 });
  }
}
