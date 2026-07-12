export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { createGroupConversation } from "@/lib/actions/conversation.actions";
import { jsonSafe } from "@/lib/bigintjson";
export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user?.userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { title, participantIds } = await req.json();
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return new NextResponse("Invalid participants", { status: 400 });
  }
  const ids = participantIds.map((id: string) => BigInt(id));
  const convo = await createGroupConversation(user.userId, ids, title);
  return NextResponse.json(jsonSafe({ id: convo.id }), { status: 201 });
}
