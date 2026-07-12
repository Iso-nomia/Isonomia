import { prisma } from "@/lib/prismaclient";
import { priceYes, calcSharesForSpend } from "@/lib/prediction/lmsr";

export interface PlaceTradeArgs {
  marketId: string;
  userId: bigint;
  spendCents: number;
  side: "YES" | "NO";
}

export interface PlaceTradeResult {
  shares: number;
  newYesProb: number;
}

export async function placeTrade({ marketId, userId, spendCents, side }: PlaceTradeArgs): Promise<PlaceTradeResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT lock_wallet(${userId})`;

    const market = await tx.predictionMarket.findUniqueOrThrow({ where: { id: marketId } });
    if (market.state !== "OPEN") throw new Error("Market closed");

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balanceCents - wallet.lockedCents < spendCents) {
      throw new Error("Insufficient funds");
    }

    const { deltaQ, cost } = calcSharesForSpend({
      yesPool: market.yesPool,
      noPool: market.noPool,
      b: market.b,
      spend: spendCents,
      side,
    });

    if (cost > wallet.balanceCents - wallet.lockedCents) {
      throw new Error("Insufficient funds");
    }

    const trade = await tx.trade.create({
      data: {
        marketId,
        userId,
        side,
        shares: deltaQ,
        cost,
        price: cost / deltaQ,
      },
    });

    await tx.notification.create({
      data: {
        user_id: userId,
        actor_id: userId,
        type: "TRADE_EXECUTED",
        market_id: marketId,
        trade_id: trade.id,
      },
    });

    await tx.wallet.update({
      where: { userId },
      data: { balanceCents: { decrement: cost } },
    });

    const poolMutation =
      side === "YES" ? { yesPool: { increment: deltaQ } } : { noPool: { increment: deltaQ } };
    const updated = await tx.predictionMarket.update({ where: { id: marketId }, data: poolMutation });
    const newYesProb = priceYes(updated.yesPool, updated.noPool, updated.b);
    return { shares: deltaQ, newYesProb };
  });
}

export interface ResolveMarketArgs {
  marketId: string;
  outcome: "YES" | "NO";
  resolverId: bigint;
}

export interface ResolveMarketResult {
  payouts: number;
  totalPaid: number;
}

export async function resolveMarket({ marketId, outcome, resolverId }: ResolveMarketArgs): Promise<ResolveMarketResult> {
  return prisma.$transaction(async (tx) => {
    const market = await tx.predictionMarket.findUniqueOrThrow({ where: { id: marketId } });

    if (market.state === "RESOLVED") throw new Error("Already resolved");
    if (market.creatorId !== resolverId && market.oracleId !== resolverId) {
      throw new Error("Not authorized");
    }

    const trades = await tx.trade.findMany({ where: { marketId } });

    let payouts = 0;
    let totalPaid = 0;
    for (const trade of trades) {
      if (trade.side === outcome) {
        const amount = Math.floor(trade.shares);
        await tx.$executeRaw`SELECT lock_wallet(${trade.userId})`;
        await tx.wallet.update({ where: { userId: trade.userId }, data: { balanceCents: { increment: amount } } });
        payouts++;
        totalPaid += amount;
      }
    }

    await tx.predictionMarket.update({
      where: { id: marketId },
      data: { state: "RESOLVED", outcome, resolvesAt: new Date() },
    });

    await tx.resolutionLog.create({ data: { marketId, resolverId, outcome } });

    const participants = await tx.trade.findMany({
      where: { marketId },
      select: { userId: true },
      distinct: ["userId"],
    });

    await tx.notification.createMany({
      data: participants.map((p) => ({
        user_id: p.userId,
        actor_id: resolverId,
        type: "MARKET_RESOLVED",
        market_id: marketId,
      })),
    });

    return { payouts, totalPaid };
  });
}
