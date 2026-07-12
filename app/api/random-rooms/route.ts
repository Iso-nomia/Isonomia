export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { fetchRandomRooms } from "@/lib/actions/realtimeroom.actions";

export async function GET(req: NextRequest) {
  const countParam = req.nextUrl.searchParams.get("count");
  const count = countParam ? parseInt(countParam, 10) : 4;
  const rooms = await fetchRandomRooms(count);
  return NextResponse.json(rooms);
}
