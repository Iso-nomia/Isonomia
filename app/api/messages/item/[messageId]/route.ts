export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { supabase } from "@/lib/supabaseclient";
import { jsonSafe } from "@/lib/bigintjson";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    const me = await getUserFromCookies();
    if (!me?.userId) return new NextResponse("Unauthorized", { status: 401 });

    const id = BigInt(params.messageId);

    const message = await prisma.message.findUnique({
      where: { id },
      select: {
        id: true,
        sender_id: true,
        conversation_id: true,
        is_redacted: true,
      },
    });

    if (!message) return new NextResponse("Not found", { status: 404 });
    if (message.sender_id !== me.userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (message.is_redacted) {
      // already redacted; treat as success
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    await prisma.$transaction(async (tx) => {
      // Remove DB attachment rows (storage cleanup optional / later)
      await tx.messageAttachment.deleteMany({ where: { message_id: id } });
      await tx.message.update({
        where: { id },
        data: {
          text: null,
          is_redacted: true,
          deleted_at: new Date(),
        },
      });
    });

    // Notify room
    await supabase
      .channel(`conversation-${message.conversation_id.toString()}`)
      .send({
        type: "broadcast",
        event: "message_redacted",
        payload: jsonSafe({ id: message.id }),
      });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("[DELETE message] error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
