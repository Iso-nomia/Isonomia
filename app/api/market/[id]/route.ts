import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { serializeBigInt } from "@/lib/utils";
import { priceYes } from "@/lib/prediction/lmsr";
import { getUserFromCookies } from "@/lib/serverutils";

/** ISR‑style cache: one minute */
export const dynamic = "force-dynamic";   // always fresh

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  /* ──────────────────── 1 • Validate ID format up front ──────────────────── */
  if (!/^[a-z0-9]{24,32}$/i.test(params.id)) {
    return new NextResponse("Invalid id", { status: 400 });
  }

  /* ──────────────────── 2 • Fetch minimal market snapshot ────────────────── */
  const market = await prisma.predictionMarket.findUnique({
    where: { id: params.id },
    // select: {
    //   // public fields
    //   id: true,
    //   question: true,
    //   closesAt: true,
    //   state: true,
    //   outcome: true,

    //   // liquidity & pricing
    //   yesPool: true,
    //   noPool: true,
    //   b: true,

    //   // needed only to compute canResolve (not returned)
    //   creatorId: true,
    //   oracleId: true,
    // },
  });

  if (!market) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  /* ──────────────────── 3 • Derive price and canResolve ──────────────────── */
  const price = priceYes(market.yesPool, market.noPool, market.b);

  let canResolve = false;
  if (market.state === "CLOSED") {
    const user = await getUserFromCookies().catch(() => null);
    canResolve =
      !!user &&
      (user.userId === market.creatorId || user.userId === market.oracleId);
  }

  /* ──────────────────── 4 • Prepare payload (no duplicate pools) ─────────── */
  // Strip creator/oracle IDs so the client only receives public data
  const {
    creatorId: _c,
    oracleId: _o,
    ...publicMarket
  } = market;

  return NextResponse.json(
    serializeBigInt({
      market: publicMarket,
      price,
      canResolve,
    }),
    { headers: { "Cache-Control": "no-store" } },
  );
}
