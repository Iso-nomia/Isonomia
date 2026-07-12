import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { getCurrentAuthor } from "../../../lib/auth";

const CreateThreadSchema = z.object({
  name: z.string().trim().min(1).max(200).nullish(),
  description: z.string().trim().max(2000).nullish(),
});

export async function GET() {
  const ctx = await getCurrentAuthor();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const threads = await prisma.thread.findMany({
    where: { authorId: ctx.author.id, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { entries: true } },
    },
  });

  return NextResponse.json({ threads });
}

export async function POST(request: Request) {
  const ctx = await getCurrentAuthor();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = CreateThreadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const thread = await prisma.thread.create({
    data: {
      name: parsed.data.name ?? null,
      description: parsed.data.description ?? null,
      authorId: ctx.author.id,
    },
  });

  return NextResponse.json({ thread }, { status: 201 });
}
