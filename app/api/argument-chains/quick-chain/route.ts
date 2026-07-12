/**
 * POST /api/argument-chains/quick-chain
 *
 * Chain-creation write surface for the MCP `propose_argument_chain` tool.
 * Mirrors `app/api/arguments/quick-structured/route.ts` for auth (cookie →
 * MCP shared-secret bearer), rate-limiting, and AI-author flagging, and the
 * `app/api/argument-chains/from-prong/route.ts` atomic-transaction pattern for
 * the chain rows (`ArgumentChain` + `ArgumentChainNode[]` + serial
 * `ArgumentChainEdge[]`).
 *
 * See: Development and Ideation Documents/ARCHITECTURE/CHAIN_CREATION_OVER_MCP_SPEC.md
 *
 * Step 1 (this file): **compose** mode — chain *existing* arguments by
 * `argumentId` into the spine (no minting). The chain's worst-link standing is
 * echoed from `lib/deliberation/chainExposure.ts`.
 *
 * Step 2 (next): **mint-and-link** mode — per-link `quick-structured` engine +
 * MOID threading + fork guard. Currently returns 501.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { normalizeCoordinates, actProvenanceFields } from "@/lib/provenance/coordinates";
import { resolveChainAuthor } from "@/lib/citation/chainAuthor";
import {
  resolveSchemeForWrite,
  verifyAgainstFingerprintPeers,
  type WriteVerifierVerdict,
} from "@/lib/schemes/writeGate";
import { computeChainExposure } from "@/lib/deliberation/chainExposure";
import {
  resolveChainTopology,
  resolveChainAttacks,
  isSupportEdgeType,
  CHAIN_EDGE_TYPES,
  type ResolvedEdge,
  type DerivedChainType,
  type AttackLinkInput,
  type ResolvedAttack,
} from "@/lib/argument-chains/chainTopology";
import {
  resolveChainScopes,
  SCOPE_TYPES,
  EPISTEMIC_STATUSES,
  DIALECTICAL_ROLES,
  type ScopeInput,
  type ResolvedScopeLink,
} from "@/lib/argument-chains/chainScopes";
import {
  validateEvidenceAnchor,
  intentContradictsSupport,
  isExecutableEvidence,
  CITATION_ANCHOR_TYPES,
  CITATION_INTENTS,
} from "@/lib/argument-chains/chainEvidence";
import { upsertSourceFromUrlOrDoi } from "@/lib/sources/upsertSource";
import { mintClaimMoid } from "@/lib/ids/mintMoid";
import { ensureArgumentSupportInTx } from "@/lib/arguments/ensure-support";
import { markArgumentAsComposedInTx } from "@/lib/arguments/detect-composition";
import { inferAndAssignScheme } from "@/lib/argumentation/schemeInference";
import { isSafePublicUrl, getOrFetchLinkPreview } from "@/lib/unfurl";
import { enrichEvidenceProvenanceInBackground } from "@/lib/citations/evidenceProvenance";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
const MY_ARGUMENTS_HOST_PREFIX = "standalone-my-arguments-";

async function getOrCreateMyArgumentsDeliberation(userId: string): Promise<string> {
  const hostId = `${MY_ARGUMENTS_HOST_PREFIX}${userId}`;
  const existing = await prisma.deliberation.findFirst({
    where: { hostType: "free", hostId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.deliberation.create({
    data: { hostType: "free", hostId, createdById: userId, title: "My Arguments" },
    select: { id: true },
  });
  return created.id;
}

// ─── Rate limiter ──────────────────────────────────────────────────────────
// Dedicated chain-write budget — a single chain call materialises many rows,
// so it gets its own window rather than draining the per-argument budget.
const redisClient = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
const ratelimit = new Ratelimit({
  redis: redisClient,
  limiter: Ratelimit.fixedWindow(10, "1 h"),
  prefix: "rl:quick_chain",
});

// ─── Input schema ────────────────────────────────────────────────────────────
const strip = (s: string) => s.replace(/<[^>]*>/g, "").trim();

const EvidenceItem = z
  .object({
    url: z.string().url(),
    title: z.string().max(500).optional(),
    quote: z.string().max(2000).optional(),
    summary: z.string().max(2000).optional(),
    // PART 5 Step 3 (§4.5): executable anchor + semantic intent. Superset of
    // the PART-3 shape — every PART-3 evidence item stays valid.
    locator: z.string().max(200).optional(),
    anchorType: z.enum(CITATION_ANCHOR_TYPES).optional(),
    anchorData: z.any().optional(),
    anchorId: z.string().max(200).optional(),
    intent: z.enum(CITATION_INTENTS).optional(),
  })
  .transform((ev) => ({ ...ev, citationText: ev.summary ?? ev.quote }));

type NormalizedEvidence = z.infer<typeof EvidenceItem>;

// mint-and-link: a link is a quick-structured payload. A premise is either an
// ordinary text premise (minted by MOID) or an explicit `reuseClaimId` thread
// onto a prior link's conclusion (Step 3). `reuseClaimId` may carry optional
// `text` as a sanity declaration — if the text's MOID diverges from the
// referenced claim's MOID the chain is rejected (CHAIN_LINK_BROKEN, §4.1).
const OrdinaryPremiseItem = z.object({
  text: z
    .string()
    .min(1, "Premise text is required")
    .max(1000, "Premise must be 1000 characters or fewer")
    .transform(strip),
  isAxiom: z.boolean().optional().default(false),
  premiseType: z.enum(["ordinary", "assumption", "exception"]).optional(),
  evidence: z.array(EvidenceItem).max(5).optional().default([]),
});

const ReusePremiseItem = z.object({
  reuseClaimId: z.string().min(1, "reuseClaimId must be a non-empty claim id"),
  text: z
    .string()
    .max(1000, "Premise must be 1000 characters or fewer")
    .optional()
    .transform((s) => (s ? strip(s) : undefined)),
});

// Reuse variant is tried first: only it carries `reuseClaimId`.
// A bare string premise is coerced to `{ text }` before the union (forgiving
// input — LLM callers naturally emit premises as strings).
const LinkPremiseItem = z.preprocess(
  (val) => (typeof val === "string" ? { text: val } : val),
  z.union([ReusePremiseItem, OrdinaryPremiseItem]),
);

type ReusePremiseInput = z.infer<typeof ReusePremiseItem>;
type OrdinaryPremiseInput = z.infer<typeof OrdinaryPremiseItem>;
type LinkPremiseInput = z.infer<typeof LinkPremiseItem>;

function isReusePremise(p: LinkPremiseInput): p is ReusePremiseInput {
  return "reuseClaimId" in p;
}

const LinkItem = z.object({
  conclusion: z
    .string()
    .min(1, "Conclusion is required")
    .max(2000, "Conclusion must be 2000 characters or fewer")
    .transform(strip),
  premises: z
    .array(LinkPremiseItem)
    .min(1, "At least one premise is required")
    .max(10, "At most 10 premises allowed"),
  reasoning: z.string().max(5000).optional().transform((s) => s && strip(s)),
  schemeKey: z.string().min(1).max(100).optional(),
  ruleType: z.enum(["STRICT", "DEFEASIBLE"]).optional().default("DEFEASIBLE"),
  implicitWarrant: z.string().max(2000).optional().transform((s) => s && strip(s)),
  epistemicMode: z.enum(["factual", "hypothetical", "counterfactual"]).optional(),
  evidence: z.array(EvidenceItem).max(10).optional().default([]),
  // Semantics (PART 5 §4.1): place this link inside a declared scope by index,
  // and/or label its epistemic status and dialectical role. Omit ⇒ the PART-3
  // actual world (ASSERTED, scopeId null).
  scope: z.number().int().min(0).optional(),
  epistemicStatus: z.enum(EPISTEMIC_STATUSES).optional(),
  dialecticalRole: z.enum(DIALECTICAL_ROLES).optional(),
  // Topology (PART 4 §4.2): instead of threading a claim, this link may attack
  // a prior link's claim (`attacksNode`, REBUTS/UNDERMINES) or attack an
  // inference edge (`attacksEdge`, UNDERCUTS — targets the reasoning link
  // itself). A link attacks at most one target; attacks never thread claims.
  attacksNode: z.number().int().min(0).optional(),
  attacksEdge: z
    .object({ from: z.number().int().min(0), to: z.number().int().min(0) })
    .optional(),
  attackType: z.enum(["REBUTS", "UNDERMINES"]).optional(),
});

// Topology (PART 4 §4.1): an optional typed edge between two links by index.
// Omitting `edges[]` entirely keeps the PART-3 serial SUPPORTS spine, so every
// legacy payload is unchanged.
const EdgeItem = z.object({
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  edgeType: z.enum(CHAIN_EDGE_TYPES).optional().default("SUPPORTS"),
  strength: z.number().min(0).max(1).optional().default(1.0),
  description: z.string().max(2000).optional().transform((s) => s && strip(s)),
});

// Semantics (PART 5 §4.1): an optional declared supposition. Links reference a
// scope by index; `parentScope` nests one scope inside another. Omit `scopes[]`
// entirely to keep the PART-3 actual world (every node ASSERTED).
const ScopeItem = z.object({
  scopeType: z.enum(SCOPE_TYPES),
  assumption: z
    .string()
    .min(1, "A scope assumption is required")
    .max(1000, "Assumption must be 1000 characters or fewer")
    .transform(strip),
  description: z.string().max(2000).optional().transform((s) => s && strip(s)),
  parentScope: z.number().int().min(0).optional(),
});

const QuickChainSchema = z.object({
  name: z
    .string()
    .min(1, "Chain name is required")
    .max(255, "Chain name must be 255 characters or fewer")
    .transform(strip),
  description: z.string().max(5000).optional().transform((s) => s && strip(s)),
  purpose: z.string().max(5000).optional().transform((s) => s && strip(s)),
  deliberationId: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
  mode: z.enum(["mint-and-link", "compose"]).optional().default("mint-and-link"),
  // Idempotency: a caller-supplied key (the MCP `requestId`) that makes chain
  // creation retry-safe — a retry carrying the same key returns the chain that
  // already landed instead of minting a duplicate (see §5.2 / option A).
  requestId: z.string().min(1).max(200).optional(),
  // mint-and-link: 2..12 links forming the spine.
  links: z.array(LinkItem).min(2).max(12).optional(),
  // compose: existing arguments in spine order.
  argumentIds: z.array(z.string().min(1)).optional(),
  // Topology (PART 4): declare a typed edge set instead of inferring a serial
  // spine. Omit ⇒ serial SUPPORTS spine. `chainType` is DERIVED from the edges
  // (§4.3); `expectChainType` pins it and errors on disagreement.
  edges: z.array(EdgeItem).max(60).optional(),
  expectChainType: z
    .enum(["SERIAL", "CONVERGENT", "DIVERGENT", "TREE", "GRAPH"])
    .optional(),
  // Semantics (PART 5): declare suppositional scopes; links attach by index.
  scopes: z.array(ScopeItem).max(12).optional(),
  // Per-session capability token (roadmap S1). Threaded into every minted
  // link's `aiProvenance.sessionId` so the same MCP session can later
  // self-canonicalise its answers to those links' critical questions.
  sessionId: z.string().min(1).max(200).optional(),
  // N-1 (decorrelated-gating capture): raw independence coordinates of the
  // authoring agent/harness; persisted as an ActProvenance row per minted link.
  coordinates: z.any().optional(),
});

type Warning = { code: string; detail: string };
type LinkInput = z.infer<typeof LinkItem>;
type EdgeInput = z.infer<typeof EdgeItem>;

// ─── Idempotency (option A) ────────────────────────────────────────────────
// A chain write carrying a `requestId` is retry-safe: the key is stored on the
// row (unique per creator), so a retry — e.g. the MCP client re-issuing after
// an HTTP-layer timeout while the first write was still committing — returns
// the chain that already landed instead of minting a duplicate spine.

async function findChainByIdempotencyKey(ownerId: bigint, requestId: string) {
  return prisma.argumentChain.findFirst({
    where: { createdBy: ownerId, idempotencyKey: requestId },
    select: {
      id: true,
      deliberationId: true,
      name: true,
      rootNodeId: true,
      chainType: true,
    },
  });
}

async function idempotentReplayResponse(chain: {
  id: string;
  deliberationId: string;
  name: string;
  rootNodeId: string | null;
  chainType: string;
}): Promise<NextResponse> {
  const [nodes, edges] = await Promise.all([
    prisma.argumentChainNode.findMany({
      where: { chainId: chain.id },
      select: {
        id: true,
        nodeOrder: true,
        argument: { select: { id: true, conclusionClaimId: true } },
      },
      orderBy: { nodeOrder: "asc" },
    }),
    prisma.argumentChainEdge.findMany({
      where: { chainId: chain.id },
      select: {
        id: true,
        sourceNodeId: true,
        targetNodeId: true,
        edgeType: true,
        strength: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return NextResponse.json(
    {
      ok: true,
      idempotentReplay: true,
      chain: {
        id: chain.id,
        name: chain.name,
        chainType: chain.chainType,
        rootNodeId: chain.rootNodeId,
        deliberationId: chain.deliberationId,
        permalink: `${BASE_URL}/deliberations/${chain.deliberationId}/chains/${chain.id}`,
      },
      links: nodes.map((n) => ({
        nodeId: n.id,
        argumentId: n.argument?.id ?? null,
        conclusionClaimId: n.argument?.conclusionClaimId ?? null,
        nodeOrder: n.nodeOrder,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        edgeType: e.edgeType,
        strength: e.strength,
      })),
      threading: [],
      warnings: [],
    },
    { status: 200, ...NO_STORE },
  );
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Auth: cookie/Firebase first, then MCP shared-secret bearer. Chain rows FK
  // their owner into User.id (BigInt), so we resolve a numeric owner here.
  const author = await resolveChainAuthor(req);
  if (!author) {
    return NextResponse.json(
      {
        error:
          "Unauthorized — requires a session cookie or MCP bearer token. If using MCP, provision the bot user with scripts/seed-mcp-bot-user.ts.",
      },
      { status: 401, ...NO_STORE },
    );
  }
  const { ownerId, userIdStr, viaMcp } = author;

  // Rate limit.
  const rl = await ratelimit.limit(ownerId.toString());
  const retryAfterMs = Math.max(0, rl.reset - Date.now());
  if (!rl.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded — max 10 chains per hour", retryAfterMs },
      { status: 429, ...NO_STORE },
    );
  }

  // Parse body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, ...NO_STORE },
    );
  }

  const parsed = QuickChainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400, ...NO_STORE },
    );
  }

  const {
    name,
    description,
    purpose,
    deliberationId,
    isPublic,
    mode,
    links,
    argumentIds,
    requestId,
    edges,
    expectChainType,
    scopes,
    sessionId,
    coordinates,
  } = parsed.data;

  if (mode === "mint-and-link") {
    return mintAndLinkChain({
      name,
      description: description ?? null,
      purpose: purpose ?? null,
      deliberationId,
      isPublic,
      links: links ?? [],
      ownerId,
      userIdStr,
      viaMcp,
      retryAfterMs,
      requestId,
      edges,
      expectChainType,
      scopes,
      sessionId,
      coordinates,
    });
  }

  // ─── compose mode ──────────────────────────────────────────────────────────
  return composeChain({
    name,
    description: description ?? null,
    purpose: purpose ?? null,
    deliberationId,
    isPublic,
    argumentIds: argumentIds ?? [],
    ownerId,
    viaMcp,
    retryAfterMs,
    requestId,
    edges,
    expectChainType,
  });
}

// ─── mint-and-link mode ───────────────────────────────────────────────────────
// Per-link resolution computed pre-transaction (Phase B health gate reused
// verbatim from quick-structured).
interface LinkResolution {
  schemeId: string | null;
  schemeMeta: { id: string; key: string; name: string } | null;
  resolvedEpistemicMode: string | null;
  verifierVerdict: WriteVerifierVerdict | null;
  schemeHealth: "ok" | "canonicalized";
}

async function mintAndLinkChain(opts: {
  name: string;
  description: string | null;
  purpose: string | null;
  deliberationId?: string;
  isPublic: boolean;
  links: LinkInput[];
  ownerId: bigint;
  userIdStr: string;
  viaMcp: boolean;
  retryAfterMs: number;
  requestId?: string;
  edges?: EdgeInput[];
  expectChainType?: DerivedChainType;
  scopes?: ScopeInput[];
  sessionId?: string;
  coordinates?: unknown;
}) {
  const {
    name,
    description,
    purpose,
    deliberationId: requestedDelibId,
    isPublic,
    links,
    ownerId,
    userIdStr,
    viaMcp,
    retryAfterMs,
    requestId,
    edges,
    expectChainType,
    scopes,
    sessionId,
    coordinates,
  } = opts;
  const coords = normalizeCoordinates(coordinates);

  const warnings: Warning[] = [];

  // Idempotency pre-flight: if this key already produced a chain, replay it
  // instead of re-minting (retry-safe — see §5.2).
  if (requestId) {
    const existing = await findChainByIdempotencyKey(ownerId, requestId);
    if (existing) return idempotentReplayResponse(existing);
  }

  if (links.length < 2) {
    return NextResponse.json(
      { error: "A chain needs at least 2 links", code: "CHAIN_TOO_SHORT" },
      { status: 400, ...NO_STORE },
    );
  }
  if (links.length > 12) {
    return NextResponse.json(
      { error: "mint-and-link mode accepts at most 12 links", code: "CHAIN_TOO_LONG" },
      { status: 400, ...NO_STORE },
    );
  }

  // ─── Pre-flight: topology (PART 4 §4) — resolve & validate the edge set, ─────
  // derive the chain type, and verify acyclicity. Nothing is written here.
  const topology = resolveChainTopology(links.length, edges, expectChainType);
  if (!topology.ok) {
    return NextResponse.json(
      {
        error: topology.detail,
        code: topology.code,
        ...(topology.derivedChainType
          ? { derivedChainType: topology.derivedChainType }
          : {}),
      },
      { status: 400, ...NO_STORE },
    );
  }
  warnings.push(...topology.warnings);
  const {
    resolvedEdges,
    derivedChainType,
    rootIndex,
    supportEdgeCount,
    attackEdgeCount,
  } = topology;

  // ─── Pre-flight: scopes (PART 5 §4.1–4.4) — validate the supposition forest, ─
  // assign each link its scope/status/role, and verify containment over the
  // SUPPORT edges (a conclusion drawn inside a scope may not leak out). Nothing
  // is written here. Omit `scopes[]` and any per-link `scope` ⇒ the PART-3
  // actual world (every node ASSERTED).
  const scopeResult = resolveChainScopes({
    scopes,
    links: links.map((l) => ({
      scope: l.scope,
      epistemicStatus: l.epistemicStatus,
      dialecticalRole: l.dialecticalRole,
    })),
    supportEdges: resolvedEdges
      .filter((e) => isSupportEdgeType(e.edgeType))
      .map((e) => ({ from: e.from, to: e.to })),
  });
  if (!scopeResult.ok) {
    return NextResponse.json(
      {
        error: scopeResult.detail,
        code: scopeResult.code,
        ...(scopeResult.linkIndex !== undefined
          ? { linkIndex: scopeResult.linkIndex }
          : {}),
      },
      { status: 400, ...NO_STORE },
    );
  }
  warnings.push(...scopeResult.warnings);
  const resolvedScopes = scopeResult.resolvedScopes;
  const scopeLinks: ResolvedScopeLink[] = scopeResult.links;

  // ─── Pre-flight: attacks (PART 4 §4.2, Steps 3–4) — resolve each link's ──────
  // optional attack on a prior node (REBUTS/UNDERMINES) or inference edge
  // (UNDERCUTS). Validates indices and that an attacked edge is a real support
  // edge (depth-1 cap). Nothing is written here. Omit all attacks ⇒ PART-3.
  const attackResult = resolveChainAttacks(
    links.length,
    resolvedEdges,
    links.map<AttackLinkInput>((l) => ({
      attacksNode: l.attacksNode,
      attacksEdge: l.attacksEdge,
      attackType: l.attackType,
    })),
  );
  if (!attackResult.ok) {
    return NextResponse.json(
      {
        error: attackResult.detail,
        code: attackResult.code,
        ...(attackResult.linkIndex !== undefined
          ? { linkIndex: attackResult.linkIndex }
          : {}),
      },
      { status: 400, ...NO_STORE },
    );
  }
  warnings.push(...attackResult.warnings);
  const resolvedAttacks = attackResult.attacks;

  // SSRF guard on every evidence URL (conclusion-level + per-premise).
  for (const link of links) {
    const urls: NormalizedEvidence[] = [
      ...link.evidence,
      ...link.premises.flatMap((p) => (isReusePremise(p) ? [] : p.evidence)),
    ];
    for (const ev of urls) {
      if (!isSafePublicUrl(ev.url)) {
        return NextResponse.json(
          { error: `Unsafe or non-public URL: ${ev.url}` },
          { status: 400, ...NO_STORE },
        );
      }
    }
  }

  // ─── Pre-flight: evidence anchor well-formedness (§4.6) + intent advisory ────
  // A citation cannot anchor at a coordinate it does not carry the data for, so
  // a malformed anchor is rejected before any write (mirrors PART 3's fork
  // guard). A `refutes` intent on a non-attacking support link is allowed but
  // flagged (`evidence_intent_contrary`, §4.5) so the mismatch is visible.
  for (let li = 0; li < links.length; li++) {
    const link = links[li];
    const linkEvidence: NormalizedEvidence[] = [
      ...link.evidence,
      ...link.premises.flatMap((p) => (isReusePremise(p) ? [] : p.evidence)),
    ];
    const isAttacker =
      link.attacksNode !== undefined || link.attacksEdge !== undefined;
    let intentFlagged = false;
    for (const ev of linkEvidence) {
      const anchorCheck = validateEvidenceAnchor(ev);
      if (!anchorCheck.ok) {
        return NextResponse.json(
          { error: anchorCheck.detail, code: anchorCheck.code, linkIndex: li },
          { status: 400, ...NO_STORE },
        );
      }
      if (!isAttacker && !intentFlagged && intentContradictsSupport(ev.intent)) {
        intentFlagged = true;
        warnings.push({
          code: "evidence_intent_contrary",
          detail: `Link ${li} carries evidence with intent "refutes" on a support link (advisory — possibly a steelman).`,
        });
      }
    }
  }

  // Resolve target deliberation (validate if supplied; else "My Arguments").
  let targetDelibId: string;
  if (requestedDelibId) {
    const delib = await prisma.deliberation.findUnique({
      where: { id: requestedDelibId },
      select: { id: true },
    });
    if (!delib) {
      return NextResponse.json(
        { error: "Deliberation not found" },
        { status: 400, ...NO_STORE },
      );
    }
    targetDelibId = requestedDelibId;
  } else {
    targetDelibId = await getOrCreateMyArgumentsDeliberation(userIdStr);
  }

  // ─── Pre-flight: explicit reuseClaimId threading topology (§4.2, §7 step 2) ──
  // A reuseClaimId must reference a PRIOR link's conclusion within this request.
  // Prior conclusions resolve by MOID identity, so the referenced claim must
  // already exist (the caller knew its id) and live in the target deliberation.
  // Forward refs, cycles, self-refs, and unrelated claims → CHAIN_LINK_INVALID_THREAD;
  // a divergent sanity text → CHAIN_LINK_BROKEN. Nothing is written here.
  const conclusionMoids = links.map((l) => mintClaimMoid(l.conclusion));
  const reuseIds = new Set<string>();
  for (const l of links) {
    for (const p of l.premises) {
      if (isReusePremise(p)) reuseIds.add(p.reuseClaimId);
    }
  }
  if (reuseIds.size > 0) {
    const known = await prisma.claim.findMany({
      where: { id: { in: [...reuseIds] }, deliberationId: targetDelibId },
      select: { id: true, moid: true },
    });
    const claimMoidById = new Map(known.map((c) => [c.id, c.moid]));
    for (let k = 0; k < links.length; k++) {
      for (const p of links[k].premises) {
        if (!isReusePremise(p)) continue;
        const refMoid = claimMoidById.get(p.reuseClaimId);
        if (!refMoid) {
          return NextResponse.json(
            {
              error: `Link ${k + 1}: reuseClaimId '${p.reuseClaimId}' is not a claim in this deliberation; reuse is scoped to prior links' conclusions in this chain.`,
              code: "CHAIN_LINK_INVALID_THREAD",
              linkIndex: k,
            },
            { status: 400, ...NO_STORE },
          );
        }
        const fromLink = conclusionMoids.findIndex((m, j) => j < k && m === refMoid);
        if (fromLink === -1) {
          return NextResponse.json(
            {
              error: `Link ${k + 1}: reuseClaimId '${p.reuseClaimId}' does not reference a prior link's conclusion (forward reference, cycle, or unrelated claim).`,
              code: "CHAIN_LINK_INVALID_THREAD",
              linkIndex: k,
            },
            { status: 400, ...NO_STORE },
          );
        }
        if (p.text && mintClaimMoid(p.text) !== refMoid) {
          return NextResponse.json(
            {
              error: `Link ${k + 1}: declared reuse text forked into a distinct claim (content hash mismatch with reuseClaimId '${p.reuseClaimId}').`,
              code: "CHAIN_LINK_BROKEN",
              linkIndex: k,
            },
            { status: 400, ...NO_STORE },
          );
        }
      }
    }
  }

  // ─── Pre-flight: Phase B health gate per link (no rows written yet) ──────────
  const resolutions: LinkResolution[] = [];
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (link.schemeKey) {
      const gate = await resolveSchemeForWrite(link.schemeKey);
      if (!gate.ok) {
        return NextResponse.json(
          {
            error: `Link ${i + 1}: ${gate.reason}`,
            code: gate.code,
            canonical: gate.canonical,
            requestedKey: gate.requestedKey,
            linkIndex: i,
            hint: "Call list_schemes(excludeUnhealthy: true) to pick a healthy argument pattern.",
          },
          { status: 400, ...NO_STORE },
        );
      }

      let resolvedEpistemicMode: string;
      const epiInput = link.epistemicMode?.toUpperCase();
      if (epiInput && epiInput !== gate.scheme.epistemicMode) {
        resolvedEpistemicMode = epiInput;
        warnings.push({
          code: "EPISTEMIC_MODE_CHANGED_FINGERPRINT",
          detail: `Link ${i + 1}: epistemic mode overridden from scheme default '${gate.scheme.epistemicMode}' to '${epiInput}'; this no longer matches the scheme's catalogue fingerprint exactly.`,
        });
      } else {
        resolvedEpistemicMode = epiInput ?? gate.scheme.epistemicMode;
      }

      const verifierVerdict = await verifyAgainstFingerprintPeers(
        gate.scheme.id,
        gate.scheme.fingerprint,
      );

      if (gate.canonicalizedFrom) {
        warnings.push({
          code: "SCHEME_CANONICALIZED",
          detail: `Link ${i + 1}: requested scheme '${gate.canonicalizedFrom}' is a folksonomy duplicate; auto-redirected to canonical '${gate.scheme.key}' (not silently merged — original key preserved for audit).`,
        });
      }

      resolutions.push({
        schemeId: gate.scheme.id,
        schemeMeta: { id: gate.scheme.id, key: gate.scheme.key, name: gate.scheme.name },
        resolvedEpistemicMode,
        verifierVerdict,
        schemeHealth: gate.canonicalizedFrom ? "canonicalized" : "ok",
      });
    } else {
      // Infer a scheme (mirrors quick-structured's fallback).
      const inferenceText =
        (link.reasoning && link.reasoning.length > 0 && link.reasoning) ||
        link.premises.map((p) => p.text).join(" ; ") ||
        link.conclusion;
      const schemeId = await inferAndAssignScheme(inferenceText, link.conclusion);
      let schemeMeta: LinkResolution["schemeMeta"] = null;
      let resolvedEpistemicMode: string | null = null;
      if (schemeId) {
        const row = (await prisma.argumentScheme.findUnique({
          where: { id: schemeId },
          select: { id: true, key: true, name: true, epistemicMode: true } as any,
        })) as any;
        if (row) {
          schemeMeta = { id: row.id, key: row.key, name: row.name };
          resolvedEpistemicMode = link.epistemicMode?.toUpperCase() ?? row.epistemicMode ?? null;
          warnings.push({
            code: "scheme_inferred",
            detail: `Link ${i + 1}: scheme '${row.key}' (${row.name}) was inferred server-side. Pass an explicit schemeKey to override.`,
          });
        }
      }
      resolutions.push({
        schemeId,
        schemeMeta,
        resolvedEpistemicMode,
        verifierVerdict: null,
        schemeHealth: "ok",
      });
    }
  }

  // Intra-chain redundancy radar (MCP-Q-E): same scheme used by 2+ links.
  const schemeSeen = new Set<string>();
  for (let i = 0; i < resolutions.length; i++) {
    const sid = resolutions[i].schemeId;
    if (sid && schemeSeen.has(sid)) {
      warnings.push({
        code: "chain_link_scheme_repeat",
        detail: `Link ${i + 1} reuses scheme '${resolutions[i].schemeMeta?.key ?? sid}' already used earlier in the chain. A serial chain whose links share a scheme may be a single argument inflated into a chain, or genuine iterated reasoning — advisory only.`,
      });
    }
    if (sid) schemeSeen.add(sid);
  }

  // Reconcile per-link epistemic mode with its scope (PART 5 §4.4): a node in a
  // HYPOTHETICAL / COUNTERFACTUAL / OPPONENT scope coerces its argument mode to
  // match the supposition, so a hypothetical never reads as factual.
  for (let i = 0; i < resolutions.length; i++) {
    const coerced = scopeLinks[i]?.coercedMode;
    if (coerced && resolutions[i].resolvedEpistemicMode !== coerced) {
      const scopeIdx = scopeLinks[i].scopeIndex;
      const scopeType =
        scopeIdx !== null ? resolvedScopes[scopeIdx]?.scopeType : null;
      warnings.push({
        code: "scope_mode_coerced",
        detail: `Link ${i + 1}: epistemic mode coerced from '${resolutions[i].resolvedEpistemicMode ?? "FACTUAL"}' to '${coerced}' to match its ${scopeType ?? "scope"} scope.`,
      });
      resolutions[i].resolvedEpistemicMode = coerced;
    }
  }

  // chainRedundancyFlag (§8): ≥1 link verifier verdict in {equal,subset,inconclusive}.
  const chainRedundancyFlag = resolutions.some(
    (r) =>
      r.verifierVerdict?.kind === "equal" ||
      r.verifierVerdict?.kind === "subset" ||
      r.verifierVerdict?.kind === "inconclusive",
  );

  // ─── Atomic transaction (mint links + chain rows) ───────────────────────────
  // Threading: a link's conclusion can be reused by a LATER link's premise when
  // their text content-hashes (MOID) match — collapsing to one shared Claim.
  type ThreadEntry = { fromLink: number; toLink: number; sharedClaimId: string; mode: "moid" | "explicit" };
  // claimId → evidence to attach (resolved after the txn).
  const evidenceByClaimId = new Map<string, NormalizedEvidence[]>();
  const pushEvidence = (claimId: string, items: NormalizedEvidence[]) => {
    if (items.length === 0) return;
    const existing = evidenceByClaimId.get(claimId) ?? [];
    evidenceByClaimId.set(claimId, [...existing, ...items]);
  };

  // ─── Pre-flight: resolve every evidence URL to a Source (§7 step 3) ──────────
  // Executable citations require a resolvable `Source`. Resolve (find-or-create,
  // idempotent) up-front so an unresolvable URL fails fast
  // (`EVIDENCE_SOURCE_UNRESOLVED`) before the chain is minted. Sources are
  // deduped reusable entities, so resolving them ahead of the txn is safe even
  // if a later pre-flight rejects the chain. Plain PART-3 evidence (no anchor /
  // intent / locator) does NOT resolve a Source — it stays a pure ClaimEvidence
  // snapshot, so a PART-3 payload is unchanged (§9 backward-compat).
  const sourceIdByUrl = new Map<string, string>();
  {
    const evidenceUrls = new Set<string>();
    for (const link of links) {
      for (const ev of link.evidence) {
        if (isExecutableEvidence(ev)) evidenceUrls.add(ev.url);
      }
      for (const p of link.premises) {
        if (!isReusePremise(p)) {
          for (const ev of p.evidence) {
            if (isExecutableEvidence(ev)) evidenceUrls.add(ev.url);
          }
        }
      }
    }
    for (const url of evidenceUrls) {
      try {
        const { source } = await upsertSourceFromUrlOrDoi({
          url,
          createdById: userIdStr,
        });
        if (!source?.id) throw new Error("source id missing");
        sourceIdByUrl.set(url, source.id);
      } catch {
        return NextResponse.json(
          {
            error: `Evidence URL could not be resolved to a source: ${url}`,
            code: "EVIDENCE_SOURCE_UNRESOLVED",
          },
          { status: 400, ...NO_STORE },
        );
      }
    }
  }

  let result: {
    chainId: string;
    rootNodeId: string | null;
    nodes: { id: string; argumentId: string; nodeOrder: number }[];
    edges: {
      id: string;
      sourceNodeId: string;
      targetNodeId: string;
      edgeType: string;
      strength: number;
    }[];
    perLink: {
      argumentId: string;
      conclusionClaimId: string;
      schemeInstanceId: string | null;
    }[];
    threading: ThreadEntry[];
    scopeIds: (string | null)[];
    attacks: {
      attackerNodeId: string;
      targetType: "NODE" | "EDGE";
      targetNodeId: string | null;
      targetEdgeId: string | null;
      edgeType: ResolvedAttack["edgeType"];
    }[];
  };

  try {
    result = await prisma.$transaction(async (tx) => {
      // moid → { linkIndex, claimId } for PRIOR links' conclusions only.
      const priorConclusions = new Map<string, { linkIndex: number; claimId: string }>();
      // claimId → linkIndex for PRIOR conclusions (explicit reuseClaimId lookup).
      const priorConclusionLinkById = new Map<string, number>();
      const threading: ThreadEntry[] = [];
      const perLink: {
        argumentId: string;
        conclusionClaimId: string;
        schemeInstanceId: string | null;
      }[] = [];

      // Batch-resolve every claim the chain needs (all conclusions + all fresh,
      // non-reuse premises) by MOID identity up front: one createMany
      // (skipDuplicates) + one findMany, instead of a sequential upsert per
      // claim. Claims are globally keyed by MOID, so this is the same find-or-
      // create-by-MOID semantics the per-claim upserts had — threading in the
      // loop below just reads this map (no further claim round-trips per link).
      const claimTextByMoid = new Map<string, string>();
      for (const link of links) {
        claimTextByMoid.set(mintClaimMoid(link.conclusion), link.conclusion);
        for (const p of link.premises) {
          if (isReusePremise(p)) continue;
          claimTextByMoid.set(mintClaimMoid(p.text), p.text);
        }
      }
      const allMoids = [...claimTextByMoid.keys()];
      if (allMoids.length > 0) {
        await tx.claim.createMany({
          data: [...claimTextByMoid.entries()].map(([moid, text]) => ({
            text,
            moid,
            createdById: userIdStr,
            deliberationId: targetDelibId,
          })),
          skipDuplicates: true,
        });
      }
      const claimRows = await tx.claim.findMany({
        where: { moid: { in: allMoids } },
        select: { id: true, moid: true },
      });
      const moidToClaimId = new Map(claimRows.map((c) => [c.moid, c.id]));

      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const res = resolutions[i];

        // Conclusion claim — resolved by MOID from the batch upsert above.
        const conclusionMoid = mintClaimMoid(link.conclusion);
        const conclusionClaimId = moidToClaimId.get(conclusionMoid)!;
        pushEvidence(conclusionClaimId, link.evidence);

        // Resolve premises (dedup within link; auto-thread onto prior conclusions).
        const premiseClaimIds: string[] = [];
        const premiseMeta: { claimId: string; isAxiom: boolean; premiseType: string }[] = [];
        const seenInLink = new Set<string>();
        for (const p of link.premises) {
          // Explicit reuse: thread onto a prior link's conclusion by claim id.
          if (isReusePremise(p)) {
            const claimId = p.reuseClaimId;
            const fromLink = priorConclusionLinkById.get(claimId);
            if (fromLink === undefined) {
              // Pre-flight validated this; defensive guard rolls the txn back.
              throw new Error(
                `Link ${i + 1}: reuseClaimId '${claimId}' is not a prior link's conclusion.`,
              );
            }
            if (!seenInLink.has(claimId)) {
              seenInLink.add(claimId);
              premiseClaimIds.push(claimId);
              premiseMeta.push({ claimId, isAxiom: false, premiseType: "ordinary" });
              threading.push({
                fromLink,
                toLink: i,
                sharedClaimId: claimId,
                mode: "explicit",
              });
            }
            continue;
          }

          const pMoid = mintClaimMoid(p.text);

          // Self-loop: premise equals this link's own conclusion → drop.
          if (pMoid === conclusionMoid) {
            warnings.push({
              code: "premise_deduped",
              detail: `Link ${i + 1}: premise '${p.text.slice(0, 60)}…' matches its own conclusion by content hash and was dropped to avoid a self-loop.`,
            });
            continue;
          }

          // Auto-thread onto a prior link's conclusion (MOID identity).
          const prior = priorConclusions.get(pMoid);
          if (prior) {
            if (!seenInLink.has(prior.claimId)) {
              seenInLink.add(prior.claimId);
              premiseClaimIds.push(prior.claimId);
              premiseMeta.push({
                claimId: prior.claimId,
                isAxiom: p.isAxiom,
                premiseType: p.premiseType ?? "ordinary",
              });
              threading.push({
                fromLink: prior.linkIndex,
                toLink: i,
                sharedClaimId: prior.claimId,
                mode: "moid",
              });
              warnings.push({
                code: "chain_link_autothreaded",
                detail: `Link ${i + 1}: premise content-hash-collapsed onto link ${prior.linkIndex + 1}'s conclusion claim (threaded by MOID). Pass reuseClaimId to declare this explicitly.`,
              });
            }
            pushEvidence(prior.claimId, p.evidence);
            continue;
          }

          // Ordinary fresh premise — resolved by MOID from the batch upsert.
          const claimId = moidToClaimId.get(pMoid)!;
          if (seenInLink.has(claimId)) {
            warnings.push({
              code: "premise_deduped",
              detail: `Link ${i + 1}: premise '${p.text.slice(0, 60)}…' collapsed to an existing claim by content hash.`,
            });
            pushEvidence(claimId, p.evidence);
            continue;
          }
          seenInLink.add(claimId);
          premiseClaimIds.push(claimId);
          premiseMeta.push({
            claimId,
            isAxiom: p.isAxiom,
            premiseType: p.premiseType ?? "ordinary",
          });
          pushEvidence(claimId, p.evidence);
        }

        if (premiseClaimIds.length === 0) {
          throw new Error(
            `Link ${i + 1}: all premises collapsed to the conclusion or to each other. Provide at least one distinct premise.`,
          );
        }

        // Create the Argument.
        const argument = await tx.argument.create({
          data: {
            deliberationId: targetDelibId,
            authorId: userIdStr,
            conclusionClaimId,
            schemeId: res.schemeId ?? null,
            implicitWarrant: link.implicitWarrant || undefined,
            text: link.reasoning || "",
            ...(viaMcp
              ? {
                  authorKind: "AI" as const,
                  aiProvenance: {
                    via: "mcp",
                    tool: "propose_argument_chain",
                    createdAt: new Date().toISOString(),
                    ...(sessionId ? { sessionId } : {}),
                    // N-1: continuity copy; ActProvenance row below is the
                    // queryable source of truth.
                    ...(coords ? { coordinates: coords } : {}),
                  },
                }
              : {}),
          },
          select: { id: true },
        });

        // N-1: capture the author's independence coordinates atomically per
        // minted link — each link is its own authored argument.
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

        await ensureArgumentSupportInTx(tx, {
          argumentId: argument.id,
          claimId: conclusionClaimId,
          deliberationId: targetDelibId,
          base: 0.7,
        });

        await tx.argumentPremise.createMany({
          data: premiseMeta.map((m) => ({
            argumentId: argument.id,
            claimId: m.claimId,
            groupKey: null,
            isImplicit: false,
            isAxiom: m.isAxiom,
            premiseType: m.premiseType.toUpperCase(),
          })) as any,
          skipDuplicates: true,
        });

        await markArgumentAsComposedInTx(
          tx,
          argument.id,
          "Composed via propose_argument_chain",
        );

        let schemeInstanceId: string | null = null;
        if (res.schemeId) {
          const inst = await (tx as any).argumentSchemeInstance.create({
            data: {
              argumentId: argument.id,
              schemeId: res.schemeId,
              role: "primary",
              explicitness: link.schemeKey ? "explicit" : "implied",
              confidence: 1.0,
              isPrimary: true,
              order: 0,
              ruleType: link.ruleType,
              ruleName: null,
              epistemicMode: res.resolvedEpistemicMode ?? null,
              verifierVerdict: res.verifierVerdict?.kind ?? null,
            },
            select: { id: true },
          });
          schemeInstanceId = inst.id;
        }

        perLink.push({
          argumentId: argument.id,
          conclusionClaimId,
          schemeInstanceId,
        });
        priorConclusions.set(conclusionMoid, { linkIndex: i, claimId: conclusionClaimId });
        priorConclusionLinkById.set(conclusionClaimId, i);
      }

      // Create the chain shell.
      const chain = await tx.argumentChain.create({
        data: {
          deliberationId: targetDelibId,
          name,
          description,
          purpose,
          chainType: derivedChainType,
          isPublic,
          isEditable: false,
          createdBy: ownerId,
          idempotencyKey: requestId ?? null,
        },
        select: { id: true },
      });

      // Nodes — one per link, in spine order. A node is a CONCLUSION when it has
      // no outgoing SUPPORT edge (a sink in the support sub-graph), else PREMISE.
      // For a serial spine this reduces to "last node = CONCLUSION". An attacking
      // link (PART 4 §4.2) instead carries an OBJECTION/REBUTTAL role.
      const hasOutgoingSupport = new Set<number>();
      for (const e of resolvedEdges) {
        if (isSupportEdgeType(e.edgeType)) hasOutgoingSupport.add(e.from);
      }
      const attackRoleByIndex = new Map<
        number,
        "OBJECTION" | "REBUTTAL"
      >();
      for (const atk of resolvedAttacks) {
        // A conclusion-rebuttal reads as a REBUTTAL; a premise-undercut or an
        // inference-undercut reads as an OBJECTION.
        attackRoleByIndex.set(
          atk.attackerIndex,
          atk.edgeType === "REBUTS" ? "REBUTTAL" : "OBJECTION",
        );
      }
      await tx.argumentChainNode.createMany({
        data: perLink.map((pl, i) => ({
          chainId: chain.id,
          argumentId: pl.argumentId,
          nodeOrder: i,
          role:
            attackRoleByIndex.get(i) ??
            (hasOutgoingSupport.has(i) ? "PREMISE" : "CONCLUSION"),
          addedBy: ownerId,
        })),
      });
      const nodes: { id: string; argumentId: string; nodeOrder: number }[] =
        await tx.argumentChainNode.findMany({
          where: { chainId: chain.id },
          select: { id: true, argumentId: true, nodeOrder: true },
          orderBy: { nodeOrder: "asc" },
        });

      // Typed edges from the resolved topology (PART 4). For an omitted edge set
      // this is exactly the serial SUPPORTS spine.
      const nodeIdByIndex = nodes.map((n) => n.id); // nodeOrder === link index
      const edgeData = resolvedEdges.map((e) => ({
        chainId: chain.id,
        sourceNodeId: nodeIdByIndex[e.from],
        targetNodeId: nodeIdByIndex[e.to],
        edgeType: e.edgeType,
        strength: e.strength,
        description: e.description ?? null,
      }));
      if (edgeData.length > 0) {
        await tx.argumentChainEdge.createMany({ data: edgeData, skipDuplicates: true });
      }
      const edges = await tx.argumentChainEdge.findMany({
        where: { chainId: chain.id },
        select: {
          id: true,
          sourceNodeId: true,
          targetNodeId: true,
          edgeType: true,
          strength: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const rootNodeId = nodeIdByIndex[rootIndex] ?? nodes[0]?.id ?? null;
      if (rootNodeId) {
        await tx.argumentChain.update({
          where: { id: chain.id },
          data: { rootNodeId },
        });
      }

      // Scopes (PART 5 §7 steps 6–7). Create scope rows parents-first so the
      // self-relation FK resolves, then assign each scoped node its scopeId,
      // epistemicStatus, and dialecticalRole in a second pass (scope ids are
      // only known now). Nodes left in the actual world are untouched (ASSERTED,
      // scopeId null — the createMany defaults).
      const scopeIds: (string | null)[] = new Array(resolvedScopes.length).fill(null);
      if (resolvedScopes.length > 0) {
        const parentsFirst = [...resolvedScopes].sort((a, b) => a.depth - b.depth);
        for (const s of parentsFirst) {
          const createdScope = await tx.argumentScope.create({
            data: {
              chainId: chain.id,
              scopeType: s.scopeType,
              assumption: s.assumption,
              description: s.description ?? null,
              parentScopeId:
                s.parentIndex !== null ? scopeIds[s.parentIndex] : null,
              depth: s.depth,
              createdBy: ownerId,
            },
            select: { id: true },
          });
          scopeIds[s.index] = createdScope.id;
        }
      }
      for (let i = 0; i < nodes.length; i++) {
        const sl = scopeLinks[i];
        if (!sl) continue;
        const needsUpdate =
          sl.scopeIndex !== null ||
          sl.epistemicStatus !== "ASSERTED" ||
          sl.dialecticalRole !== null;
        if (!needsUpdate) continue;
        await tx.argumentChainNode.update({
          where: { id: nodes[i].id },
          data: {
            scopeId: sl.scopeIndex !== null ? scopeIds[sl.scopeIndex] : null,
            epistemicStatus: sl.epistemicStatus,
            dialecticalRole: sl.dialecticalRole,
          },
        });
      }

      // Attacks (PART 4 §4.2, §7 step 8). After the support edges exist, wire
      // each resolved attack: a node→node attack lays a REBUTS/UNDERMINES edge
      // attacker→target; a node→edge attack additionally flips the attacker
      // node to targetType=EDGE/targetEdgeId and lays an UNDERCUTS edge
      // attacker→(target edge's source node). Attack edges never thread claims.
      const edgeIdByPair = new Map<string, string>();
      for (const e of edges) {
        edgeIdByPair.set(`${e.sourceNodeId}->${e.targetNodeId}`, e.id);
      }
      const attackRecords: {
        attackerNodeId: string;
        targetType: "NODE" | "EDGE";
        targetNodeId: string | null;
        targetEdgeId: string | null;
        edgeType: ResolvedAttack["edgeType"];
      }[] = [];
      for (const atk of resolvedAttacks) {
        const attackerNodeId = nodeIdByIndex[atk.attackerIndex];
        if (atk.targetType === "NODE") {
          const targetNodeId = nodeIdByIndex[atk.targetNodeIndex!];
          // Self-counter advisory: the objection's conclusion is the very claim
          // it attacks (a node arguing against its own conclusion).
          if (
            perLink[atk.attackerIndex]?.conclusionClaimId &&
            perLink[atk.attackerIndex].conclusionClaimId ===
              perLink[atk.targetNodeIndex!]?.conclusionClaimId
          ) {
            warnings.push({
              code: "chain_self_attack",
              detail: `Link ${atk.attackerIndex} attacks link ${atk.targetNodeIndex} but shares its conclusion claim (self-counter).`,
            });
          }
          await tx.argumentChainEdge.create({
            data: {
              chainId: chain.id,
              sourceNodeId: attackerNodeId,
              targetNodeId,
              edgeType: atk.edgeType,
              strength: 1.0,
            },
          });
          attackRecords.push({
            attackerNodeId,
            targetType: "NODE",
            targetNodeId,
            targetEdgeId: null,
            edgeType: atk.edgeType,
          });
        } else {
          const ref = atk.targetEdge!;
          const targetEdgeId = edgeIdByPair.get(
            `${nodeIdByIndex[ref.from]}->${nodeIdByIndex[ref.to]}`,
          );
          // The pre-flight guaranteed this edge exists; guard defensively.
          if (!targetEdgeId) {
            throw new Error(
              `attacksEdge (${ref.from} → ${ref.to}) did not resolve to a materialised edge`,
            );
          }
          await tx.argumentChainNode.update({
            where: { id: attackerNodeId },
            data: { targetType: "EDGE", targetEdgeId },
          });
          // Lay the UNDERCUTS edge attacker → the attacked inference's source,
          // so the undercut is visible as a standing-bearing edge too.
          await tx.argumentChainEdge.create({
            data: {
              chainId: chain.id,
              sourceNodeId: attackerNodeId,
              targetNodeId: nodeIdByIndex[ref.from],
              edgeType: "UNDERCUTS",
              strength: 1.0,
            },
          });
          attackRecords.push({
            attackerNodeId,
            targetType: "EDGE",
            targetNodeId: null,
            targetEdgeId,
            edgeType: "UNDERCUTS",
          });
        }
      }

      return {
        chainId: chain.id,
        rootNodeId,
        nodes,
        edges,
        perLink,
        threading,
        scopeIds,
        attacks: attackRecords,
      };
    },
    // upserts, argument + premises + scheme instance, then chain/nodes/edges).
    // The default 5s interactive-transaction timeout is too tight for a
    // multi-link chain against a remote Postgres, so widen the window.
    { timeout: 30_000, maxWait: 10_000 });
  } catch (err: any) {
    // Lost the unique-key race: a concurrent retry with the same requestId
    // already committed this chain. Replay it rather than surfacing an error.
    if (requestId && err?.code === "P2002") {
      const existing = await findChainByIdempotencyKey(ownerId, requestId);
      if (existing) return idempotentReplayResponse(existing);
    }
    console.error("[POST /api/argument-chains/quick-chain] mint-and-link failed", err);
    return NextResponse.json(
      { error: err?.message ?? "chain minting failed" },
      { status: 500, ...NO_STORE },
    );
  }

  // ─── Evidence (outside the txn; best-effort) ────────────────────────────────
  let provenancePending = false;
  const createdEvidenceIds: string[] = [];
  const unfurlCache = new Map<string, string | undefined>();
  // PART 5 §5.1: executable citations echoed per link, keyed by claim id.
  const citationsByClaimId = new Map<
    string,
    {
      id: string;
      sourceId: string;
      locator: string | null;
      anchorType: string | null;
      intent: string | null;
    }[]
  >();
  for (const [claimId, items] of evidenceByClaimId) {
    if (items.length === 0) continue;
    const seenUrls = new Set<string>();
    const unique = items.filter((ev) => {
      if (seenUrls.has(ev.url)) return false;
      seenUrls.add(ev.url);
      return true;
    });
    const enriched = await Promise.all(
      unique.map(async (ev) => {
        if (ev.title) return ev;
        if (unfurlCache.has(ev.url)) return { ...ev, title: unfurlCache.get(ev.url) };
        try {
          const preview = await getOrFetchLinkPreview(ev.url);
          unfurlCache.set(ev.url, preview.title ?? undefined);
          return { ...ev, title: preview.title ?? undefined };
        } catch {
          unfurlCache.set(ev.url, undefined);
          return ev;
        }
      }),
    );
    try {
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
      const created = await prisma.claimEvidence.findMany({
        where: { claimId, uri: { in: enriched.map((e) => e.url) } },
        select: { id: true },
      });
      if (created.length > 0) {
        createdEvidenceIds.push(...created.map((c) => c.id));
        provenancePending = true;
      }
    } catch {
      // best-effort
    }

    // PART 5 Step 3 (§4.5): alongside the ClaimEvidence snapshot, write an
    // executable Citation against the link's claim. Idempotent on the
    // [targetType, targetId, sourceId, locator] unique key.
    try {
      const citationData = enriched
        .map((ev) => {
          // Plain PART-3 evidence writes only ClaimEvidence (§9 backward-compat).
          if (!isExecutableEvidence(ev)) return null;
          const sourceId = sourceIdByUrl.get(ev.url);
          if (!sourceId) return null;
          return {
            targetType: "claim",
            targetId: claimId,
            sourceId,
            locator: ev.locator ?? null,
            quote: ev.quote ?? null,
            note: ev.citationText ?? null,
            anchorType: ev.anchorType ?? null,
            anchorId: ev.anchorId ?? null,
            anchorData: ev.anchorData ?? undefined,
            intent: ev.intent ?? null,
            createdById: userIdStr,
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
      if (citationData.length > 0) {
        await prisma.citation.createMany({
          data: citationData,
          skipDuplicates: true,
        });
        const createdCitations = await prisma.citation.findMany({
          where: {
            targetType: "claim",
            targetId: claimId,
            sourceId: { in: citationData.map((c) => c.sourceId) },
          },
          select: {
            id: true,
            sourceId: true,
            locator: true,
            anchorType: true,
            intent: true,
          },
        });
        if (createdCitations.length > 0) {
          citationsByClaimId.set(claimId, createdCitations);
        }
      }
    } catch {
      // best-effort: a citation write failure never fails the committed chain.
    }
  }
  if (createdEvidenceIds.length > 0) {
    enrichEvidenceProvenanceInBackground(createdEvidenceIds);
  }

  // ─── Worst-link standing echo (outside the txn) ─────────────────────────────
  let chainStanding: string | null = null;
  let weakestLink: {
    argumentId: string;
    reason: string;
    epistemicStatus?: string;
  } | null = null;
  try {
    const exposure = await computeChainExposure(targetDelibId);
    const projection = exposure?.chains.find((c) => c.id === result.chainId);
    if (projection) {
      chainStanding = projection.chainStanding;
      weakestLink = projection.weakestLink;
    }
  } catch (err) {
    console.error(
      "[POST /api/argument-chains/quick-chain] chainStanding echo failed",
      err,
    );
  }
  // PART 5 §6: tag the weakest link with its epistemic status so a reader can
  // see whether the chain's weakest point is merely *supposed* rather than
  // asserted (a hypothetical weakest link reads very differently).
  if (weakestLink) {
    const widx = result.perLink.findIndex(
      (pl) => pl.argumentId === weakestLink!.argumentId,
    );
    weakestLink = {
      ...weakestLink,
      epistemicStatus:
        widx >= 0 ? scopeLinks[widx]?.epistemicStatus ?? "ASSERTED" : "ASSERTED",
    };
  }

  // ─── Response shape (§5.1) ──────────────────────────────────────────────────
  const responseLinks = result.nodes.map((n, i) => {
    const pl = result.perLink[i];
    const res = resolutions[i];
    return {
      nodeId: n.id,
      argumentId: pl.argumentId,
      conclusionClaimId: pl.conclusionClaimId,
      nodeOrder: n.nodeOrder,
      schemeInstance:
        pl.schemeInstanceId && res.schemeMeta
          ? {
              id: pl.schemeInstanceId,
              schemeKey: res.schemeMeta.key,
              schemeName: res.schemeMeta.name,
            }
          : null,
      schemeHealth: res.schemeHealth,
      verifierVerdict: res.verifierVerdict?.kind ?? "skipped",
      // Semantics (PART 5): the node's epistemic standing and scope membership.
      epistemicStatus: scopeLinks[i]?.epistemicStatus ?? "ASSERTED",
      scopeId:
        scopeLinks[i] && scopeLinks[i].scopeIndex !== null
          ? result.scopeIds[scopeLinks[i].scopeIndex as number]
          : null,
      dialecticalRole: scopeLinks[i]?.dialecticalRole ?? null,
      // Semantics (PART 5 Step 3 §5.1): executable citations on this link's claim.
      citations: citationsByClaimId.get(pl.conclusionClaimId) ?? [],
    };
  });

  // Semantics (PART 5 §5.1): echo the created scopes with their members.
  const responseScopes = result.scopeIds
    .map((id, idx) =>
      id
        ? {
            id,
            scopeType: resolvedScopes[idx].scopeType,
            assumption: resolvedScopes[idx].assumption,
            parentScopeId:
              resolvedScopes[idx].parentIndex !== null
                ? result.scopeIds[resolvedScopes[idx].parentIndex as number]
                : null,
            depth: resolvedScopes[idx].depth,
            nodeIds: result.nodes
              .filter((_, i) => scopeLinks[i]?.scopeIndex === idx)
              .map((n) => n.id),
          }
        : null,
    )
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return NextResponse.json(
    {
      ok: true,
      chain: {
        id: result.chainId,
        name,
        chainType: derivedChainType,
        rootNodeId: result.rootNodeId,
        deliberationId: targetDelibId,
        permalink: `${BASE_URL}/deliberations/${targetDelibId}/chains/${result.chainId}`,
      },
      links: responseLinks,
      scopes: responseScopes,
      edges: result.edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        edgeType: e.edgeType,
        strength: e.strength,
      })),
      attacks: result.attacks,
      topology: {
        derivedChainType,
        rootNodeId: result.rootNodeId,
        isDag: true,
        supportEdgeCount,
        attackEdgeCount,
      },
      threading: result.threading,
      chainStanding,
      weakestLink,
      chainRedundancyFlag,
      warnings,
      provenancePending,
      retryAfterMs: provenancePending ? 60_000 : retryAfterMs,
    },
    { status: 201, ...NO_STORE },
  );
}

async function composeChain(opts: {
  name: string;
  description: string | null;
  purpose: string | null;
  deliberationId?: string;
  isPublic: boolean;
  argumentIds: string[];
  ownerId: bigint;
  viaMcp: boolean;
  retryAfterMs: number;
  requestId?: string;
  edges?: EdgeInput[];
  expectChainType?: DerivedChainType;
}) {
  const {
    name,
    description,
    purpose,
    deliberationId: requestedDelibId,
    isPublic,
    argumentIds,
    ownerId,
    retryAfterMs,
    requestId,
    edges,
    expectChainType,
  } = opts;

  // Idempotency pre-flight (retry-safe — see §5.2).
  if (requestId) {
    const existing = await findChainByIdempotencyKey(ownerId, requestId);
    if (existing) return idempotentReplayResponse(existing);
  }

  // Dedup while preserving spine order.
  const seen = new Set<string>();
  const orderedIds = argumentIds.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  if (orderedIds.length < 2) {
    return NextResponse.json(
      {
        error: "A chain needs at least 2 distinct arguments",
        code: "CHAIN_TOO_SHORT",
      },
      { status: 400, ...NO_STORE },
    );
  }
  if (orderedIds.length > 20) {
    return NextResponse.json(
      {
        error: "compose mode accepts at most 20 arguments",
        code: "CHAIN_TOO_LONG",
      },
      { status: 400, ...NO_STORE },
    );
  }

  // ─── Pre-flight: topology (PART 4 §4) over the deduped spine. Edge indices ───
  // refer to positions in the (deduped) argument list. Omit ⇒ serial spine.
  const warnings: Warning[] = [];
  const topology = resolveChainTopology(orderedIds.length, edges, expectChainType);
  if (!topology.ok) {
    return NextResponse.json(
      {
        error: topology.detail,
        code: topology.code,
        ...(topology.derivedChainType
          ? { derivedChainType: topology.derivedChainType }
          : {}),
      },
      { status: 400, ...NO_STORE },
    );
  }
  warnings.push(...topology.warnings);
  const {
    resolvedEdges,
    derivedChainType,
    rootIndex,
    supportEdgeCount,
    attackEdgeCount,
  } = topology;

  // Load the referenced arguments.
  const args = await prisma.argument.findMany({
    where: { id: { in: orderedIds } },
    select: {
      id: true,
      deliberationId: true,
      conclusionClaimId: true,
      argumentSchemes: {
        select: { scheme: { select: { key: true, name: true } } },
      },
    },
  });
  const argById = new Map(args.map((a) => [a.id, a]));

  // Every id must resolve.
  const missing = orderedIds.filter((id) => !argById.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Argument(s) not found: ${missing.join(", ")}`,
        code: "CHAIN_LINK_NOT_FOUND",
      },
      { status: 400, ...NO_STORE },
    );
  }

  // Resolve the chain's deliberation. All arguments must live in one
  // deliberation (the chain FKs into it and chain-standing is delib-scoped).
  const distinctDelibs = [...new Set(args.map((a) => a.deliberationId))];
  let targetDelibId: string;
  if (requestedDelibId) {
    const wrong = orderedIds.filter(
      (id) => argById.get(id)!.deliberationId !== requestedDelibId,
    );
    if (wrong.length > 0) {
      return NextResponse.json(
        {
          error: `Argument(s) do not belong to deliberation '${requestedDelibId}': ${wrong.join(", ")}`,
          code: "CHAIN_LINK_NOT_FOUND",
        },
        { status: 400, ...NO_STORE },
      );
    }
    targetDelibId = requestedDelibId;
  } else {
    if (distinctDelibs.length > 1) {
      return NextResponse.json(
        {
          error:
            "Arguments span multiple deliberations; pass deliberationId to disambiguate or compose within a single deliberation",
          code: "CHAIN_LINK_NOT_FOUND",
        },
        { status: 400, ...NO_STORE },
      );
    }
    targetDelibId = distinctDelibs[0];
  }

  // ─── Per-link scheme-health re-check (non-fatal) ────────────────────────────
  // A composed argument may reference a since-deprecated scheme; surface that
  // as a warning so the caller knows the spine includes an unhealthy pattern.
  const schemeKeysToCheck = new Set<string>();
  for (const a of args) {
    for (const s of a.argumentSchemes) {
      if (s.scheme?.key) schemeKeysToCheck.add(s.scheme.key);
    }
  }
  const unhealthyKeys = new Set<string>();
  for (const key of schemeKeysToCheck) {
    const gate = await resolveSchemeForWrite(key);
    if (!gate.ok || gate.canonicalizedFrom) {
      unhealthyKeys.add(key);
    }
  }
  if (unhealthyKeys.size > 0) {
    for (const a of args) {
      const bad = a.argumentSchemes
        .map((s) => s.scheme?.key)
        .filter((k): k is string => !!k && unhealthyKeys.has(k));
      if (bad.length > 0) {
        warnings.push({
          code: "compose_link_scheme_unhealthy",
          detail: `Argument '${a.id}' references unhealthy scheme(s): ${bad.join(", ")}. The link is included as-is; consider re-attaching to a canonical pattern.`,
        });
      }
    }
  }

  // ─── Atomic transaction (from-prong pattern) ────────────────────────────────
  let result: {
    chainId: string;
    rootNodeId: string | null;
    nodes: { id: string; argumentId: string; nodeOrder: number }[];
    edges: {
      id: string;
      sourceNodeId: string;
      targetNodeId: string;
      edgeType: string;
      strength: number;
    }[];
  };
  try {
    result = await prisma.$transaction(async (tx) => {
      const chain = await tx.argumentChain.create({
        data: {
          deliberationId: targetDelibId,
          name,
          description,
          purpose,
          chainType: derivedChainType,
          isPublic,
          isEditable: false,
          createdBy: ownerId,
          idempotencyKey: requestId ?? null,
        },
        select: { id: true },
      });

      // Nodes — one per argument, in spine order. A node is a CONCLUSION when it
      // has no outgoing SUPPORT edge (a sink), else PREMISE. For a serial spine
      // this reduces to "last node = CONCLUSION".
      const hasOutgoingSupport = new Set<number>();
      for (const e of resolvedEdges) {
        if (isSupportEdgeType(e.edgeType)) hasOutgoingSupport.add(e.from);
      }
      const nodes: { id: string; argumentId: string; nodeOrder: number }[] = [];
      for (let i = 0; i < orderedIds.length; i++) {
        const created = await tx.argumentChainNode.create({
          data: {
            chainId: chain.id,
            argumentId: orderedIds[i],
            nodeOrder: i,
            role: hasOutgoingSupport.has(i) ? "PREMISE" : "CONCLUSION",
            addedBy: ownerId,
          },
          select: { id: true, argumentId: true, nodeOrder: true },
        });
        nodes.push(created);
      }

      // Typed edges from the resolved topology (PART 4). For an omitted edge
      // set this is exactly the serial SUPPORTS spine.
      const nodeIdByIndex = nodes.map((n) => n.id); // nodeOrder === spine index
      const edgeData = resolvedEdges.map((e) => ({
        chainId: chain.id,
        sourceNodeId: nodeIdByIndex[e.from],
        targetNodeId: nodeIdByIndex[e.to],
        edgeType: e.edgeType,
        strength: e.strength,
        description: e.description ?? null,
      }));
      if (edgeData.length > 0) {
        await tx.argumentChainEdge.createMany({
          data: edgeData,
          skipDuplicates: true,
        });
      }
      const edges = await tx.argumentChainEdge.findMany({
        where: { chainId: chain.id },
        select: {
          id: true,
          sourceNodeId: true,
          targetNodeId: true,
          edgeType: true,
          strength: true,
        },
        orderBy: { createdAt: "asc" },
      });

      const rootNodeId = nodeIdByIndex[rootIndex] ?? nodes[0]?.id ?? null;
      if (rootNodeId) {
        await tx.argumentChain.update({
          where: { id: chain.id },
          data: { rootNodeId },
        });
      }

      return { chainId: chain.id, rootNodeId, nodes, edges };
    },
    // Compose only writes chain/nodes/edges, but a 20-argument spine is still
    // many sequential node inserts — give the default 5s window some headroom.
    { timeout: 20_000, maxWait: 10_000 });
  } catch (err: any) {
    // Lost the unique-key race to a concurrent retry — replay the winner.
    if (requestId && err?.code === "P2002") {
      const existing = await findChainByIdempotencyKey(ownerId, requestId);
      if (existing) return idempotentReplayResponse(existing);
    }
    console.error("[POST /api/argument-chains/quick-chain] compose failed", err);
    return NextResponse.json(
      { error: err?.message ?? "chain composition failed" },
      { status: 500, ...NO_STORE },
    );
  }

  // ─── Worst-link standing echo (outside the transaction) ─────────────────────
  let chainStanding: string | null = null;
  let weakestLink: {
    argumentId: string;
    reason: string;
    epistemicStatus?: string;
  } | null = null;
  try {
    const exposure = await computeChainExposure(targetDelibId);
    const projection = exposure?.chains.find((c) => c.id === result.chainId);
    if (projection) {
      chainStanding = projection.chainStanding;
      weakestLink = projection.weakestLink;
    }
  } catch (err) {
    console.error(
      "[POST /api/argument-chains/quick-chain] chainStanding echo failed",
      err,
    );
  }
  // PART 5 §6: compose nodes are all in the actual world (ASSERTED); tag the
  // weakest link for response-shape parity with mint-and-link.
  if (weakestLink) {
    weakestLink = { ...weakestLink, epistemicStatus: "ASSERTED" };
  }

  // ─── Response shape (§5.1) ──────────────────────────────────────────────────
  const links = result.nodes.map((n) => {
    const arg = argById.get(n.argumentId)!;
    const inst = arg.argumentSchemes[0]?.scheme ?? null;
    const usesUnhealthy = arg.argumentSchemes.some(
      (s) => s.scheme?.key && unhealthyKeys.has(s.scheme.key),
    );
    return {
      nodeId: n.id,
      argumentId: n.argumentId,
      conclusionClaimId: arg.conclusionClaimId,
      nodeOrder: n.nodeOrder,
      schemeInstance: inst
        ? { id: null, schemeKey: inst.key, schemeName: inst.name }
        : null,
      schemeHealth: usesUnhealthy ? "rejected" : "ok",
      verifierVerdict: "skipped" as const,
      // Compose composes existing arguments into the actual world only.
      epistemicStatus: "ASSERTED" as const,
      scopeId: null,
      dialecticalRole: null,
      // Compose mode accepts no per-link evidence, so no executable citations.
      citations: [] as never[],
    };
  });

  return NextResponse.json(
    {
      ok: true,
      chain: {
        id: result.chainId,
        name,
        chainType: derivedChainType,
        rootNodeId: result.rootNodeId,
        deliberationId: targetDelibId,
        permalink: `${BASE_URL}/deliberations/${targetDelibId}/chains/${result.chainId}`,
      },
      links,
      scopes: [],
      edges: result.edges.map((e) => ({
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        edgeType: e.edgeType,
        strength: e.strength,
      })),
      attacks: [],
      topology: {
        derivedChainType,
        rootNodeId: result.rootNodeId,
        isDag: true,
        supportEdgeCount,
        attackEdgeCount,
      },
      threading: [],
      chainStanding,
      weakestLink,
      warnings,
      provenancePending: false,
      retryAfterMs,
    },
    { status: 201, ...NO_STORE },
  );
}
