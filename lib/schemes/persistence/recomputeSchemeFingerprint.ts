/**
 * Spec 4 phase 4a — Phase 2 step 9 helper.
 *
 * Recomputes and persists `ArgumentScheme.fingerprint` for a single row by
 * reading the row + its `CriticalQuestion` children and feeding them through
 * `computeBehaviourFingerprint`.
 *
 * Call this from any write path that mutates a row's behaviour-domain
 * fields (CQ set, premises, conclusion, epistemicMode). It is idempotent —
 * if the value already matches, the row is left untouched.
 *
 * Returns the new fingerprint (or `null` if the row no longer exists).
 */

import { prisma } from "@/lib/prismaclient";
import { computeBehaviourFingerprint } from "@/lib/schemes/verifier";

export async function recomputeSchemeFingerprint(
  schemeId: string,
): Promise<string | null> {
  const row = await prisma.argumentScheme.findUnique({
    where: { id: schemeId },
    include: { cqs: true },
  });
  if (!row) return null;
  const fp = computeBehaviourFingerprint(row as any);
  if ((row as any).fingerprint !== fp) {
    await prisma.argumentScheme.update({
      where: { id: schemeId },
      data: { fingerprint: fp } as any,
    });
  }
  return fp;
}
