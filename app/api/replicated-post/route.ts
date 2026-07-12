export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { fetchPostById } from "@/lib/actions/thread.actions";
import { fetchRealtimePostById } from "@/lib/actions/realtimepost.actions";
import {
  fetchLikeForCurrentUser,
  fetchRealtimeLikeForCurrentUser,
} from "@/lib/actions/like.actions";
import { serializeBigInt } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const id = params.get("id");
  const originalId = params.get("originalId");
  const userId = params.get("userId");
  const isRealtime = params.get("isRealtime") === "true";

  if (!id || !originalId) {
    return NextResponse.json({ error: "Missing id or originalId" }, { status: 400 });
  }

  const original = isRealtime
    ? await fetchRealtimePostById({ id: originalId })
    : await fetchPostById(BigInt(originalId));

  if (!original) {
    return NextResponse.json({ original: null });
  }

  const currentUserLike = userId
    ? isRealtime
      ? await fetchRealtimeLikeForCurrentUser({
          realtimePostId: BigInt(id),
          userId: BigInt(userId),
        })
      : await fetchLikeForCurrentUser({ feedPostId: BigInt(id), userId: BigInt(userId) })
    : null;

  const originalUserLike = userId
    ? isRealtime
      ? await fetchRealtimeLikeForCurrentUser({
          realtimePostId: original.id,
          userId: BigInt(userId),
        })
      : await fetchLikeForCurrentUser({ feedPostId: original.id, userId: BigInt(userId) })
    : null;

  return NextResponse.json(
    serializeBigInt({ original, currentUserLike, originalUserLike })
  );
}
