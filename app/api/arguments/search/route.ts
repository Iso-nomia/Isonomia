export const dynamic = "force-dynamic";

// app/api/arguments/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";

export async function GET(req: NextRequest) {
  const deliberationId = req.nextUrl.searchParams.get("deliberationId") ?? "";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  
  if (!deliberationId) {
    return NextResponse.json({ ok: true, arguments: [] });
  }

  const foundArguments = await prisma.argument.findMany({
    where: {
      deliberationId,
      ...(q ? { text: { contains: q, mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      text: true,
      schemeId: true,
      scheme: {
        select: {
          key: true,
          name: true,
        },
      },
      conclusion: {
        select: {
          id: true,
          text: true,
        },
      },
      premises: {
        select: {
          claim: {
            select: {
              id: true,
              text: true,
            },
          },
        },
      },
    },
    take: 50,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, arguments: foundArguments });
}
