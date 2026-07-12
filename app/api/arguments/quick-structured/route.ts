/**
 * POST /api/arguments/quick-structured
 *
 * Structured-argument write surface for the MCP `propose_structured_argument`
 * tool. Mints a conclusion `Claim`, mints N premise `Claim`s, creates the
 * `Argument` + `ArgumentPremise[]` + (optional) `ArgumentSchemeInstance`
 * in one transaction. Mirrors `app/api/arguments/quick/route.ts` for auth,
 * rate-limiting, evidence handling, and provenance enrichment, and adds the
 * inference-structure pieces from the full UI POST in `app/api/arguments/route.ts`
 * (scheme inference, composition marking, support-record creation).
 *
 * See: docs/MCP_STRUCTURED_ARGUMENT_ROADMAP.md
 *
 * v1.1 (per roadmap §9.1):
 *   • Per-premise evidence       → premises[].evidence[] attaches to that
 *                                  premise's minted Claim row. Top-level
 *                                  evidence still attaches to the conclusion.
 *                                  When a premise is deduped (collapses into
 *                                  another premise or into the conclusion),
 *                                  its evidence is merged into the surviving
 *                                  claim and a `premise_evidence_merged`
 *                                  warning is emitted.
 *
 * Still deferred (per roadmap §4 / §9.2):
 *   • Slot/role binding by name  → missing required slots emit `missing_slot`
 *                                  warnings instead of throwing 500s
 *   • Eager CQ row creation      → CQs remain lazy
 *   • DialogueMove ASSERT        → kept off for parity with `quick` (back-port
 *                                  is a separate item)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { resolveCitationCallerUserId, isMcpBearer, namespaceForSpeakAs } from "@/lib/citation/mcpAuth";
import { normalizeCoordinates, actProvenanceFields } from "@/lib/provenance/coordinates";
import { mintClaimMoid } from "@/lib/ids/mintMoid";
import { getOrCreatePermalink } from "@/lib/citations/permalinkService";
import { isSafePublicUrl, getOrFetchLinkPreview } from "@/lib/unfurl";
import { enrichEvidenceProvenanceInBackground } from "@/lib/citations/evidenceProvenance";
import { enrichDeliberationNameInBackground } from "@/lib/deliberations/autoNameEnrichment";
import { inferAndAssignScheme } from "@/lib/argumentation/schemeInference";
import {
  resolveSchemeForWrite,
  verifyAgainstFingerprintPeers,
  type WriteVerifierVerdict,
} from "@/lib/schemes/writeGate";
import type { SchemeWriteWarningCode } from "@/lib/schemes/schemeWriteCodes";
import { ensureArgumentSupportInTx } from "@/lib/arguments/ensure-support";
import { markArgumentAsComposedInTx } from "@/lib/arguments/detect-composition";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

// ─── Rate limiter ────────────────────────────────────────────────────────────
// OQ7: shared `rl:quick_arg` budget with `propose_argument` — 20 writes/h
// across both bare + structured tools.
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const ratelimit = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.fixedWindow(20, "1 h"),
  prefix: "rl:quick_arg",
});

// ─── Input schema ─────────────────────────────────────────────────────────────
const EvidenceItem = z
  .object({
    url: z.string().url(),
    title: z.string().max(500).optional(),
    quote: z.string().max(2000).optional(),
    summary: z.string().max(2000).optional(),
  })
  .transform((ev) => ({
    ...ev,
    citationText: ev.summary ?? ev.quote,
  }));

const TextPremiseItem = z.object({
  text: z
    .string()
    .min(1, "Premise text is required")
    .max(1000, "Premise must be 1000 characters or fewer")
    .transform((s) => s.replace(/<[^>]*>/g, "").trim()),
  isAxiom: z.boolean().optional().default(false),
  // Roadmap B.1 — Carneades premise classification. Accepted lowercase from the
  // tool surface and normalised to the Prisma `PremiseType` enum at write time.
  premiseType: z.enum(["ordinary", "assumption", "exception"]).optional(),
  // v1.1 — per-premise evidence. Each item attaches to the premise's
  // minted Claim row (not the conclusion). Capped at 5 per premise to
  // keep total per-request evidence in line with the conclusion cap.
  evidence: z.array(EvidenceItem).max(5).optional().default([]),
});

// Modular threading — a premise may thread onto an EXISTING claim by id
// instead of supplying text. The canonical use is the modular chain flow:
// pass a prior link's returned conclusion-claim id here so this argument's
// premise shares the SAME Claim row (fork-proof — no reliance on byte-exact
// text repetition). The reused claim must live in the target deliberation.
const ReusePremiseItem = z.object({
  reuseClaimId: z.string().min(1).max(200),
  isAxiom: z.boolean().optional().default(false),
  premiseType: z.enum(["ordinary", "assumption", "exception"]).optional(),
});

// A premise is either a `reuseClaimId` thread (tried first — only it carries
// that key) or an ordinary text premise.
const PremiseItem = z.union([ReusePremiseItem, TextPremiseItem]);
type TextPremiseInput = z.infer<typeof TextPremiseItem>;
type ReusePremiseInput = z.infer<typeof ReusePremiseItem>;
type PremiseInput = z.infer<typeof PremiseItem>;
function isReusePremise(p: PremiseInput): p is ReusePremiseInput {
  return "reuseClaimId" in p;
}
function isTextPremise(p: PremiseInput): p is TextPremiseInput {
  return !("reuseClaimId" in p);
}

const QuickStructuredArgSchema = z.object({
  conclusion: z
    .string()
    .min(1, "Conclusion is required")
    .max(2000, "Conclusion must be 2000 characters or fewer")
    .transform((s) => s.replace(/<[^>]*>/g, "").trim()),
  premises: z
    .array(PremiseItem)
    .min(1, "At least one premise is required")
    .max(10, "At most 10 premises allowed"),
  reasoning: z
    .string()
    .max(5000)
    .optional()
    .transform((s) => s?.replace(/<[^>]*>/g, "").trim()),
  schemeKey: z.string().min(1).max(100).optional(),
  ruleType: z.enum(["STRICT", "DEFEASIBLE"]).optional().default("DEFEASIBLE"),
  ruleName: z.string().max(200).optional(),
  // Roadmap B.1 — top-level epistemic mode for the instance. Defaults to the
  // resolved scheme's catalogue value; an explicit override emits a warning
  // because the mode participates in the behaviour-fingerprint domain (Q-020).
  epistemicMode: z.enum(["FACTUAL", "HYPOTHETICAL", "COUNTERFACTUAL"]).optional(),
  implicitWarrant: z
    .string()
    .max(2000)
    .optional()
    .transform((s) => s?.replace(/<[^>]*>/g, "").trim()),
  evidence: z.array(EvidenceItem).max(10).optional().default([]),
  isPublic: z.boolean().optional().default(true),
  deliberationId: z.string().optional(),
  // Per-session capability token (roadmap S1). When present, it is recorded in
  // `aiProvenance.sessionId` so that the same MCP session can later
  // self-canonicalise its own answers to this argument's critical questions.
  sessionId: z.string().min(1).max(200).optional(),
  // §4 dialogical-side capability (MCP-bearer only): author this argument as
  // `mcp-bot:<speakAs>` so the same side can later defend it (author-only
  // GROUNDS in get_legal_moves keys on the argument's authorId). Ignored for
  // cookie callers; orthogonal to sessionId.
  speakAs: z.string().min(1).max(64).optional(),
  // N-1 (decorrelated-gating capture): raw independence coordinates of the
  // authoring agent/harness. Persisted as an ActProvenance row on the argument
  // and folded into aiProvenance for continuity. contextLineageId is the
  // unrecoverable-if-not-captured coordinate.
  coordinates: z.any().optional(),
});

// ─── "My Arguments" deliberation helper (mirrors quick/route.ts) ─────────────
const MY_ARGUMENTS_HOST_PREFIX = "standalone-my-arguments-";

async function getOrCreateMyArgumentsDeliberation(userId: string): Promise<string> {
  const hostId = `${MY_ARGUMENTS_HOST_PREFIX}${userId}`;
  const existing = await prisma.deliberation.findFirst({
    where: { hostType: "free", hostId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.deliberation.create({
    data: {
      hostType: "free",
      hostId,
      createdById: userId,
      title: "My Arguments",
    },
    select: { id: true },
  });
  return created.id;
}

// ─── Embed code builders (mirrors quick/route.ts) ────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

function buildEmbedCodes(shortCode: string, claimText: string) {
  const link = `${BASE_URL}/a/${shortCode}`;
  const embedSrc = `${BASE_URL}/embed/argument/${shortCode}?theme=auto`;
  const iframe = `<iframe src="${embedSrc}" width="600" height="400" frameborder="0" allow="clipboard-read; clipboard-write" loading="lazy" title="Isonomia Argument"></iframe>`;
  const truncated = claimText.length > 120 ? claimText.slice(0, 120) + "…" : claimText;
  const markdown = `**Claim:** ${truncated}\n\n[View full argument on Isonomia](${link})`;
  const plainText = `CLAIM: ${claimText}\n\nLink: ${link}`;
  return { link, iframe, markdown, plainText };
}

// ─── Non-throwing slot-presence check ────────────────────────────────────────
// Replaces `validateSlotsAgainstScheme` (which throws). v1 surfaces missing
// required slots as response warnings; v1.1 will accept slot bindings as input.
//
// Operational warning codes are route-local diagnostics that are NOT part of the
// roadmap §4.1 canonical code table (those live in `schemeWriteCodes.ts` as
// `SchemeWriteWarningCode`). Both unions feed the response `warnings[]`.
type OperationalWarningCode =
  | "missing_slot"
  | "premise_deduped"
  | "premise_threaded"
  | "scheme_inferred"
  | "premise_evidence_merged"
  | "scheme_behaviour_verdict";
type WarningCode = OperationalWarningCode | SchemeWriteWarningCode;
// Canonical (§4.1) warnings additionally carry the corrected value in
// `canonical`; operational warnings leave it `null`.
type Warning = { code: WarningCode; detail: string; canonical?: string | null };

// Inferred input shape for an evidence item after zod transform.
type NormalizedEvidence = z.infer<typeof EvidenceItem>;

async function collectMissingSlotWarnings(schemeId: string | null): Promise<Warning[]> {
  if (!schemeId) return [];
  const sc = await prisma.argumentScheme.findUnique({
    where: { id: schemeId },
    select: { key: true, validators: true },
  });
  const slotsValidator: Record<string, { required?: boolean }> | undefined =
    (sc?.validators as any)?.slots;
  if (!slotsValidator) return [];
  const warnings: Warning[] = [];
  for (const [role, rule] of Object.entries(slotsValidator)) {
    if (rule?.required) {
      warnings.push({
        code: "missing_slot",
        detail: `Scheme '${sc?.key}' expects a required slot '${role}'. Slot binding will be supported in v1.1; for now this is informational.`,
      });
    }
  }
  return warnings;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Auth: cookie/Firebase first, then MCP shared-secret bearer.
  const userId = await resolveCitationCallerUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Bare caller id — used for rate limiting and "My Arguments" ownership. The
  // authorship id (userIdStr) may be namespaced to a dialogical side after we
  // parse `speakAs` from the body (see below).
  let userIdStr = userId;
  const viaMcp = isMcpBearer(req);

  // Rate limit (shared budget with /quick)
  const { success: withinLimit } = await ratelimit.limit(userIdStr);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Rate limit exceeded — max 20 quick arguments per hour" },
      { status: 429 }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = QuickStructuredArgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    conclusion,
    premises,
    reasoning,
    schemeKey,
    ruleType,
    ruleName,
    implicitWarrant,
    evidence,
    deliberationId,
    epistemicMode: epistemicModeInput,
    sessionId,
    speakAs,
    coordinates,
  } = parsed.data;
  const coords = normalizeCoordinates(coordinates);

  // §4: namespace the authorship id to the dialogical side (MCP-bearer only).
  // Rate limiting + "My Arguments" ownership stay on the bare `userId`.
  userIdStr = namespaceForSpeakAs({ isMcpBearer: viaMcp, baseUserId: userId, speakAs });

  // SSRF guard on every evidence URL (top-level + per-premise).
  const allEvidenceForGuard: NormalizedEvidence[] = [
    ...evidence,
    ...premises.flatMap((p) => (isTextPremise(p) ? p.evidence ?? [] : [])),
  ];
  for (const ev of allEvidenceForGuard) {
    if (!isSafePublicUrl(ev.url)) {
      return NextResponse.json(
        { error: `Unsafe or non-public URL: ${ev.url}` },
        { status: 400 }
      );
    }
  }

  // Validate deliberationId if provided
  if (deliberationId) {
    const delib = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { id: true },
    });
    if (!delib) {
      return NextResponse.json(
        { error: "Deliberation not found" },
        { status: 400 }
      );
    }
  }

  // ─── Scheme resolution (pre-transaction) ───────────────────────────────────
  // OQ1: explicit `schemeKey` wins; otherwise infer from reasoning ?? premises
  // joined ?? conclusion. Wrong-but-present scheme is preferable to null
  // because it surfaces CQs the LLM can react to.
  const warnings: Warning[] = [];
  let schemeId: string | null = null;
  let schemeMeta: { id: string; key: string; name: string } | null = null;
  // Roadmap B.1: epistemic mode persisted on the instance + verifier verdict.
  let resolvedEpistemicMode: string | null = null;
  let verifierVerdict: WriteVerifierVerdict | null = null;

  if (schemeKey) {
    // Roadmap B.1 — health-selection gate. Refuse dialogue-meta / test
    // placeholders; auto-redirect folksonomy duplicates to their canonical
    // sibling (never a silent merge — §1.4).
    const gate = await resolveSchemeForWrite(schemeKey);
    if (!gate.ok) {
      if (gate.code === "SCHEME_UNKNOWN") {
        return NextResponse.json(
          {
            error: `Unknown schemeKey '${schemeKey}'`,
            code: "SCHEME_UNKNOWN",
            canonical: null,
            hint: "Call `list_schemes` (MCP) or GET /api/schemes for the catalog.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error: gate.reason,
          code: gate.code, // SCHEME_NOT_ARGUMENT_PATTERN
          canonical: gate.canonical, // null — no automatic fix
          requestedKey: gate.requestedKey,
          hint: "Call `list_schemes(excludeUnhealthy: true)` to pick a production argument pattern.",
        },
        { status: 400 }
      );
    }

    schemeId = gate.scheme.id;
    schemeMeta = { id: gate.scheme.id, key: gate.scheme.key, name: gate.scheme.name };

    if (gate.canonicalizedFrom) {
      warnings.push({
        code: "SCHEME_CANONICALIZED",
        canonical: gate.scheme.key,
        detail: `Requested scheme '${gate.canonicalizedFrom}' is a folksonomy duplicate; auto-redirected to canonical '${gate.scheme.key}'. The argument is attached to the canonical scheme (not silently merged — the original key is preserved here for audit).`,
      });
    }

    // Epistemic mode: default to the scheme's catalogue value; an explicit
    // override shifts the behaviour-fingerprint domain (Q-020) → warn.
    if (epistemicModeInput && epistemicModeInput !== gate.scheme.epistemicMode) {
      resolvedEpistemicMode = epistemicModeInput;
      warnings.push({
        code: "EPISTEMIC_MODE_CHANGED_FINGERPRINT",
        canonical: epistemicModeInput,
        detail: `Epistemic mode overridden from the scheme default '${gate.scheme.epistemicMode}' to '${epistemicModeInput}'. This participates in the behaviour-fingerprint domain, so this instance no longer matches the scheme's catalogue fingerprint exactly.`,
      });
    } else {
      resolvedEpistemicMode = epistemicModeInput ?? gate.scheme.epistemicMode;
    }

    // Behaviour-equality verdict against same-fingerprint siblings (radar).
    verifierVerdict = await verifyAgainstFingerprintPeers(
      gate.scheme.id,
      gate.scheme.fingerprint,
    );
    if (verifierVerdict.kind === "inconclusive") {
      // §4.1 canonical: the same-fingerprint behaviour check was inconclusive.
      warnings.push({
        code: "VERIFIER_INCONCLUSIVE",
        canonical: verifierVerdict.againstSchemeKey,
        detail: `Verifier verdict 'inconclusive' against same-fingerprint scheme '${verifierVerdict.againstSchemeKey ?? "?"}'. The argument ships; the verdict is persisted on the instance for the Phase 4d catalogue audit.`,
      });
    } else if (
      verifierVerdict.kind === "equal" ||
      verifierVerdict.kind === "subset"
    ) {
      // Operational diagnostic (not a §4.1 refusal/health code): a clean
      // behaviour relationship against a same-fingerprint sibling.
      warnings.push({
        code: "scheme_behaviour_verdict",
        detail: `Verifier verdict '${verifierVerdict.kind}' against same-fingerprint scheme '${verifierVerdict.againstSchemeKey ?? "?"}'. The argument ships; the verdict is persisted on the instance for the Phase 4d catalogue audit.`,
      });
    }
  } else {
    const inferenceText =
      (reasoning && reasoning.length > 0 && reasoning) ||
      premises.filter(isTextPremise).map((p) => p.text).join(" ; ") ||
      conclusion;
    schemeId = await inferAndAssignScheme(inferenceText, conclusion);
    if (schemeId) {
      const row = await prisma.argumentScheme.findUnique({
        where: { id: schemeId },
        select: { id: true, key: true, name: true, epistemicMode: true } as any,
      });
      if (row) {
        const r = row as any;
        schemeMeta = { id: r.id, key: r.key, name: r.name };
        resolvedEpistemicMode = epistemicModeInput ?? (r.epistemicMode ?? null);
        warnings.push({
          code: "scheme_inferred",
          detail: `Scheme '${row.key}' (${row.name}) was inferred server-side. Pass an explicit \`schemeKey\` to override; call \`list_schemes\` to browse the catalog.`,
        });
      }
    }
  }

  // OQ3: collect missing-slot warnings without throwing
  warnings.push(...(await collectMissingSlotWarnings(schemeId)));

  try {
    // Resolve target deliberation
    const targetDelibId =
      deliberationId ?? (await getOrCreateMyArgumentsDeliberation(userId));

    // ─── Mint conclusion claim ────────────────────────────────────────────────
    const conclusionMoid = mintClaimMoid(conclusion);
    const conclusionClaim = await prisma.claim.upsert({
      where: { moid: conclusionMoid },
      create: {
        text: conclusion,
        moid: conclusionMoid,
        createdById: userIdStr,
        deliberationId: targetDelibId,
      },
      update: {},
      select: { id: true, text: true, moid: true },
    });

    // ─── Resolve reused premise claims (modular threading) ────────────────────
    // A premise may thread onto an EXISTING claim by id (e.g. the conclusion
    // claim a prior modular link returned) instead of supplying text. Resolve
    // every reuseClaimId against the target deliberation up front so a typo or
    // a cross-deliberation reference fails fast (400) rather than silently
    // minting a fresh, un-threaded claim. Mirrors the chain route's pre-flight.
    const reuseIds = [
      ...new Set(premises.filter(isReusePremise).map((p) => p.reuseClaimId)),
    ];
    const reusedById = new Map<
      string,
      { id: string; text: string; moid: string }
    >();
    if (reuseIds.length > 0) {
      const rows = await prisma.claim.findMany({
        where: { id: { in: reuseIds } },
        select: { id: true, text: true, moid: true, deliberationId: true },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const notFound: string[] = [];
      const wrongDelib: string[] = [];
      for (const id of reuseIds) {
        const row = byId.get(id);
        if (!row) {
          notFound.push(id);
          continue;
        }
        if (row.deliberationId !== targetDelibId) {
          wrongDelib.push(id);
          continue;
        }
        reusedById.set(id, { id: row.id, text: row.text, moid: row.moid });
      }
      if (notFound.length > 0 || wrongDelib.length > 0) {
        return NextResponse.json(
          {
            error:
              (notFound.length > 0
                ? `reuseClaimId not found: ${notFound.join(", ")}. `
                : "") +
              (wrongDelib.length > 0
                ? `reuseClaimId belongs to a different deliberation than '${targetDelibId}': ${wrongDelib.join(
                    ", ",
                  )}. Reuse only claims that live in the target deliberation.`
                : ""),
            code: "PREMISE_CLAIM_NOT_FOUND",
          },
          { status: 400 },
        );
      }
    }

    // ─── Mint premise claims (dedup by moid) ──────────────────────────────────
    // If two premise texts produce the same moid (or collide with the
    // conclusion), they collapse to a single Claim row. We surface this as
    // a `premise_deduped` warning so callers know the response.premises[]
    // length may be less than the request's. Per-premise evidence on a
    // deduped premise is merged into the surviving claim and surfaced as a
    // `premise_evidence_merged` warning so per-source provenance survives.
    // Reuse premises carry the resolved claim's text/moid plus a `reusedClaimId`
    // so they thread (by moid) onto the same Claim row and skip minting.
    const premiseMoids = premises.map((p) => {
      if (isReusePremise(p)) {
        const c = reusedById.get(p.reuseClaimId)!;
        return {
          text: c.text,
          moid: c.moid,
          isAxiom: p.isAxiom,
          premiseType: p.premiseType,
          evidence: [] as NormalizedEvidence[],
          reusedClaimId: c.id as string | undefined,
        };
      }
      return {
        text: p.text,
        moid: mintClaimMoid(p.text),
        isAxiom: p.isAxiom,
        premiseType: p.premiseType,
        evidence: p.evidence ?? [],
        reusedClaimId: undefined as string | undefined,
      };
    });

    // Map of claim-moid → evidence to attach to that claim. Pre-populated
    // with conclusion-level evidence so a premise that collapses onto the
    // conclusion can merge into the same bucket.
    const evidenceByMoid = new Map<string, NormalizedEvidence[]>();
    evidenceByMoid.set(conclusionMoid, [...evidence]);

    const seenMoids = new Set<string>();
    const dedupedPremises: typeof premiseMoids = [];
    for (const p of premiseMoids) {
      if (seenMoids.has(p.moid)) {
        warnings.push({
          code: "premise_deduped",
          detail: `Premise text '${p.text.slice(0, 80)}…' collapsed to an existing claim by content hash.`,
        });
        if (p.evidence.length > 0) {
          const existing = evidenceByMoid.get(p.moid) ?? [];
          evidenceByMoid.set(p.moid, [...existing, ...p.evidence]);
          warnings.push({
            code: "premise_evidence_merged",
            detail: `${p.evidence.length} evidence item(s) from the deduped premise '${p.text.slice(0, 80)}…' were merged into the surviving claim.`,
          });
        }
        continue;
      }
      if (p.moid === conclusionMoid) {
        warnings.push({
          code: "premise_deduped",
          detail: `Premise text matches the conclusion by content hash and was dropped to avoid a self-loop.`,
        });
        if (p.evidence.length > 0) {
          const existing = evidenceByMoid.get(conclusionMoid) ?? [];
          evidenceByMoid.set(conclusionMoid, [...existing, ...p.evidence]);
          warnings.push({
            code: "premise_evidence_merged",
            detail: `${p.evidence.length} evidence item(s) from the premise that collapsed onto the conclusion were merged into the conclusion claim.`,
          });
        }
        continue;
      }
      seenMoids.add(p.moid);
      evidenceByMoid.set(p.moid, [...p.evidence]);
      dedupedPremises.push(p);
    }

    if (dedupedPremises.length === 0) {
      return NextResponse.json(
        {
          error:
            "All premises collapsed to the conclusion or to each other. Provide at least one distinct premise.",
        },
        { status: 400 }
      );
    }

    const premiseClaims = await Promise.all(
      dedupedPremises.map((p) =>
        p.reusedClaimId
          ? // Threaded premise — the claim already exists; reuse its row
            // directly (no upsert) so this argument shares it with the origin.
            Promise.resolve({ id: p.reusedClaimId, text: p.text, moid: p.moid })
          : prisma.claim.upsert({
              where: { moid: p.moid },
              create: {
                text: p.text,
                moid: p.moid,
                createdById: userIdStr,
                deliberationId: targetDelibId,
              },
              update: {},
              select: { id: true, text: true, moid: true },
            }),
      ),
    );

    const threadedCount = dedupedPremises.filter((p) => p.reusedClaimId).length;
    if (threadedCount > 0) {
      warnings.push({
        code: "premise_threaded",
        detail: `${threadedCount} premise(s) threaded onto existing claim(s) by reuseClaimId — they share the same content-hashed Claim row as the origin (fork-proof).`,
      });
    }

    // ─── Auto-unfurl evidence titles where missing ────────────────────────────
    // Run unfurls once per unique URL across all evidence buckets so we
    // don't pay the network round-trip twice if the same URL appears under
    // both the conclusion and a premise.
    const unfurlCache = new Map<string, string | undefined>();
    async function unfurlTitle(
      ev: NormalizedEvidence
    ): Promise<NormalizedEvidence> {
      if (ev.title) return ev;
      if (unfurlCache.has(ev.url)) {
        return { ...ev, title: unfurlCache.get(ev.url) };
      }
      try {
        const preview = await getOrFetchLinkPreview(ev.url);
        const title = preview.title ?? undefined;
        unfurlCache.set(ev.url, title);
        return { ...ev, title };
      } catch {
        unfurlCache.set(ev.url, undefined);
        return ev;
      }
    }

    // ─── Create ClaimEvidence per claim (conclusion + per-premise) ───────────
    // ClaimEvidence has no (claimId, uri) unique constraint, so we dedup
    // by URL within each claim's bucket before writing. Premise evidence
    // attaches to the premise's minted Claim row (v1.1 — roadmap §9.1).
    let provenancePending = false;
    const allCreatedEvidenceIds: string[] = [];

    type ClaimWriteTarget = { claimId: string; moid: string };
    const writeTargets: ClaimWriteTarget[] = [
      { claimId: conclusionClaim.id, moid: conclusionMoid },
      ...premiseClaims.map((c) => ({ claimId: c.id, moid: c.moid })),
    ];

    for (const { claimId, moid } of writeTargets) {
      const bucket = evidenceByMoid.get(moid) ?? [];
      if (bucket.length === 0) continue;

      // Dedup by URL within this claim's bucket (first-write wins).
      const seenUrls = new Set<string>();
      const uniqueBucket = bucket.filter((ev) => {
        if (seenUrls.has(ev.url)) return false;
        seenUrls.add(ev.url);
        return true;
      });

      const enriched = await Promise.all(uniqueBucket.map(unfurlTitle));

      await prisma.claimEvidence.createMany({
        data: enriched.map((ev) => ({
          claimId,
          uri: ev.url,
          title: ev.title ?? null,
          citation: ev.citationText ?? null,
          addedById: userIdStr,
        })),
        skipDuplicates: true,
      });

      try {
        const created = await prisma.claimEvidence.findMany({
          where: {
            claimId,
            uri: { in: enriched.map((e) => e.url) },
          },
          select: { id: true },
        });
        if (created.length > 0) {
          allCreatedEvidenceIds.push(...created.map((c) => c.id));
          provenancePending = true;
        }
      } catch {
        // best-effort
      }
    }

    if (allCreatedEvidenceIds.length > 0) {
      enrichEvidenceProvenanceInBackground(allCreatedEvidenceIds);
    }

    // ─── Argument + premises + scheme-instance in one transaction ────────────
    const created = await prisma.$transaction(async (tx) => {
      const argument = await tx.argument.create({
        data: {
          deliberationId: targetDelibId,
          authorId: userIdStr,
          conclusionClaimId: conclusionClaim.id,
          schemeId: schemeId ?? null,
          implicitWarrant: implicitWarrant ?? undefined,
          // Argument.text holds the reasoning gloss when present. UI/fitness
          // code keys on conclusionClaim.text for the actual conclusion.
          text: reasoning ?? "",
          ...(viaMcp
            ? {
                authorKind: "AI" as const,
                aiProvenance: {
                  via: "mcp",
                  tool: "propose_structured_argument",
                  createdAt: new Date().toISOString(),
                  ...(sessionId ? { sessionId } : {}),
                  // N-1: fold independence coordinates into aiProvenance for
                  // continuity with the existing provenance blob; the queryable
                  // source of truth is the ActProvenance row written below.
                  ...(coords ? { coordinates: coords } : {}),
                },
              }
            : {}),
        },
        select: { id: true, text: true, confidence: true },
      });

      // N-1: capture the author's independence coordinates atomically with the
      // argument. Authoring is a CONFIRM-side act whose contextLineageId is
      // unrecoverable if not written here.
      {
        const fields = actProvenanceFields(
          { ...(coords ?? {}), authorKind: viaMcp ? "AI" : "HUMAN", capturedVia: viaMcp ? "mcp" : "ui" },
          viaMcp ? "mcp" : "ui",
        );
        await tx.actProvenance.upsert({
          where: {
            subjectType_subjectId: { subjectType: "argument", subjectId: argument.id },
          },
          create: { subjectType: "argument", subjectId: argument.id, ...fields },
          update: fields,
        });
      }

      // ArgumentSupport (required for evidential API)
      await ensureArgumentSupportInTx(tx, {
        argumentId: argument.id,
        claimId: conclusionClaim.id,
        deliberationId: targetDelibId,
        base: 0.7,
      });

      // ArgumentPremise rows
      await tx.argumentPremise.createMany({
        data: premiseClaims.map((c, idx) => ({
          argumentId: argument.id,
          claimId: c.id,
          groupKey: null,
          isImplicit: false,
          isAxiom: dedupedPremises[idx]?.isAxiom ?? false,
          // Roadmap B.1 — Carneades classification (default ORDINARY when the
          // caller omits it). Enum values are upper-case in Prisma.
          premiseType: (dedupedPremises[idx]?.premiseType ?? "ordinary").toUpperCase(),
        })) as any,
        skipDuplicates: true,
      });

      // Mark composed (premise-bearing args MUST be marked composed)
      await markArgumentAsComposedInTx(
        tx,
        argument.id,
        "Composed via propose_structured_argument"
      );

      // ArgumentSchemeInstance if scheme resolved (explicit or inferred)
      let schemeInstanceId: string | null = null;
      if (schemeId) {
        const inst = await (tx as any).argumentSchemeInstance.create({
          data: {
            argumentId: argument.id,
            schemeId,
            role: "primary",
            explicitness: "explicit",
            confidence: 1.0,
            isPrimary: true,
            order: 0,
            ruleType,
            ruleName: ruleName ?? null,
            // Roadmap B.1 — record the selected epistemic mode + the behaviour
            // verdict so the Phase 4d audit can track drift.
            epistemicMode: resolvedEpistemicMode ?? null,
            verifierVerdict: verifierVerdict?.kind ?? null,
          },
          select: { id: true },
        });
        schemeInstanceId = inst.id;
      }

      return { argument, schemeInstanceId };
    });

    // Fire-and-forget: once a deliberation accumulates content, an LLM pass
    // may upgrade an auto-generated / NULL title to a concise summary name.
    // Self-debouncing and guarded against clobbering human titles (Phase 6).
    enrichDeliberationNameInBackground(targetDelibId);

    // Permalink + embed codes
    const permalink = await getOrCreatePermalink(created.argument.id);
    const embedCodes = buildEmbedCodes(permalink.shortCode, conclusion);

    return NextResponse.json({
      ok: true,
      argument: {
        id: created.argument.id,
        text: created.argument.text,
        confidence: created.argument.confidence,
      },
      claim: {
        id: conclusionClaim.id,
        text: conclusionClaim.text,
        moid: conclusionClaim.moid,
      },
      premises: premiseClaims.map((c) => ({
        id: c.id,
        text: c.text,
        moid: c.moid,
      })),
      schemeInstance:
        created.schemeInstanceId && schemeMeta
          ? {
              id: created.schemeInstanceId,
              schemeId: schemeMeta.id,
              schemeKey: schemeMeta.key,
              schemeName: schemeMeta.name,
              epistemicMode: resolvedEpistemicMode ?? null,
              verifierVerdict: verifierVerdict?.kind ?? null,
            }
          : null,
      // Roadmap B.1 — behaviour-equality verdict against same-fingerprint
      // siblings (kind "skipped" at the Phase 4d baseline). Surfaced so the
      // agent can react before reusing a redundant scheme.
      verifierVerdict,
      warnings,
      permalink: {
        shortCode: permalink.shortCode,
        slug: permalink.slug,
        url: embedCodes.link,
      },
      embedCodes,
      provenancePending,
      retryAfterMs: provenancePending ? 60_000 : 0,
      // Parity note: DialogueMove ASSERT and commitment-contradiction checks
      // are intentionally NOT created here (matches behavior of /quick).
      // Tracked as a follow-up in MCP_STRUCTURED_ARGUMENT_ROADMAP.md §3.1.
    });
  } catch (e: any) {
    console.error("[POST /api/arguments/quick-structured]", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to create structured argument" },
      { status: 500 }
    );
  }
}
