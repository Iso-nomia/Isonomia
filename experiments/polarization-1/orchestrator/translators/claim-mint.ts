/**
 * orchestrator/translators/claim-mint.ts
 *
 * Premise-claim-minting helper. Per Stage-1 §4.2: `POST /api/arguments`
 * requires `premiseClaimIds[]` (NOT premise text), so any agent that emits
 * an argument with N premise sentences requires N Claim mints first.
 *
 * Because `mintClaimMoid` produces a stable hash from text, identical
 * premise text across agents/rounds collapses to the same Claim — when both
 * advocates assert "Adolescent depression rose post-2012," that's one
 * canonical claim both reference. We expose a small in-process registry
 * (`ClaimRegistry`) so a single phase doesn't re-POST the same text within
 * one round.
 */

import type { IsonomiaClient, IsonomiaCallContext } from "../isonomia-client";

export class ClaimRegistry {
  /** text → claimId. Per phase/round; not durable. */
  private byText = new Map<string, string>();

  remember(text: string, claimId: string) {
    this.byText.set(this.norm(text), claimId);
  }

  get(text: string): string | undefined {
    return this.byText.get(this.norm(text));
  }

  size(): number {
    return this.byText.size;
  }

  private norm(t: string): string {
    return t.trim().toLowerCase().replace(/\s+/g, " ");
  }
}

/**
 * Resolve a list of premise texts to claim IDs, minting any that don't
 * already exist in the registry. Idempotent on text content because the
 * server-side `mintClaimMoid` hash collapses duplicates.
 *
 * Default `claimType` is "EMPIRICAL" — Phase 1 outputs are already
 * tagged before they reach a translator, so this default fires for
 * Phase 2/3-derived premises.
 */
export async function resolvePremiseClaimIds(opts: {
  iso: IsonomiaClient;
  ctx: IsonomiaCallContext;
  deliberationId: string;
  registry: ClaimRegistry;
  premiseTexts: string[];
  defaultClaimType?: string;
}): Promise<string[]> {
  const ids: string[] = [];
  for (const text of opts.premiseTexts) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const cached = opts.registry.get(trimmed);
    if (cached) {
      ids.push(cached);
      continue;
    }
    const claim = await opts.iso.createClaim(
      {
        deliberationId: opts.deliberationId,
        text: trimmed,
        claimType: opts.defaultClaimType ?? "EMPIRICAL",
      },
      opts.ctx,
    );
    opts.registry.remember(trimmed, claim.id);
    ids.push(claim.id);
  }
  return ids;
}
