export const dynamic = "force-dynamic";

// app/api/feed/like/route.ts
import { NextResponse } from "next/server";
import { deleteFeedPost } from "@/lib/actions/feed.actions";

export async function POST(req: Request) {
  const { id } = await req.json();
  await deleteFeedPost({ id: BigInt(id) });
  return NextResponse.json({ ok: true });
}
