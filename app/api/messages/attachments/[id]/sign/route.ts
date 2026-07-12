export const dynamic = "force-dynamic";

// app/api/messages/attachments/[id]/sign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { supabase } from "@/lib/supabaseclient";
// import { getUserFromCookies } from "@/lib/server/getUser";
import { getUserFromCookies } from "@/lib/serverutils";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ATTACHMENTS_BUCKET } from "@/lib/storage/constants";
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromCookies();
  if (!user?.userId) return new NextResponse("Unauthorized", { status: 401 });

  const attachmentId = BigInt(params.id);
  const a = await prisma.messageAttachment.findFirst({
    where: { id: attachmentId },
    select: {
      path: true,
      message: {
        select: {
          conversation_id: true,
          conversation: {
            select: { participants: { where: { user_id: user.userId }, select: { user_id: true } } },
          },
        },
      },
    },
  });

  if (!a) return new NextResponse("Not Found", { status: 404 });
  if (a.message.conversation.participants.length === 0)
    return new NextResponse("Forbidden", { status: 403 });

     const { data, error } = await supabaseAdmin
       .storage
       .from(ATTACHMENTS_BUCKET)
       .createSignedUrl(a.path, 60 * 60);
  if (error) return new NextResponse("Failed to sign", { status: 500 });

  return NextResponse.json({ url: data.signedUrl }, { status: 200 });
}
