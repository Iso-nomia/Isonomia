 import { NextRequest } from "next/server";
 import { prisma } from "@/lib/prismaclient";
 import { asJsonResponse, getOrigin } from "@/lib/activitypub/base";
 
 export const runtime = "nodejs";
 
 export async function GET(req: NextRequest, { params }: { params: { handle: string } }) {
   const origin = getOrigin(req);
   const handle = params.handle;
   const base = `${origin}/users/${encodeURIComponent(handle)}/followers`;
   const url = new URL(req.url);
   const page = url.searchParams.get("page");
 
   const user = await prisma.user.findFirst({
     where: { username: handle },
     select: { id: true },
   });
   if (!user) return asJsonResponse({ error: "not found" }, { status: 404 });
 
   if (!page) {
     const total = await prisma.apFollower.count({
       where: { user_id: user.id, state: "ACCEPTED" },
     });
     const oc = {
       "@context": "https://www.w3.org/ns/activitystreams",
       id: base,
       type: "OrderedCollection",
       totalItems: total,
       first: `${base}?page=true`,
     };
     return asJsonResponse(oc);
   }
 
   // Simple one-page listing of actor IRIs
   const rows = await prisma.apFollower.findMany({
     where: { user_id: user.id, state: "ACCEPTED" },
     select: { remote: { select: { url: true } } },
     take: 500,
   });
   const items = rows.map((r) => r.remote.url);
 
   const pageDoc = {
     "@context": "https://www.w3.org/ns/activitystreams",
     id: `${base}?page=true`,
     type: "OrderedCollectionPage",
     partOf: base,
     orderedItems: items,
   };
   return asJsonResponse(pageDoc);
 }