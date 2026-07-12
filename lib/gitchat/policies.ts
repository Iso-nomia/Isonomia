
 import { prisma } from "@/lib/prismaclient";
 
 // Baseline policy: message author or conversation moderator can merge.
 export async function canMerge_ownerOrMod(userId: bigint, messageId: bigint): Promise<boolean> {
   const msg = await prisma.message.findUnique({
     where: { id: messageId },
     select: { sender_id: true, conversation_id: true },
   });
   if (!msg) return false;
   if (String(msg.sender_id) === String(userId)) return true;
   // Heuristic: check ConversationParticipant role if you have it, else grant to room creator (cheap baseline).
   const part = await prisma.conversationParticipant.findFirst({
     where: { conversation_id: msg.conversation_id, user_id: userId },
     select: { id: true },
   }).catch(() => null as any);
   const role = (part as any)?.role ?? "";
   return ["MOD", "ADMIN", "OWNER"].includes(String(role).toUpperCase());
 }
 
 export type MergePolicyId = "owner-or-mod@v1";
 export const DefaultMergePolicy: MergePolicyId = "owner-or-mod@v1";
 
 export async function checkMergeAllowed(policy: MergePolicyId, userId: bigint, messageId: bigint) {
   switch (policy) {
     case "owner-or-mod@v1":
     default:
       return canMerge_ownerOrMod(userId, messageId);
   }
 }
