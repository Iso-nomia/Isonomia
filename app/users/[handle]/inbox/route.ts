import { NextRequest } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { actorIdFromHandle, asJsonResponse, getOrigin } from "@/lib/activitypub/base";
import { getOrCreateApKey } from "@/lib/activitypub/keys";
import { parseSignatureHeader, verifySignature } from "@/lib/activitypub/signing";
import { deliverActivity } from "@/lib/activitypub/deliver";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

async function fetchRemoteActor(actorUrl: string) {
  try {
    const r = await fetch(actorUrl, { headers: { accept: "application/activity+json" } });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch {
    return null; // ← swallow DNS/NET errors; we can still 202
  }
}

 
 function domainOf(u: string) {
       try { return new URL(u).host.toLowerCase(); } catch { return ""; }
     }
     
     async function isDomainAllowed(domain: string) {
       if (!domain) return false;
       const deny = await prisma.apDomainRule.findUnique({ where: { domain } }).catch(() => null);
       if (deny?.mode === "DENY") return false;
       const anyAllow = await prisma.apDomainRule.count({ where: { mode: "ALLOW" } });
       if (anyAllow > 0) {
         const allow = await prisma.apDomainRule.findUnique({ where: { domain } }).catch(() => null);
         return !!allow && allow.mode === "ALLOW";
       }
       return true; // default open unless ALLOW list present or DENY specific
     }
     
     // naive in-memory rate-limit per domain (replace with Redis later)
     const rl = (globalThis as any).__ap_rl || ((globalThis as any).__ap_rl = new Map<string, {c:number,t:number}>());
     const RL_WINDOW_MS = 60_000;
     const RL_MAX = 200; // 200 activities/min/domain
     function rateLimitOk(domain: string) {
       const now = Date.now();
       const entry = rl.get(domain) || { c: 0, t: now };
       if (now - entry.t > RL_WINDOW_MS) { entry.c = 0; entry.t = now; }
       entry.c++  ;
       rl.set(domain, entry);
       return entry.c <= RL_MAX;
     }
     

export async function POST(req: NextRequest, { params }: { params: { handle: string } }) {
  try {
    const origin = getOrigin(req);
    const handle = params.handle;

    const user = await prisma.user.findFirst({
      where: { username: handle },
      select: { id: true, username: true, name: true },
    });
    if (!user) return asJsonResponse({ error: "no such user" }, { status: 404 });

    const bodyText = await req.text();
    let activity: any = null;
    try {
      activity = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      return asJsonResponse({ error: "invalid JSON" }, { status: 400 });
    }

        // Domain guard + rate-limit
    const actorHost = domainOf(activity?.actor || "");
    if (!(await isDomainAllowed(actorHost))) {
      return asJsonResponse({ error: "domain denied" }, { status: 403 });
    }
    if (!rateLimitOk(actorHost)) {
      return asJsonResponse({ error: "rate limit" }, { status: 429 });
    }


    // Optional signature verification (won’t block in MVP)
    try {
      const sigHeader = req.headers.get("signature");
      if (sigHeader && activity?.actor) {
        const parsed = parseSignatureHeader(sigHeader);
        const headerList = (parsed.headers || "").split(/\s+/).filter(Boolean);
        const keyId = parsed.keyId;
        const signature = parsed.signature;

        let publicKeyPem = "";
        if (keyId) {
          try {
            const keyDoc = await fetch(keyId, { headers: { accept: "application/activity+json" } });
            if (keyDoc.ok) {
              const kd = await keyDoc.json();
              publicKeyPem = kd?.publicKeyPem || kd?.publicKey?.publicKeyPem || "";
            }
          } catch {}
        }
        if (!publicKeyPem) {
          const doc = await fetchRemoteActor(activity.actor);
          publicKeyPem = doc?.publicKey?.publicKeyPem || "";
        }
        if (publicKeyPem && signature && headerList.length) {
          const ok = verifySignature({
            method: req.method,
            url: new URL(req.url),
            headers: Object.fromEntries(req.headers.entries()),
            body: bodyText,
            publicKeyPem,
            headerList,
            signatureB64: signature,
          });
          if (!ok) {
                        console.warn("[ap] signature verify failed for", activity?.actor);
                        if (process.env.AP_REQUIRE_SIGNATURES === "true") {
                          return asJsonResponse({ error: "signature required" }, { status: 401 });
                        }
                      }
        }
      }
    } catch (e) {
      console.warn("[ap] signature verification error", e);
      if (process.env.AP_REQUIRE_SIGNATURES === "true") {
           return asJsonResponse({ error: "signature required" }, { status: 401 });
      }
    }

    // Minimal activity handling
    switch (activity?.type) {
      case "Follow": {
        const actorId = actorIdFromHandle(origin, handle);

         // Persist remote actor & follower
         const remoteDoc = await fetchRemoteActor(activity.actor);
         const remote = await prisma.apRemoteActor.upsert({
           where: { url: activity.actor },
           update: {
             inbox: remoteDoc?.inbox ?? undefined,
             sharedInbox: remoteDoc?.endpoints?.sharedInbox ?? undefined,
             preferredUsername: remoteDoc?.preferredUsername ?? undefined,
             domain: (() => { try { return new URL(activity.actor).host } catch { return undefined } })(),
             publicKeyPem: remoteDoc?.publicKey?.publicKeyPem ?? undefined,
             lastSeen: new Date(),
           },
           create: {
             url: activity.actor,
             inbox: remoteDoc?.inbox ?? null,
             sharedInbox: remoteDoc?.endpoints?.sharedInbox ?? null,
             preferredUsername: remoteDoc?.preferredUsername ?? null,
             domain: (() => { try { return new URL(activity.actor).host } catch { return null } })(),
             publicKeyPem: remoteDoc?.publicKey?.publicKeyPem ?? null,
             lastSeen: new Date(),
           },
           select: { id: true, inbox: true, sharedInbox: true },
         });
         await prisma.apFollower.upsert({
           where: { user_id_remote_actor_id: { user_id: user.id, remote_actor_id: remote.id } },
           update: { state: "ACCEPTED", accepted_at: new Date() },
           create: { user_id: user.id, remote_actor_id: remote.id, state: "ACCEPTED", accepted_at: new Date() },
         });
 
         // Best-effort Accept back to follower
         const inbox = remote.sharedInbox || remote.inbox;
        if (inbox) {
          const accept = {
            "@context": "https://www.w3.org/ns/activitystreams",
            id: `${actorId}/activities/${randomUUID()}`,
            type: "Accept",
            actor: actorId,
            object: {
              type: "Follow",
              actor: activity.actor,
              object: actorId,
            },
          };
          try {
            const key = await getOrCreateApKey(user.id);
            const keyId = `${actorId}#main-key`;
            await deliverActivity({ toInbox: inbox, activity: accept, keyId, privateKeyPem: key.private_pem });
          } catch (e) {
            console.warn("[ap] accept delivery failed", e);
          }
        } else {
          console.warn("[ap] no remote inbox found for", activity?.actor);
        }

        // Always 202 on Follow in MVP
        return asJsonResponse({ status: "accepted" }, { status: 202 });
      }
             case "Accept": {
                 // Accept of our Follow: object is the Follow we sent
                 // object.actor should be our local actor; Accept.actor is remote
                 const localActor = activity?.object?.actor;
                 const remoteActor = activity?.actor;
                 if (typeof localActor === "string" && typeof remoteActor === "string") {
                   // Check that localActor matches this handle
                   const expected = actorIdFromHandle(origin, handle);
                   if (localActor === expected) {
                     // mark ApFollowing as ACCEPTED
                     const remote = await prisma.apRemoteActor.upsert({
                       where: { url: remoteActor },
                       update: { lastSeen: new Date() },
                       create: {
                         url: remoteActor,
                         domain: domainOf(remoteActor) || null,
                         lastSeen: new Date(),
                       },
                       select: { id: true },
                     });
                     await prisma.apFollowing.updateMany({
                       where: { user_id: user.id, remote_actor_id: remote.id },
                       data: { state: "ACCEPTED", accepted_at: new Date() },
                     });
                   }
                 }
                 return asJsonResponse({ status: "ok" }, { status: 202 });
               }
      case "Undo": {
        return asJsonResponse({ status: "ok" }, { status: 202 });
      }

      case "Create": {
        // Store activity.object Note/Article later; for now just 202
        return asJsonResponse({ status: "ok" }, { status: 202 });
      }

      default: {
        return asJsonResponse({ status: "ignored" }, { status: 202 });
      }
    }
  } catch (e) {
    console.error("[ap/inbox] 500", e);
    return asJsonResponse({ error: "internal" }, { status: 500 });
  }
}
