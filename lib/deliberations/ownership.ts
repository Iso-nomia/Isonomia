/**
 * lib/deliberations/ownership.ts
 *
 * Who is allowed to rename a deliberation?
 *
 * The deliberation's own `createdById` is NOT a reliable ownership signal for
 * host-bound deliberations: for an `article` host the deliberation row is
 * created lazily by whoever first *loads* the article page (see
 * `app/article/(by-key)/[key]/page.tsx` → `getOrCreateDeliberationId(..., userId ?? "system")`),
 * which may be a crawler, an anonymous visitor ("system"), or a reader — not
 * the article's author.
 *
 * So renaming authority is the union of:
 *   1. the deliberation creator (`createdById`), and
 *   2. the host object's owner (article author, discussion creator, …).
 *
 * All ids follow the stringified internal `User.id` convention used by
 * `article.authorId` and `deliberation.createdById`.
 *
 * This is intentionally a separate helper from `isDeliberationHost`
 * (lib/pathways/auth.ts), which gates facilitation/packet authority and must
 * stay narrowly scoped to `createdById`.
 */

import { prisma } from "@/lib/prismaclient";
import type { DeliberationHostType } from "@prisma/client";

export type DeliberationOwnershipInput = {
  createdById: string | null;
  hostType: DeliberationHostType;
  hostId: string;
};

/**
 * Resolve the host object's owner id for host types that have a single clear
 * owner. Returns `null` when the host type has no owner concept (e.g. `free`,
 * `site`) or the host row no longer exists.
 */
export async function resolveHostOwnerId(
  hostType: DeliberationHostType,
  hostId: string,
): Promise<string | null> {
  switch (hostType) {
    case "article": {
      const a = await prisma.article.findUnique({
        where: { id: hostId },
        select: { authorId: true },
      });
      return a?.authorId ?? null;
    }
    case "discussion": {
      const d = await prisma.discussion.findUnique({
        where: { id: hostId },
        select: { createdById: true },
      });
      return d?.createdById ?? null;
    }
    default:
      return null;
  }
}

/**
 * True when `userId` may rename this deliberation: either they created the
 * deliberation row, or they own the host object it is attached to.
 * Never throws; returns false for a null/empty user.
 */
export async function canRenameDeliberation(
  deliberation: DeliberationOwnershipInput,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const uid = String(userId);
  if (deliberation.createdById && deliberation.createdById === uid) return true;
  const ownerId = await resolveHostOwnerId(
    deliberation.hostType,
    deliberation.hostId,
  );
  return ownerId != null && ownerId === uid;
}
