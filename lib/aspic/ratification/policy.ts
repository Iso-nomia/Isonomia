/**
 * Attack-ratification policy resolution.
 * See docs/ATTACK_RATIFICATION_DEV_SPEC.md §3.1 (decision D1).
 *
 * Policy is resolved ON-DEMAND: an explicit `DeliberationPref.attackRatificationPolicy`
 * wins; otherwise the default is derived from the deliberation's `hostType`
 * (`free` = the personal Quick-Argument on-ramp → no gating; everything else →
 * one non-author sign-off). Resolving from `hostType` here means the policy
 * needs no seeding at any deliberation-create site.
 */
import { prisma } from "@/lib/prismaclient";

export type RatificationPolicy =
  | { kind: "none" }
  | { kind: "single" }
  | { kind: "quorum"; n: number };

/** Parse a stored policy string ("none" | "single" | "quorum:N"). null if unrecognised. */
export function parseRatificationPolicy(
  raw: string | null | undefined,
): RatificationPolicy | null {
  if (!raw) return null;
  if (raw === "none") return { kind: "none" };
  if (raw === "single") return { kind: "single" };
  const m = /^quorum:(\d+)$/.exec(raw);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1) return { kind: "quorum", n };
  }
  return null;
}

/** Minimum live, non-author sign-offs for a CA to become EFFECTIVE. */
export function ratificationThreshold(p: RatificationPolicy): number {
  return p.kind === "none" ? 0 : p.kind === "single" ? 1 : p.n;
}

/**
 * Resolve the effective ratification policy for a deliberation. Explicit
 * `DeliberationPref` value wins; otherwise derive the default from `hostType`.
 */
export async function resolveRatificationPolicy(
  deliberationId: string,
): Promise<RatificationPolicy> {
  const pref = await prisma.deliberationPref.findUnique({
    where: { deliberationId },
    select: { attackRatificationPolicy: true },
  });
  const explicit = parseRatificationPolicy(pref?.attackRatificationPolicy);
  if (explicit) return explicit;

  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { hostType: true },
  });
  return delib?.hostType === "free" ? { kind: "none" } : { kind: "single" };
}
