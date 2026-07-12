export const dynamic = "force-dynamic";


 import { NextRequest, NextResponse } from "next/server";
 import { z } from "zod";
 import { prisma } from "@/lib/prismaclient";
 import { getUserFromCookies } from "@/lib/serverutils";
 
 const paramsSchema = z.object({ id: z.coerce.bigint() });
 
 export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
   const user = await getUserFromCookies();
   if (!user?.userId) return new NextResponse("Unauthorized", { status: 401 });
 
   const { id } = paramsSchema.parse({ id: ctx.params.id });
 
   await prisma.notification.deleteMany({
     where: { id, user_id: user.userId },
   });
 
   return NextResponse.json({ status: "ok" });
 }
