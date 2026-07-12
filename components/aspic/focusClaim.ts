"use client";

/**
 * Phase D-1: cross-component focus channel for "View in ASPIC results".
 *
 * Anywhere a contrary relation is rendered (badge tooltip, manager row), a
 * "View in ASPIC results" link can call `focusAspicForClaim()`. The
 * `AspicTheoryPanel` listens for this event (and the URL hash on mount) and
 * switches to its Extension view filtered by the claim's text, so the user
 * lands on the relevant attack/defeat without manual searching.
 *
 * Decoupled by design — the badge does not import any ASPIC code.
 */

export const ASPIC_FOCUS_EVENT = "aspic:focus-claim" as const;
export const ASPIC_FOCUS_HASH_PREFIX = "aspic-claim=" as const;

export type AspicFocusDetail = {
  claimId: string;
  claimText: string;
};

/** Dispatch a focus request and update the URL hash so deep-links work. */
export function focusAspicForClaim(detail: AspicFocusDetail) {
  if (typeof window === "undefined") return;
  try {
    // Hash deep-link (best-effort; failing this should not block the event).
    const newHash = `#${ASPIC_FOCUS_HASH_PREFIX}${encodeURIComponent(detail.claimId)}`;
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, "", newHash);
    }
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(ASPIC_FOCUS_EVENT, { detail }));
}

/** Read a focus claim id from the URL hash, if present. */
export function readFocusClaimIdFromHash(): string | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash || "";
  const idx = h.indexOf(ASPIC_FOCUS_HASH_PREFIX);
  if (idx === -1) return null;
  const raw = h.slice(idx + ASPIC_FOCUS_HASH_PREFIX.length);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw || null;
  }
}
