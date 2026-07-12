import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getUserFromCookies } from "@/lib/serverutils";
import { serializeBigInt } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user) return NextResponse.json({ error: "not-auth" }, { status: 401 });

  const wallet = await prisma.wallet.findUnique({
    where: { userId: user.userId! },
    select: { balanceCents: true, lockedCents: true },
  });

  // If the row doesn’t exist yet, bootstrap it
  const data =
    wallet ??
    (await prisma.wallet.create({
      data: {
        userId: user.userId!,
        balanceCents: 10000,      // 100 credits starter balance
        lockedCents: 0,
      },
    }));
      // Cast BigInt → number *before* sending JSON
      return NextResponse.json({
        balanceCents: Number(data.balanceCents),
        lockedCents : Number(data.lockedCents),
      });
  // return NextResponse.json(serializeBigInt(data)); // BigInt → string
}
