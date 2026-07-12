import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { getCurrentAuthor } from "../../../lib/auth";
import { extractPlainText } from "../../../lib/extract-plain-text";

const GENRES = [
  "EXCERPT",
  "OBSERVATION",
  "MEDITATION",
  "DIALOGUE",
  "LETTER",
  "LIST",
  "FRAGMENT",
  "POEM",
] as const;

const CreateEntrySchema = z.object({
  body: z.unknown(),
  genre: z.enum(GENRES).default("FRAGMENT"),
  threadId: z.string().nullish(),
  sourceId: z.string().nullish(),
  locator: z.string().trim().nullish(),
});

export async function GET(request: Request) {
  const ctx = await getCurrentAuthor();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const threadId = url.searchParams.get("threadId");
  const genre = url.searchParams.get("genre");

  const entries = await prisma.entry.findMany({
    where: {
      authorId: ctx.author.id,
      ...(threadId ? { threadId } : {}),
      ...(genre && (GENRES as readonly string[]).includes(genre)
        ? { genre: genre as (typeof GENRES)[number] }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      genre: true,
      plainText: true,
      threadId: true,
      sourceId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ entries });
}

export async function POST(request: Request) {
  const ctx = await getCurrentAuthor();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = CreateEntrySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { body, genre, threadId, sourceId, locator } = parsed.data;
  const plainText = extractPlainText(body);

  const entry = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.entry.create({
      data: {
        body: body as object,
        plainText,
        genre,
        authorId: ctx.author.id,
        threadId: threadId ?? null,
        sourceId: sourceId ?? null,
        locator: locator ?? null,
      },
    });

    await tx.entryVersion.create({
      data: {
        entryId: created.id,
        versionNumber: 1,
        body: body as object,
        plainText,
        genre,
        changeType: "CREATED",
      },
    });

    return created;
  });

  return NextResponse.json({ entry }, { status: 201 });
}
