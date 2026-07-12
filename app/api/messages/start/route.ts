export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { getOrCreateDM } from "@/lib/actions/conversation.actions";
import { jsonSafe } from "@/lib/bigintjson";
import { prisma } from "@/lib/prismaclient";

//add later:
// async function canSendDM(senderId: bigint, recipientId: bigint) {
//   // Example checks – tailor to your schema:
//   const settings = await prisma.userSettings.findUnique({
//     where: { user_id: recipientId },
//     select: { dm_from_friends_only: true },
//   });

//   if (!settings?.dm_from_friends_only) return true;

//   // Are they friends?
//   const isFriend = await prisma.friendship.findFirst({
//     where: {
//       OR: [
//         { user_a_id: senderId, user_b_id: recipientId, status: "accepted" },
//         { user_a_id: recipientId, user_b_id: senderId, status: "accepted" },
//       ],
//     },
//     select: { id: true },
//   });

//   return Boolean(isFriend);
// }





export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user?.userId) return new NextResponse("Unauthorized", { status: 401 });

  const { targetUserId } = await req.json();
  const recipientId = BigInt(targetUserId);


  // const allowed = await canSendDM(user.userId, recipientId);
  // if (!allowed) {
  //   return new NextResponse("Recipient only accepts DMs from friends", { status: 403 });
  // }

  const dm = await getOrCreateDM({ userAId: user.userId, userBId: recipientId });
  // return id as string for client convenience
  return NextResponse.json({ id: dm.id.toString() }, { status: 200 });
}