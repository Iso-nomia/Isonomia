import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import { getCurrentAuthor } from "../../../lib/auth";

const CreateSourceSchema = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim().nullish(),
  url: z.string().trim().url().nullish().or(z.literal("")),
  isbn: z.string().trim().nullish(),
  publisher: z.string().trim().nullish(),
  year: z.number().int().nullish(),
});

/**
 * GET /api/sources
 * List sources, ordered by recent use. Optional ?q= for prefix-match
 * on title or author (used by the SourcePicker autosuggest).
 */
export async function GET(request: Request) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  // Sources are scoped through entries (Source has no authorId in schema —
  // they're shared bibliographic records, but the picker should only show
  // sources the current author has actually used).
  const sources = await prisma.source.findMany({
    where: {
      entries: { some: { authorId: ctx.author.id } },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { author: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      author: true,
      year: true,
      _count: { select: { entries: true } },
    },
  });

  return NextResponse.json({ sources });
}

export async function POST(request: Request) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = CreateSourceSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const source = await prisma.source.create({
    data: {
      title: data.title,
      author: data.author ?? null,
      url: data.url || null,
      isbn: data.isbn ?? null,
      publisher: data.publisher ?? null,
      year: data.year ?? null,
    },
    select: { id: true, title: true, author: true, year: true },
  });

  return NextResponse.json({ source }, { status: 201 });
}
