import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthor } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";

/**
 * /api/entries/[entryId]/links
 *
 * Cross-references between entries owned by the current author.
 * Both endpoints scope by authorship: an entry's links are visible
 * only to its author, and a link can only be created between two
 * entries the author owns. Self-links (fromId === toId) are refused.
 */

const LINK_TYPES = [
  "REFERENCE",
  "DEVELOPS",
  "RESPONDS_TO",
  "CONTRADICTS",
  "SHARED_SOURCE",
] as const;

const LINK_INCLUDE = {
  id: true,
  type: true,
  note: true,
  createdAt: true,
} as const;

const ENTRY_SUMMARY = {
  id: true,
  genre: true,
  plainText: true,
  createdAt: true,
  thread: { select: { id: true, name: true } },
} as const;

export async function GET(
  _request: Request,
  { params }: { params: { entryId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Visibility: the entry itself must belong to the author.
  const entry = await prisma.entry.findFirst({
    where: { id: params.entryId, authorId: ctx.author.id },
    select: { id: true },
  });
  if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [outgoing, incoming] = await Promise.all([
    prisma.entryLink.findMany({
      where: { fromId: entry.id },
      orderBy: { createdAt: "desc" },
      select: { ...LINK_INCLUDE, to: { select: ENTRY_SUMMARY } },
    }),
    prisma.entryLink.findMany({
      where: { toId: entry.id },
      orderBy: { createdAt: "desc" },
      select: { ...LINK_INCLUDE, from: { select: ENTRY_SUMMARY } },
    }),
  ]);

  return NextResponse.json({ outgoing, incoming });
}

const CreateLinkSchema = z.object({
  toId: z.string().min(1),
  type: z.enum(LINK_TYPES).default("REFERENCE"),
  note: z.string().trim().nullish(),
});

export async function POST(
  request: Request,
  { params }: { params: { entryId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = CreateLinkSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );

  const { toId, type, note } = parsed.data;

  if (toId === params.entryId)
    return NextResponse.json({ error: "self_link" }, { status: 400 });

  // Both endpoints must belong to the current author. One query
  // covering both ids keeps it cheap.
  const owned = await prisma.entry.findMany({
    where: {
      id: { in: [params.entryId, toId] },
      authorId: ctx.author.id,
    },
    select: { id: true },
  });
  if (owned.length !== 2)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const link = await prisma.entryLink.create({
      data: {
        fromId: params.entryId,
        toId,
        type,
        note: note ?? null,
      },
      select: { ...LINK_INCLUDE, to: { select: ENTRY_SUMMARY } },
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch (err: unknown) {
    // P2002: the (fromId, toId, type) unique constraint already exists.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "duplicate_link" }, { status: 409 });
    }
    throw err;
  }
}
