/**
 * lib/deliberations/visibility.ts
 *
 * Read-visibility enforcement for `Deliberation.visibility`
 * (docs/DELIBERATION_CREATION_DEV_SPEC.md §5/§10 — "the one step with leak
 * risk; land last, audited").
 *
 * Three visibility values, two distinct surfaces:
 *
 *   - LIST / FEED / SEARCH surfaces (Agora feed, explore, search): only
 *     `public` deliberations are surfaced to the world. `unlisted` and
 *     `private` are surfaced ONLY to members (the creator or a role holder).
 *     Use `listableDeliberationWhere` / `filterVisibleDeliberationIds`.
 *
 *   - DIRECT-FETCH surfaces (open a deliberation by id): `public` and
 *     `unlisted` (link-only) are readable by anyone; `private` only by members.
 *     Use `canReadDeliberation`.
 *
 * Membership is keyed on the stringified internal `User.id` (matching
 * `Deliberation.createdById` and `DeliberationRole.userId`). Callers holding a
 * `bigint` id from `getCurrentUserId()` should pass it through `normalizeUserId`.
 *
 * NOTE (scope): per spec §1 this enforces the list/feed/search enumeration
 * surfaces and the canonical direct-content read. Per-feature nested
 * `/api/deliberations/[id]/*` reader gating is deferred ("enforce incrementally").
 */

import { prisma } from "@/lib/prismaclient";
import type { Prisma } from "@prisma/client";

/** Coerce a `getCurrentUserId()` result (bigint | null) to the membership key. */
export function normalizeUserId(
  id: bigint | string | null | undefined,
): string | null {
  return id == null ? null : String(id);
}

/**
 * Prisma `where` fragment selecting deliberations that may be SURFACED in a
 * list / feed / search for `userId`:
 *   - anyone: `public`
 *   - the signed-in user additionally: ones they created or hold a role on
 *     (covers their own `unlisted`/`private`).
 *
 * Compose with `AND` alongside any existing filter, e.g.
 *   where: { AND: [existingWhere, listableDeliberationWhere(uid)] }
 */
export function listableDeliberationWhere(
  userId: string | null,
): Prisma.DeliberationWhereInput {
  if (!userId) return { visibility: "public" };
  return {
    OR: [
      { visibility: "public" },
      { createdById: userId },
      { roles: { some: { userId } } },
    ],
  };
}

/**
 * Given a set of deliberation ids (e.g. ids referenced by feed events), return
 * the subset that is listable to `userId`. One query, deduped input.
 */
export async function filterVisibleDeliberationIds(
  ids: Array<string | null | undefined>,
  userId: string | null,
): Promise<Set<string>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return new Set();
  const rows = await prisma.deliberation.findMany({
    where: { AND: [{ id: { in: unique } }, listableDeliberationWhere(userId)] },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

/**
 * Direct-fetch read gate. `public`/`unlisted` are readable by anyone (unlisted
 * is link-only, not enumerable); `private` only by the creator or a role
 * holder. Returns false for a missing deliberation. Never throws.
 */
export async function canReadDeliberation(
  deliberationId: string,
  userId: string | null,
): Promise<boolean> {
  const d = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { visibility: true, createdById: true },
  });
  if (!d) return false;
  if (d.visibility !== "private") return true;
  if (!userId) return false;
  if (d.createdById === userId) return true;
  const role = await prisma.deliberationRole.findFirst({
    where: { deliberationId, userId },
    select: { id: true },
  });
  return !!role;
}
