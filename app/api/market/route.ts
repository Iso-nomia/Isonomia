import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { z } from "zod";
export const runtime = "nodejs";
// import { CreateMarketArgs } from "@/lib/actions/prediction.actions";
// import { createMarket } from "@/lib/actions/prediction.actions";

import { createMarket } from "@/lib/actions/prediction.actions";
import type { CreateMarketArgs } from "@/lib/actions/prediction.actions";


const schema = z.object({
  question: z.string().min(1),
  closesAt: z.string(),
  b: z.number().optional(),
});


// export async function POST(req: NextRequest) {
//   const user = await getUserFromCookies();
//   if (!user) return new NextResponse("Unauthorized", { status: 401 });
//   const body = await req.json().catch(() => ({}));
//   const parsed = schema.safeParse(body);
//   if (!parsed.success) {
//     return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
//   }
//   const { question, closesAt, b } = parsed.data;
//   const post = await prisma.feedPost.create({
//     data: { author_id: user.userId!, type: "PREDICTION", isPublic: true },
//   });
//   const market = await prisma.predictionMarket.create({
//     data: {
//       postId: post.id,
//       question,
//       closesAt: new Date(closesAt),
//       b: b ?? 100,
//       creatorId: user.userId!,
//     },
//   });
//   return NextResponse.json({ marketId: market.id });
// }

export async function POST(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { question, closesAt, b: liquidity } = parsed.data;
  const { postId } = await createMarket({
        question,
        closesAt,
        liquidity: liquidity ?? 100,   // ✅ ALWAYS numeric
      } satisfies CreateMarketArgs);

      return NextResponse.json({ postId }); // keep response shape
}

