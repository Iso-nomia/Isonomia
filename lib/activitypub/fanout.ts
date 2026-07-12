 import { prisma } from "@/lib/prismaclient";
 import { deliverActivity } from "./deliver";
 
 export async function deliverCreateNoteToFollowers({
   origin,
   localUserId,
   contentHtml,
 }: {
   origin: string;
   localUserId: bigint;
   contentHtml: string;
 }) {
   const user = await prisma.user.findUnique({ where: { id: localUserId }, select: { username: true } });
   if (!user) return 0;
   const actorId = `${origin}/users/${encodeURIComponent(user.username!)}`;
 
   const key = await prisma.activityPubKey.findUnique({ where: { user_id: localUserId } });
   if (!key) return 0;
   const keyId = `${actorId}#main-key`;
 
   const followers = await prisma.apFollower.findMany({
     where: { user_id: localUserId, state: "ACCEPTED", remote: { blocked: false } },
     select: { remote: { select: { inbox: true, sharedInbox: true } } },
     take: 2000,
   });
   const activity = {
     "@context": "https://www.w3.org/ns/activitystreams",
     id: `${actorId}/activities/${crypto.randomUUID()}`,
     type: "Create",
     actor: actorId,
     to: ["https://www.w3.org/ns/activitystreams#Public"],
     cc: [`${actorId}/followers`],
     object: {
       id: `${actorId}/notes/${crypto.randomUUID()}`,
       type: "Note",
       attributedTo: actorId,
       content: contentHtml,
       published: new Date().toISOString(),
     },
   };
  // store in outbox for paging
  await prisma.apOutboxActivity.create({
        data: { actor_user_id: localUserId, activity_json: activity },
      });
    
   let sent = 0;
   await Promise.all(
     followers.map(async (f) => {
       const inbox = f.remote.sharedInbox || f.remote.inbox;
       if (!inbox) return;
       try {
         await deliverActivity({ toInbox: inbox, activity, keyId, privateKeyPem: key.private_pem });
         sent  ;
       } catch (e) {
         console.warn("[ap] deliver create failed", inbox, e);
       }
     })
   );
   return sent;
 }