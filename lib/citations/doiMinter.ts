/**
 * Track AI-EPI E.2 — Crossref / DataCite DOI minting (STUB).
 *
 * Real DOI registration is a separate, paid concern: Crossref membership
 * (~$275/yr) + per-DOI fees, or DataCite via a sponsoring institution.
 * Until we have an account, this module exists as the single place a
 * future implementer needs to flesh out.
 *
 * Public surface (kept stable so the rest of the app can import it today):
 *   - `mintDoiForArgument(att)` → throws "Not implemented" today; will
 *     return `{ doi, registeredAt }` once the registrar is wired.
 *   - `isDoiMintingEnabled()` → boolean toggle, off until env vars are set.
 *
 * Quality-threshold gating belongs in the *caller* (e.g. an admin UI or
 * a worker that filters arguments by `dialecticalStatus.testedness === "well_tested"`),
 * not here — this module just performs the registration.
 */

import type { ArgumentAttestation } from "@/lib/citations/argumentAttestation";

export interface MintedDoi {
  doi: string; // e.g. "10.5072/iso.argument.Bx7kQ2mN" (DataCite test prefix)
  registeredAt: string; // ISO timestamp
  registrar: "crossref" | "datacite";
}

/** Are the registrar credentials configured? */
export function isDoiMintingEnabled(): boolean {
  return Boolean(
    process.env.CROSSREF_API_KEY || process.env.DATACITE_API_TOKEN
  );
}

/**
 * Mint a real DOI for an argument attestation. Not implemented.
 *
 * When implemented, behaviour:
 *   1. Build a Crossref deposit XML (or DataCite JSON) from the
 *      attestation: title = conclusion text, author = att.author,
 *      publisher = "Isonomia", URL = att.immutablePermalink, etc.
 *   2. POST to the registrar.
 *   3. Persist the returned DOI on a new `Argument.doi` column (unique).
 *   4. Return `{ doi, registeredAt, registrar }`.
 */
export async function mintDoiForArgument(
  _att: ArgumentAttestation
): Promise<MintedDoi> {
  throw new Error(
    "mintDoiForArgument: not implemented. Configure CROSSREF_API_KEY or DATACITE_API_TOKEN and finish this stub."
  );
}
