export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { fetchRealtimePosts } from "@/lib/actions/realtimepost.actions";
import { realtime_post_type } from "@prisma/client";
import { serializeBigInt } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const roomId = params.get("roomId") ?? "global";
  const page = params.get("page") ? parseInt(params.get("page")!, 10) : 1;
  const pageSize = params.get("pageSize") ? parseInt(params.get("pageSize")!, 10) : 20;
  const typesParam = params.get("types");
  const postTypes: realtime_post_type[] = typesParam
    ? (typesParam.split(",") as realtime_post_type[])
    : [
        "TEXT",
        "VIDEO",
        "IMAGE",
        "IMAGE_COMPUTE",
        "GALLERY",
        "DRAW",
        "LIVECHAT",
        "MUSIC",
        "ENTROPY",
        "PLUGIN",
        "PRODUCT_REVIEW",
        "PREDICTION",
      ];

  const data = await fetchRealtimePosts({
    realtimeRoomId: roomId,
    postTypes,
    pageNumber: page,
    pageSize,
  });
  return NextResponse.json(serializeBigInt(data));
}
