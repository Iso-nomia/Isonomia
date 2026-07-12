export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { espSessions } from "@/lib/espSessionStore";
import { supabase } from "@/lib/supabaseclient";

export async function POST(req: NextRequest) {
  const { targetUserId, roomId } = (await req.json()) as {
    targetUserId: string;
    roomId: string;
  };
  const userId = 0n; // TODO: auth
  const targetId = BigInt(targetUserId);
  const paneId = crypto.randomUUID();
  espSessions.set(paneId, { users: [userId, targetId], touched: Date.now() });
  await supabase.channel("esp-open").send({
    type: "broadcast",
    event: "open",
    payload: {
      paneId,
      roomId,
      users: [userId.toString(), targetId.toString()],
    },
  });
  return NextResponse.json({ paneId });
}
