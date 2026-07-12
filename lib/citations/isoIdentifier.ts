/**
 * Track AI-EPI E.2 — `iso:` identifier scheme.
 *
 * Isonomia mints a permanent, namespaced URN for every public artefact:
 *
 *     iso:argument:Bx7kQ2mN
 *     iso:claim:7c1a4f0e             (future)
 *     iso:deliberation:e1d4ca09     (future)
 *
 * Why URN, not DOI-mimicry:
 *   - DOIs require Crossref/DataCite registration + ongoing fees. Faking
 *     the `10.NNNN/` prefix invites misreading our ids as real DOIs.
 *   - URNs are the IETF-standard way to namespace identifiers. Schema.org
 *     `identifier` (PropertyValue) understands them. Zotero / library
 *     systems that don't recognise the namespace simply round-trip them
 *     as opaque strings, which is the correct fallback.
 *
 * The iso: id resolves via `/iso/argument/<shortCode>` → 301 → `/a/<shortCode>`,
 * so it has a canonical HTTP form for tools that only follow URLs.
 *
 * Note: the iso: id is *deterministic* from the shortCode — there is no
 * extra DB column. shortCode is already crypto-random + unique
 * ([lib/citations/permalinkService.ts](lib/citations/permalinkService.ts)).
 *
 * Real DOIs (E.2 stretch goal) are a separate concept; when minted via
 * Crossref/DataCite they live alongside the iso: id, not instead of it.
 * See [lib/citations/doiMinter.ts](lib/citations/doiMinter.ts) for the stub.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

/** All artefact kinds that participate in the iso: namespace. */
export type IsoArtefactKind = "argument" | "claim" | "deliberation";

const KNOWN_KINDS: ReadonlySet<IsoArtefactKind> = new Set([
  "argument",
  "claim",
  "deliberation",
]);

/** Build the URN form: `iso:argument:Bx7kQ2mN`. */
export function toIsoId(kind: IsoArtefactKind, shortCode: string): string {
  if (!shortCode) throw new Error("toIsoId: empty shortCode");
  return `iso:${kind}:${shortCode}`;
}

/** Build the canonical resolver URL for a given iso: id. */
export function toIsoUrl(kind: IsoArtefactKind, shortCode: string): string {
  return `${BASE_URL}/iso/${kind}/${encodeURIComponent(shortCode)}`;
}

/** Parse an iso: URN. Returns null on any malformed input — never throws. */
export function parseIsoId(
  id: string | null | undefined
): { kind: IsoArtefactKind; shortCode: string } | null {
  if (!id) return null;
  const parts = id.split(":");
  if (parts.length !== 3) return null;
  const [scheme, kind, shortCode] = parts;
  if (scheme !== "iso") return null;
  if (!KNOWN_KINDS.has(kind as IsoArtefactKind)) return null;
  if (!shortCode || !/^[A-Za-z0-9_-]{4,64}$/.test(shortCode)) return null;
  return { kind: kind as IsoArtefactKind, shortCode };
}
