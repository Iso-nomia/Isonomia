export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { placeTrade } from "@/packages/server/src/prediction/service";
import { getUserFromCookies } from "@/lib/serverutils";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { z } from "zod";

const redisRest = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const ratelimit = new Ratelimit({
  redis: redisRest,
  limiter: Ratelimit.fixedWindow(10, "1 m"),
});

const schema = z.object({
  side: z.enum(["YES","NO"]),
  spendCents: z.number().int().positive().max(1_000_000), // optional cap
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
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
  if (!user.userId){return;}
  const { success } = await ratelimit.limit(user.userId.toString());
  if (!success) return new NextResponse("Too Many", { status: 429 });
  const { spendCents, side } = parsed.data;
  const result = await placeTrade({
    marketId: params.id,
    userId: user.userId!,
    spendCents,
    side,
  });
  return NextResponse.json(result);
}
