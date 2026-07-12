import { NextRequest } from "next/server";
import { asJsonResponse, getOrigin } from "@/lib/activitypub/base";
import { prisma } from "@/lib/prismaclient";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { handle: string } }) {
  const origin = getOrigin(req);
  const base = `${origin}/users/${encodeURIComponent(params.handle)}/outbox`;
  const url = new URL(req.url);
  const page = url.searchParams.get("page");

  if (page) {

         const user = await prisma.user.findFirst({
           where: { username: params.handle },
           select: { id: true },
         });
         if (!user) return asJsonResponse({ error: "not found" }, { status: 404 });
         const rows = await prisma.apOutboxActivity.findMany({
           where: { actor_user_id: user.id },
           orderBy: { created_at: "desc" },
           take: 20,
           select: { activity_json: true },
         });
         return asJsonResponse({
           "@context": "https://www.w3.org/ns/activitystreams",
           id: `${base}?page=true`,
           type: "OrderedCollectionPage",
           partOf: base,
           orderedItems: rows.map(r => r.activity_json),
         });
       }

 // top-level OrderedCollection with total count and first page link
    const user = await prisma.user.findFirst({
         where: { username: params.handle },
         select: { id: true },
       });
       if (!user) return asJsonResponse({ error: "not found" }, { status: 404 });
       const total = await prisma.apOutboxActivity.count({ where: { actor_user_id: user.id } });
    
         const oc = {
         "@context": "https://www.w3.org/ns/activitystreams",
         id: base,
         type: "OrderedCollection",
        totalItems: total,
         first: `${base}?page=true`,
       };
       return asJsonResponse(oc);
     }