// lib/thesis/permissions.ts
//
// Living Thesis — Phase 7.2: thesis read/write permission helpers.
//
// All thesis reader endpoints (/live, /attacks, /confidence,
// /inspect/[kind]/[objectId], /focus, /backlinks, /snapshots GET, …) need
// the same gate:
//
//   • author of the thesis can always read drafts
//   • published theses are readable by any authed user (until the wider
//     audience model lands — see LIVING_THESIS_DEFERRED.md)
//   • drafts are also readable by any deliberation participant when the
//     thesis is scoped to a deliberation
//
// We deliberately *do not* lean on `packages/sheaf-acl` here: that package
// models per-message audience selectors, not deliberation membership. The
// roadmap mentions sheaf-acl in passing but the concrete implementation
// uses `lib/cqs/permissions.ts#isDeliberationParticipant`, which is the
// canonical participant check used elsewhere in the repo.

import { prisma } from "@/lib/prismaclient";
import { isDeliberationParticipant } from "@/lib/cqs/permissions";

export type ThesisReadDenialReason = "not_found" | "forbidden";

export interface ThesisReadHandle {
  id: string;
  authorId: string;
  status: string;
  deliberationId: string | null;
}

export interface ThesisReadOk {
  ok: true;
  thesis: ThesisReadHandle;
}

export interface ThesisReadDenied {
  ok: false;
  status: 404 | 403;
  reason: ThesisReadDenialReason;
  message: string;
}

export type ThesisReadResult = ThesisReadOk | ThesisReadDenied;

/**
 * Resolve a thesis and decide whether `authId` is allowed to read it.
 *
 * Returns a discriminated result so the caller can `return NextResponse.json(...)`
 * with the canonical 404/403 shape without duplicating the rules.
 */
export async function checkThesisReadable(
  authId: string | null | undefined,
  thesisId: string,
): Promise<ThesisReadResult> {
  if (!authId) {
    return {
      ok: false,
      status: 403,
      reason: "forbidden",
      message: "Unauthorized",
    };
  }

  const thesis = await prisma.thesis.findUnique({
    where: { id: thesisId },
    select: {
      id: true,
      authorId: true,
      status: true,
      deliberationId: true,
    },
  });

  if (!thesis) {
    return {
      ok: false,
      status: 404,
      reason: "not_found",
      message: "Thesis not found",
    };
  }

  if (thesis.authorId === authId) {
    return { ok: true, thesis };
  }

  if (thesis.status === "PUBLISHED") {
    return { ok: true, thesis };
  }

  if (thesis.deliberationId) {
    const isParticipant = await isDeliberationParticipant(
      authId,
      thesis.deliberationId,
    );
    if (isParticipant) return { ok: true, thesis };
  }

  return {
    ok: false,
    status: 403,
    reason: "forbidden",
    message: "You do not have permission to read this thesis",
  };
}

/**
 * Filter a list of theses to only those `authId` can read. Used by
 * endpoints that aggregate theses across the workspace (e.g. the
 * /api/objects/[kind]/[id]/backlinks endpoint) so unpublished drafts by
 * other authors do not leak through.
 */
export async function filterReadableTheses<
  T extends {
    id: string;
    authorId?: string | null;
    status?: string | null;
    deliberationId?: string | null;
  },
>(authId: string | null | undefined, theses: T[]): Promise<T[]> {
  if (!authId || theses.length === 0) return [];

  // Theses where only deliberation participation matters: collect unique
  // deliberation ids and resolve membership in parallel.
  const candidateDelibIds = new Set<string>();
  for (const t of theses) {
    if (t.authorId && t.authorId === authId) continue;
    if (t.status === "PUBLISHED") continue;
    if (t.deliberationId) candidateDelibIds.add(t.deliberationId);
  }

  const membership = new Map<string, boolean>();
  await Promise.all(
    Array.from(candidateDelibIds).map(async (delibId) => {
      const ok = await isDeliberationParticipant(authId, delibId);
      membership.set(delibId, ok);
    }),
  );

  return theses.filter((t) => {
    if (t.authorId && t.authorId === authId) return true;
    if (t.status === "PUBLISHED") return true;
    if (t.deliberationId) return membership.get(t.deliberationId) === true;
    return false;
  });
}

/**
 * Stricter variant for endpoints that mutate the thesis (snapshots POST,
 * publish, etc.). Only the author may write.
 */
export async function checkThesisWritable(
  authId: string | null | undefined,
  thesisId: string,
): Promise<ThesisReadResult> {
  if (!authId) {
    return {
      ok: false,
      status: 403,
      reason: "forbidden",
      message: "Unauthorized",
    };
  }

  const thesis = await prisma.thesis.findUnique({
    where: { id: thesisId },
    select: {
      id: true,
      authorId: true,
      status: true,
      deliberationId: true,
    },
  });

  if (!thesis) {
    return {
      ok: false,
      status: 404,
      reason: "not_found",
      message: "Thesis not found",
    };
  }

  if (thesis.authorId !== authId) {
    return {
      ok: false,
      status: 403,
      reason: "forbidden",
      message: "Only the author may modify this thesis",
    };
  }

  return { ok: true, thesis };
}
