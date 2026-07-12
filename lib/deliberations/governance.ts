/**
 * lib/deliberations/governance.ts
 *
 * Governance / moderator roles on a from-scratch deliberation
 * (docs/DELIBERATION_CREATION_DEV_SPEC.md §2.2).
 *
 * We do NOT add a new table or enum: `DeliberationRole.role` stays a free-text
 * string. This module documents the *reserved* governance values and provides a
 * typed authority check (`isModerator`) so callers stop hand-rolling role
 * string comparisons.
 *
 * Authority composes with — does not replace — the host-owner signal in
 * `lib/deliberations/ownership.ts`. For `free`/`site` hosts `resolveHostOwnerId`
 * returns null, so for from-scratch deliberations `createdById` is the sole
 * host-owner; moderators extend that authority.
 *
 * Convention: `userId` is the stringified internal `User.id`, matching
 * `Deliberation.createdById` and `DeliberationRole.userId`.
 */

import { prisma } from "@/lib/prismaclient";

/** Reserved governance role values (stored lower-case in `DeliberationRole.role`). */
export const DELIBERATION_GOVERNANCE_ROLES = {
  /** The from-scratch creator. Sole host-owner signal for `free` hosts. */
  OWNER: "owner",
  /** Governance capability (role management, moderator ratification policy). */
  MODERATOR: "moderator",
} as const;

export type DeliberationGovernanceRole =
  (typeof DELIBERATION_GOVERNANCE_ROLES)[keyof typeof DELIBERATION_GOVERNANCE_ROLES];

const MODERATOR_GRANTING_ROLES = new Set<string>([
  DELIBERATION_GOVERNANCE_ROLES.OWNER,
  DELIBERATION_GOVERNANCE_ROLES.MODERATOR,
]);

/**
 * True when `userId` holds governance authority on the deliberation: they are
 * the deliberation creator (`createdById`), or they hold an `owner`/`moderator`
 * `DeliberationRole`. Never throws; returns false for a null/empty user.
 */
export async function isModerator(
  deliberationId: string,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const uid = String(userId);

  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { createdById: true },
  });
  if (!delib) return false;
  if (delib.createdById === uid) return true;

  const rows = await prisma.deliberationRole.findMany({
    where: { deliberationId, userId: uid },
    select: { role: true },
  });
  return rows.some((r) => MODERATOR_GRANTING_ROLES.has(r.role.toLowerCase()));
}
