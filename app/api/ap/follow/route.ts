 import { NextRequest, NextResponse } from "next/server";
 import { z } from "zod";
 import { prisma } from "@/lib/prismaclient";
 import { getUserFromCookies } from "@/lib/serverutils";
 import { getOrigin } from "@/lib/activitypub/base";
 import { getOrCreateApKey } from "@/lib/activitypub/keys";
 import { deliverActivity } from "@/lib/activitypub/deliver";
 import { signedFetchJson } from "@/lib/activitypub/signing";
 
 export const runtime = "nodejs";
 
 const bodySchema = z.object({
   remoteActor: z.string().url(),
 });
 
 export async function POST(req: NextRequest) {
   const me = await getUserFromCookies();
   if (!me?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 
   const origin = getOrigin(req);
   const json = await req.json().catch(() => ({}));
   const { remoteActor } = bodySchema.parse(json);
 
   // local actor id
   const user = await prisma.user.findUnique({ where: { id: me.userId }, select: { username: true } });
   if (!user?.username) return NextResponse.json({ error: "no username" }, { status: 400 });
   const actorId = `${origin}/users/${encodeURIComponent(user.username)}`;
 
   // ensure keys
   const key = await getOrCreateApKey(me.userId);
   const keyId = `${actorId}#main-key`;
 
   // fetch remote actor (signed GET for Authorized Fetch)
   const remoteDoc = await signedFetchJson(remoteActor, { keyId, privateKeyPem: key.private_pem })
                  || await fetch(remoteActor, { headers: { accept: "application/activity+json" } }).then(r => r.ok ? r.json() : null).catch(() => null);
   if (!remoteDoc) return NextResponse.json({ error: "remote actor not reachable" }, { status: 400 });
 
   const remote = await prisma.apRemoteActor.upsert({
     where: { url: remoteActor },
     update: {
       inbox: remoteDoc?.inbox ?? undefined,
       sharedInbox: remoteDoc?.endpoints?.sharedInbox ?? undefined,
       preferredUsername: remoteDoc?.preferredUsername ?? undefined,
       domain: (() => { try { return new URL(remoteActor).host } catch { return undefined } })(),
       publicKeyPem: remoteDoc?.publicKey?.publicKeyPem ?? undefined,
       lastSeen: new Date(),
     },
     create: {
       url: remoteActor,
       inbox: remoteDoc?.inbox ?? null,
       sharedInbox: remoteDoc?.endpoints?.sharedInbox ?? null,
       preferredUsername: remoteDoc?.preferredUsername ?? null,
       domain: (() => { try { return new URL(remoteActor).host } catch { return null } })(),
       publicKeyPem: remoteDoc?.publicKey?.publicKeyPem ?? null,
       lastSeen: new Date(),
     },
     select: { id: true, inbox: true, sharedInbox: true },
   });
 
   await prisma.apFollowing.upsert({
     where: { user_id_remote_actor_id: { user_id: me.userId, remote_actor_id: remote.id } },
     update: { state: "PENDING" },
     create: { user_id: me.userId, remote_actor_id: remote.id, state: "PENDING" },
   });
 
   const inbox = remote.sharedInbox || remote.inbox;
   if (!inbox) return NextResponse.json({ error: "remote inbox missing" }, { status: 400 });
 
   const follow = {
     "@context": "https://www.w3.org/ns/activitystreams",
     id: `${actorId}/activities/${crypto.randomUUID()}`,
     type: "Follow",
     actor: actorId,
     object: remoteActor,
   };
   try {
     await deliverActivity({ toInbox: inbox, activity: follow, keyId, privateKeyPem: key.private_pem });
   } catch (e) {
     console.warn("[ap] follow deliver failed", e);
     // keep PENDING; remote may accept later
   }
 
   return NextResponse.json({ status: "ok", state: "PENDING" });
 }