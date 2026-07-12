import { NextResponse } from "next/server";
import { getCurrentAuthor } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

const GENRES = new Set([
  "FRAGMENT",
  "EXCERPT",
  "OBSERVATION",
  "MEDITATION",
  "DIALOGUE",
  "LETTER",
  "LIST",
  "POEM",
]);

export async function GET(request: Request) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const genreParam = (searchParams.get("genre") ?? "").toUpperCase();
  const threadId = searchParams.get("threadId");
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "30", 10) || 30, 1),
    100,
  );

  if (!q) return NextResponse.json({ entries: [] });

  const entries = await prisma.entry.findMany({
    where: {
      authorId: ctx.author.id,
      plainText: { contains: q, mode: "insensitive" },
      ...(GENRES.has(genreParam) ? { genre: genreParam as never } : {}),
      ...(threadId ? { threadId } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      genre: true,
      plainText: true,
      createdAt: true,
      updatedAt: true,
      thread: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ entries });
}
