export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serializeBigInt } from "@/lib/utils";
import { createFeedPost, fetchFeedPosts } from "@/lib/actions/feed.actions";


export async function GET() {
  const posts = await fetchFeedPosts();
  return NextResponse.json(serializeBigInt(posts));
}


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await createFeedPost(body);
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ message: e.message }, { status: 400 });
  }
}