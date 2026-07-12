import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import { getCurrentAuthor } from "../../../../lib/auth";
import { extractPlainText } from "../../../../lib/extract-plain-text";

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

const PatchEntrySchema = z
  .object({
    body: z.unknown().optional(),
    genre: z.enum(GENRES).optional(),
    threadId: z.string().nullish(),
    sourceId: z.string().nullish(),
    locator: z.string().trim().nullish(),
    changeType: z
      .enum(["REVISED", "REFINED", "CORRECTED", "RECLASSIFIED"])
      .optional(),
    changeNote: z.string().nullish(),
    // Explicit-commit control (used by the poem workflow):
    //   true  → force a new committed version (a revision the author chose to keep)
    //   false → save the working draft only, no version
    //   omit  → legacy behaviour: snapshot whenever content changed
    commit: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.body !== undefined ||
      v.genre !== undefined ||
      v.threadId !== undefined ||
      v.sourceId !== undefined ||
      v.locator !== undefined,
    { message: "at_least_one_field_required" },
  );

export async function GET(
  _request: Request,
  { params }: { params: { entryId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const entry = await prisma.entry.findFirst({
    where: { id: params.entryId, authorId: ctx.author.id },
    include: {
      thread: { select: { id: true, name: true } },
      source: {
        select: {
          id: true,
          title: true,
          author: true,
          year: true,
          url: true,
        },
      },
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          changeType: true,
          changeNote: true,
          createdAt: true,
        },
      },
    },
  });

  if (!entry) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function PATCH(
  request: Request,
  { params }: { params: { entryId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = PatchEntrySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.entry.findFirst({
    where: { id: params.entryId, authorId: ctx.author.id },
  });
  if (!existing)
    return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { body, genre, threadId, sourceId, locator, changeNote, commit } =
    parsed.data;

  const newBody = body !== undefined ? (body as object) : (existing.body as object);
  const newGenre = genre ?? existing.genre;
  const plainText =
    body !== undefined ? extractPlainText(body) : existing.plainText;

  // Decide changeType: explicit > genre-change > body-change > metadata-only.
  const inferredChangeType =
    parsed.data.changeType ??
    (genre && genre !== existing.genre
      ? "RECLASSIFIED"
      : body !== undefined
        ? "REVISED"
        : "REFINED");

  const entry = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updated = await tx.entry.update({
      where: { id: existing.id },
      data: {
        body: newBody,
        plainText,
        genre: newGenre,
        ...(threadId !== undefined ? { threadId: threadId ?? null } : {}),
        ...(sourceId !== undefined ? { sourceId: sourceId ?? null } : {}),
        ...(locator !== undefined ? { locator: locator ?? null } : {}),
      },
    });

    // Snapshot a new version when content or genre changed.
    const contentChanged = body !== undefined || (genre && genre !== existing.genre);
    // Explicit commit overrides the automatic rule: `commit === true` always
    // records a version, `commit === false` never does (a plain draft save).
    const shouldSnapshot =
      commit === true ? true : commit === false ? false : Boolean(contentChanged);
    if (shouldSnapshot) {
      const lastVersion = await tx.entryVersion.findFirst({
        where: { entryId: existing.id },
        orderBy: { versionNumber: "desc" },
        select: { id: true, versionNumber: true },
      });

      await tx.entryVersion.create({
        data: {
          entryId: existing.id,
          versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
          body: newBody,
          plainText,
          genre: newGenre,
          changeType: inferredChangeType,
          changeNote: changeNote ?? null,
          previousId: lastVersion?.id ?? null,
        },
      });
    }

    return updated;
  });

  return NextResponse.json({ entry });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { entryId: string } },
) {
  const ctx = await getCurrentAuthor();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await prisma.entry.deleteMany({
    where: { id: params.entryId, authorId: ctx.author.id },
  });

  if (result.count === 0)
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
