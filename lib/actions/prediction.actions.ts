"use server";
import { prisma } from "../prismaclient";
import { costToBuy, priceYes } from "@/lib/prediction/lmsr";
import { getUserFromCookies } from "@/lib/serverutils";
import { serializeBigInt } from "@/lib/utils";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export interface CreateMarketArgs {
  question: string;
  closesAt: string;      // ISO datetime from the form
  liquidity?: number;    // optional, default handled below
}

export interface CreateMarketResult {
  postId: string;        // BigInt coming from PostgreSQL → JS bigint
}


export async function createMarket(
  { question, closesAt, liquidity = 100 }: CreateMarketArgs
): Promise<CreateMarketResult> {
  if (process.env.ENABLE_PREDICTION_MARKETS !== "true") {
    throw new Error("Prediction markets are disabled");
  }
  const user = await getUserFromCookies();
  if (!user) throw new Error("Not authenticated");


  // 1. Create realtime post shell
  const post = await prisma.realtimePost.create({
    data: {
      author_id: user.userId!,
      x_coordinate: new Prisma.Decimal(0),
      y_coordinate: new Prisma.Decimal(0),
      type: "PREDICTION",
      realtime_room_id: "global",
      locked: false,
    },
  });

  // 1. Create the feed post shell
  const feed = await prisma.feedPost.create({
    data: {
      author_id: user.userId!,
      type: "PREDICTION",
      isPublic: true,
    },
  });

  // 2. Create the market referencing that feed row
  const market = await prisma.predictionMarket.create({
    data: {
      postId: feed.id,
      question,
      closesAt: new Date(closesAt),
      b: liquidity,
      creatorId: user.userId!,
    },
  });

  // // 3. Store serialised market JSON in the post content
  // await prisma.realtimePost.update({
  //   where: { id: post.id },
  //   data: {
  //     predictionMarket: { connect: { id: market.id } },
  //     content: JSON.stringify(serializeBigInt(market)),
  //   },
  // });
    // --- serialise for the feed ---
  // ① convert bigints → strings
  const payload = serializeBigInt(market) as any;
  // ② make closesAt an ISO string (e.g. "2025-07-31T21:00:00.000Z")
  payload.closesAt = market.closesAt.toISOString();

  await prisma.realtimePost.update({
    where: { id: post.id },
    data: {
      predictionMarket: { connect: { id: market.id } },
      content: JSON.stringify(payload),
    },
  });

   return { postId: post.id.toString() };
}

// export async function createMarket({ question, closesAt, liquidity }:{ question:string; closesAt:string; liquidity:number; }) {
//   const user = await getUserFromCookies();
//   if (!user) throw new Error("Not authenticated");

//   const post = await prisma.realtimePost.create({
//     data: {
//       author_id: user.userId!,
//       x_coordinate: new Prisma.Decimal(0),
//       y_coordinate: new Prisma.Decimal(0),
//       type: "PREDICTION",
//       realtime_room_id: "global",
//       locked: false,
//     },
//   });

//   const market = await prisma.predictionMarket.create({
//     data: {
//       postId: post.id,
//       question,
//       closesAt: new Date(closesAt),
//       b: liquidity,
//       creatorId: user.userId!,
//     },
//   });

//   await prisma.realtimePost.update({
//     where: { id: post.id },
//     data: {
//       predictionMarket: { connect: { id: market.id } },
//       content: JSON.stringify(serializeBigInt(market)),
//     },
//   });

//   // return { postId: post.id };
//   const { postId } = await createMarket(data); 
//   return NextResponse.json({ postId: postId.toString() });
// }

export async function tradeMarket({ marketId, side, credits }:{ marketId:string; side:"YES"|"NO"; credits:number; }) {
  if (process.env.ENABLE_PREDICTION_MARKETS !== "true") {
    throw new Error("Prediction markets are disabled");
  }
  const user = await getUserFromCookies();
  if (!user) throw new Error("Not authenticated");
  return await prisma.$transaction(async tx => {
    const market = await tx.predictionMarket.findUniqueOrThrow({ where:{ id: marketId } });
    if (market.state !== "OPEN") throw new Error("Market closed");

    let lo=0, hi=1000;
    for(let i=0;i<30;i++){
      const mid=(lo+hi)/2;
      const cost=costToBuy(side, mid, market.yesPool, market.noPool, market.b);
      cost>credits?hi=mid:lo=mid;
    }
    const shares=lo;
    const cost=Math.ceil(costToBuy(side, shares, market.yesPool, market.noPool, market.b));

    await tx.$executeRaw`SELECT lock_wallet(${user.userId})`;
    const wallet = await tx.wallet.findUnique({ where:{ userId: user.userId! } });
    if (!wallet || wallet.balanceCents - wallet.lockedCents < cost) {
      throw new Error("Insufficient credits");
    }

    await tx.wallet.update({ where:{ userId:user.userId! }, data:{ balanceCents: { decrement: cost } } });
    await tx.trade.create({ data:{ marketId, userId:user.userId!, side, shares, cost, price: cost/shares } });
    const data = side === "YES" ? { yesPool: { increment: shares } } : { noPool:{ increment: shares } };
    const updated = await tx.predictionMarket.update({ where:{ id: marketId }, data });

    const newPrice = priceYes(updated.yesPool, updated.noPool, updated.b);
    return { shares, cost, newPrice };
  });
}

export async function resolveMarket({ marketId, outcome }:{ marketId:string; outcome:"YES"|"NO"; }) {
  if (process.env.ENABLE_PREDICTION_MARKETS !== "true") {
    throw new Error("Prediction markets are disabled");
  }
  const user = await getUserFromCookies();
  if (!user) throw new Error("Not authenticated");
  const market = await prisma.predictionMarket.findUniqueOrThrow({ where:{ id: marketId } });
  if (market.creatorId !== user.userId && market.oracleId !== user.userId) {
    throw new Error("Not authorized");
  }
  if (market.state === "RESOLVED") {
    throw new Error("Already resolved");
  }
  if (market.state !== "CLOSED") {
    throw new Error("Market not closed");
  }

  return await prisma.$transaction(async tx => {
    const trades = await tx.trade.findMany({ where:{ marketId } });

    for (const trade of trades) {
      if (trade.side === outcome) {
        await tx.$executeRaw`SELECT lock_wallet(${trade.userId})`;
        await tx.wallet.update({ where:{ userId: trade.userId }, data:{ balanceCents: { increment: Math.floor(trade.shares) } } });
      }
    }

    await tx.resolutionLog.create({ data:{ marketId, resolverId: user.userId!, outcome } });

    await tx.predictionMarket.update({
      where:{ id: marketId },
      data:{ state:"RESOLVED", outcome, resolvesAt: new Date() }
    });
    return { ok:true };
  });
}
