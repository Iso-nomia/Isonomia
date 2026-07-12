#!/usr/bin/env tsx
/**
 * Showcase chain seeder — v2
 * ────────────────────────────────────────────────────────────────────────────
 * Reads a hand-authored YAML spec from scripts/showcase/<chainKey>.yaml and
 * idempotently materializes a fully-tested argument chain into the database.
 *
 * v2 capabilities (all backward compatible — every new field is optional):
 *
 *   • participants[]            multi-author seeding (proponent / opponent /
 *                               mediator). Each authorId can author arguments,
 *                               cast approvals, and contribute CQ responses.
 *   • sources[]                 reusable evidence pool referenced by `sourceRef`
 *                               from claims and arguments alike.
 *   • claims[].evidence[]       evidence directly attached to a claim
 *                               (independent of any argument's conclusion).
 *   • arguments[].author        which participant created the argument.
 *   • arguments[].secondarySchemes[]
 *                               additional non-primary scheme bindings.
 *   • arguments[].premises[]    accepts strings (claim keys) OR rich objects
 *                               { claim, supportArg? } where `supportArg` is
 *                               the key of another argument that backs that
 *                               specific premise (sub-argument chaining).
 *   • arguments[].approvals[]   list of participant keys that approve the arg.
 *   • edges[].targetScope       'conclusion' | 'premise' | 'inference'.
 *   • edges[].targetPremise     premise claim key (when targetScope=='premise').
 *   • edges[].attackType        REBUTS | UNDERCUTS | UNDERMINES.
 *   • edges[].cqKey             tag the edge with the CQ it instantiates.
 *   • edges[].author            participant key (createdById).
 *   • claimEdges[]              claim-level support / rebut edges, separate
 *                               from argument-graph edges.
 *   • answeredCQs[].responses[] multiple competing CQResponses per CQStatus,
 *                               each with its own author / status / canonical
 *                               flag / sourceUrls / endorsements.
 *   • answeredCQs[].status      override the CQStatus enum (default SATISFIED
 *                               for the back-compat single-response form).
 *   • dialogueMoves[]           seeds DialogueMove rows so the Ludics layer
 *                               has something to compile.
 *
 * Idempotency: a sidecar JSON file at scripts/showcase/.state/<chainKey>.json
 * tracks created IDs by spec key. Re-running updates rather than duplicates.
 *
 * Demo-honesty check: after seeding, every TOP-LEVEL "anchor" argument
 * (every arg that is not used solely as a sub-argument backing some premise)
 * is run through the same dialectical-fitness criteria the cite_argument MCP
 * tool exposes. The script exits non-zero if any anchor would render with
 * standingState="untested-default" or with zero attached evidence.
 *
 * Usage:
 *   SEED_USER_AUTH_ID=<auth_id> npx tsx scripts/seed-showcase-chain.ts \
 *     --spec scripts/showcase/teen-screens.yaml
 *
 * Env:
 *   SEED_USER_AUTH_ID  required — auth_id (Firebase id) of the seeding user.
 *                                 Used as a fallback wherever a participant
 *                                 key is omitted.
 *   SEED_DELIB_ID      optional — reuse an existing deliberation id.
 *   SKIP_PROVENANCE    optional — set to "1" to skip the live evidence fetch.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve, basename } from "path";
import { parse as parseYaml } from "yaml";
import crypto from "crypto";
import { prisma } from "@/lib/prismaclient";
import { mintClaimMoid } from "@/lib/ids/mintMoid";
import { getOrCreatePermalink } from "@/lib/citations/permalinkService";
import { enrichEvidenceProvenance } from "@/lib/citations/evidenceProvenance";

// ─────────────────────────────────────────────────────────────────────────────
// Spec types — mirror the YAML shape
// ─────────────────────────────────────────────────────────────────────────────

interface ParticipantSpec {
  key: string;
  authId: string;
  displayName?: string;
  role?: string; // informational: proponent / opponent / mediator / witness
}

interface SourceSpec {
  key: string;
  url: string;
  title?: string;
  quote?: string;
}

/** Evidence reference: either an inline spec or a reference into sources[]. */
type EvidenceRef =
  | { sourceRef: string; quote?: string; title?: string }
  | { url: string; title?: string; quote?: string };

interface ClaimSpec {
  key: string;
  text: string;
  evidence?: EvidenceRef[];
}

/** Premise reference: bare claim key (back-compat) or rich object. */
type PremiseRef =
  | string
  | {
      claim: string;
      /** key of another argument in arguments[] that backs this premise */
      supportArg?: string;
    };

interface ArgumentSpec {
  key: string;
  conclusion: string; // claim key
  scheme: string; // primary scheme key
  secondarySchemes?: string[];
  text: string;
  author?: string; // participant key
  premises?: PremiseRef[];
  evidence?: EvidenceRef[]; // attached to the conclusion claim
  approvals?: string[]; // participant keys who approve
}

interface CQResponseSpec {
  author?: string; // participant key
  text: string;
  status?: "PENDING" | "APPROVED" | "CANONICAL" | "REJECTED" | "SUPERSEDED" | "WITHDRAWN";
  canonical?: boolean;
  sourceUrls?: string[];
  evidenceClaimIds?: string[]; // claim KEYS (resolved at seed time)
  endorsements?: string[]; // participant keys
}

interface AnsweredCQSpec {
  argument: string;
  cqKey: string;
  /** Back-compat: if `responses` is omitted, `response` becomes a single APPROVED+CANONICAL response. */
  response?: string;
  responses?: CQResponseSpec[];
  status?: "OPEN" | "PENDING_REVIEW" | "PARTIALLY_SATISFIED" | "SATISFIED" | "DISPUTED";
}

interface EdgeSpec {
  from: string; // argument key
  to: string; // argument key
  type: "support" | "rebut" | "undercut";
  targetScope?: "conclusion" | "premise" | "inference";
  /** Required iff targetScope === 'premise'. Claim key. */
  targetPremise?: string;
  attackType?: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  cqKey?: string;
  author?: string; // participant key
  note?: string;
}

interface ClaimEdgeSpec {
  from: string; // claim key
  to: string; // claim key
  type: "supports" | "rebuts";
  attackType?: "SUPPORTS" | "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetScope?: "conclusion" | "premise" | "inference";
}

interface DialogueMoveSpec {
  kind: "ASSERT" | "WHY" | "GROUNDS" | "CONCEDE" | "RETRACT" | "CLOSE";
  /** Either { type: 'argument', key } or { type: 'claim', key }. */
  target: { type: "argument" | "claim"; key: string };
  actor?: string; // participant key (defaults to seed user)
  text?: string;
  locusPath?: string;
  polarity?: "P" | "O";
}

interface ChainSpec {
  chainKey: string;
  deliberationTitle: string;
  deliberationDescription?: string;
  participants?: ParticipantSpec[];
  sources?: SourceSpec[];
  claims: ClaimSpec[];
  arguments: ArgumentSpec[];
  answeredCQs?: AnsweredCQSpec[];
  edges?: EdgeSpec[];
  claimEdges?: ClaimEdgeSpec[];
  dialogueMoves?: DialogueMoveSpec[];
}

interface ChainState {
  deliberationId?: string;
  claims: Record<string, string>; // key → claim id
  arguments: Record<string, string>; // key → argument id
  permalinks: Record<string, string>; // key → shortCode
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI args
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let spec: string | null = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--spec") spec = args[++i] ?? null;
  }
  if (!spec) {
    console.error("Usage: npx tsx scripts/seed-showcase-chain.ts --spec <yaml-path>");
    process.exit(2);
  }
  return { spec: resolve(spec) };
}

// ─────────────────────────────────────────────────────────────────────────────
// State sidecar
// ─────────────────────────────────────────────────────────────────────────────

function stateFilePath(chainKey: string) {
  return resolve(__dirname, "showcase", ".state", `${chainKey}.json`);
}

function loadState(chainKey: string): ChainState {
  const path = stateFilePath(chainKey);
  if (!existsSync(path)) return { claims: {}, arguments: {}, permalinks: {} };
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveState(chainKey: string, state: ChainState) {
  const path = stateFilePath(chainKey);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookup tables built once per run
// ─────────────────────────────────────────────────────────────────────────────

interface RuntimeCtx {
  spec: ChainSpec;
  state: ChainState;
  seedUser: string;
  deliberationId: string;
  participantById: Record<string, ParticipantSpec>;
  /** participant key → authId; "seed" key resolves to the env auth id. */
  authorOf: (key?: string) => string;
  sourceById: Record<string, SourceSpec>;
}

function buildContext(
  spec: ChainSpec,
  state: ChainState,
  seedUser: string,
  deliberationId: string
): RuntimeCtx {
  const participantById: Record<string, ParticipantSpec> = {};
  for (const p of spec.participants ?? []) participantById[p.key] = p;
  const sourceById: Record<string, SourceSpec> = {};
  for (const s of spec.sources ?? []) sourceById[s.key] = s;
  return {
    spec,
    state,
    seedUser,
    deliberationId,
    participantById,
    sourceById,
    authorOf: (key?: string) => {
      if (!key) return seedUser;
      const p = participantById[key];
      if (!p) {
        throw new Error(
          `Unknown participant key "${key}". Add it to the participants[] section.`
        );
      }
      return p.authId;
    },
  };
}

function resolveEvidence(ctx: RuntimeCtx, ref: EvidenceRef): { url: string; title?: string; quote?: string } {
  if ("sourceRef" in ref) {
    const src = ctx.sourceById[ref.sourceRef];
    if (!src) {
      throw new Error(
        `Evidence sourceRef "${ref.sourceRef}" not found in sources[].`
      );
    }
    return {
      url: src.url,
      title: ref.title ?? src.title,
      quote: ref.quote ?? src.quote,
    };
  }
  return ref;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seeding logic
// ─────────────────────────────────────────────────────────────────────────────

async function resolveSeedUser(): Promise<string> {
  const authId = process.env.SEED_USER_AUTH_ID?.trim();
  if (!authId) {
    throw new Error(
      "SEED_USER_AUTH_ID env var required (auth_id / Firebase id of the seeding user)"
    );
  }
  return authId;
}

async function resolveDeliberation(spec: ChainSpec, state: ChainState, userId: string) {
  if (state.deliberationId) {
    const found = await prisma.deliberation.findUnique({
      where: { id: state.deliberationId },
      select: { id: true },
    });
    if (found) return found.id;
  }

  const envId = process.env.SEED_DELIB_ID?.trim();
  if (envId) {
    const found = await prisma.deliberation.findUnique({
      where: { id: envId },
      select: { id: true },
    });
    if (found) {
      state.deliberationId = found.id;
      return found.id;
    }
  }

  const created = await prisma.deliberation.create({
    data: {
      title: spec.deliberationTitle,
      createdById: userId,
      hostType: "discussion" as any,
      hostId: `showcase:${spec.chainKey}`,
    },
    select: { id: true },
  });
  state.deliberationId = created.id;
  return created.id;
}

async function upsertClaim(text: string, deliberationId: string, userId: string): Promise<string> {
  const moid = mintClaimMoid(text);
  const row = await prisma.claim.upsert({
    where: { moid },
    create: { text, moid, createdById: userId, deliberationId },
    update: {},
    select: { id: true },
  });
  return row.id;
}

async function resolveScheme(key: string) {
  const row = await prisma.argumentScheme.findUnique({
    where: { key },
    select: { id: true, key: true },
  });
  if (!row) {
    throw new Error(
      `Scheme "${key}" not found in ArgumentScheme table. Seed the scheme catalog first or use a different key.`
    );
  }
  return row;
}

async function upsertArgument(
  spec: ArgumentSpec,
  conclusionClaimId: string,
  deliberationId: string,
  authorId: string,
  existingId?: string
): Promise<string> {
  if (existingId) {
    const exists = await prisma.argument.findUnique({
      where: { id: existingId },
      select: { id: true },
    });
    if (exists) {
      await prisma.argument.update({
        where: { id: existingId },
        data: {
          text: spec.text,
          conclusionClaimId,
          authorId,
          lastUpdatedAt: new Date(),
        },
      });
      return existingId;
    }
  }
  const created = await prisma.argument.create({
    data: {
      deliberationId,
      authorId,
      text: spec.text,
      conclusionClaimId,
    },
    select: { id: true },
  });
  return created.id;
}

async function bindPremises(
  argumentId: string,
  premiseClaimIds: string[]
) {
  await prisma.argumentPremise.deleteMany({ where: { argumentId } });
  if (premiseClaimIds.length === 0) return;
  await prisma.argumentPremise.createMany({
    data: premiseClaimIds.map((claimId) => ({ argumentId, claimId })),
    skipDuplicates: true,
  });
}

async function bindScheme(argumentId: string, schemeId: string, isPrimary: boolean) {
  if (isPrimary) {
    await prisma.argumentSchemeInstance.updateMany({
      where: { argumentId, isPrimary: true, NOT: { schemeId } },
      data: { isPrimary: false },
    });
  }
  await prisma.argumentSchemeInstance.upsert({
    where: { argumentId_schemeId: { argumentId, schemeId } },
    create: {
      argumentId,
      schemeId,
      isPrimary,
      role: isPrimary ? "primary" : "secondary",
      explicitness: "explicit",
      confidence: 1.0,
    },
    update: { isPrimary, role: isPrimary ? "primary" : "secondary" },
  });
}

async function attachClaimEvidence(
  ctx: RuntimeCtx,
  claimId: string,
  evidence: EvidenceRef[],
  authorId: string
): Promise<string[]> {
  if (evidence.length === 0) return [];
  const resolved = evidence.map((e) => resolveEvidence(ctx, e));
  await prisma.claimEvidence.createMany({
    data: resolved.map((ev) => ({
      claimId,
      uri: ev.url,
      title: ev.title ?? null,
      citation: ev.quote ?? null,
      addedById: authorId,
    })),
    skipDuplicates: true,
  });
  const rows = await prisma.claimEvidence.findMany({
    where: { claimId, uri: { in: resolved.map((e) => e.url) } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function enrichSync(evidenceIds: string[]) {
  if (evidenceIds.length === 0) return;
  if (process.env.SKIP_PROVENANCE === "1") {
    console.log(`     · (skip) SKIP_PROVENANCE=1, leaving evidence unhashed`);
    return;
  }
  const queue = [...evidenceIds];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length > 0) {
      const id = queue.shift()!;
      try {
        await enrichEvidenceProvenance(id, { archive: true });
      } catch (e: any) {
        console.warn(`     · (!) provenance enrichment failed for ${id}: ${e?.message ?? e}`);
      }
    }
  });
  await Promise.all(workers);
}

async function upsertApprovals(
  ctx: RuntimeCtx,
  argumentId: string,
  participantKeys: string[]
) {
  for (const pkey of participantKeys) {
    const userAuthId = ctx.authorOf(pkey);
    await prisma.argumentApproval.upsert({
      where: { argumentId_userId: { argumentId, userId: userAuthId } },
      create: {
        deliberationId: ctx.deliberationId,
        argumentId,
        userId: userAuthId,
      },
      update: {},
    });
  }
}

async function answerCQ(
  ctx: RuntimeCtx,
  argumentId: string,
  schemeKey: string,
  spec: AnsweredCQSpec
) {
  // Derive responses array from either rich `responses` or back-compat `response`.
  const responses: CQResponseSpec[] =
    spec.responses && spec.responses.length > 0
      ? spec.responses
      : spec.response
      ? [{ text: spec.response, status: "APPROVED", canonical: true }]
      : [];

  // Default the CQStatus enum: if any response is APPROVED/CANONICAL → SATISFIED,
  // else PENDING_REVIEW if there is at least one PENDING, else OPEN.
  const inferred =
    responses.some((r) => r.canonical || r.status === "CANONICAL" || r.status === "APPROVED")
      ? "SATISFIED"
      : responses.some((r) => !r.status || r.status === "PENDING")
      ? "PENDING_REVIEW"
      : "OPEN";
  const statusEnum = spec.status ?? inferred;
  const satisfied = statusEnum === "SATISFIED" || statusEnum === "PARTIALLY_SATISFIED";

  // Verify CQ catalog entry (warn only).
  const cqDef = await prisma.criticalQuestion.findFirst({
    where: { scheme: { key: schemeKey }, cqKey: spec.cqKey },
    select: { id: true },
  });
  if (!cqDef) {
    console.warn(
      `     · (!) cqKey "${spec.cqKey}" not found in scheme "${schemeKey}" catalog — creating CQStatus anyway`
    );
  }

  // Upsert CQStatus (parent record).
  const status = await prisma.cQStatus.upsert({
    where: {
      targetType_targetId_schemeKey_cqKey: {
        targetType: "argument" as any,
        targetId: argumentId,
        schemeKey,
        cqKey: spec.cqKey,
      },
    },
    create: {
      targetType: "argument" as any,
      targetId: argumentId,
      argumentId,
      schemeKey,
      cqKey: spec.cqKey,
      statusEnum: statusEnum as any,
      satisfied,
      groundsText: responses[0]?.text ?? null,
      createdById: ctx.seedUser,
      roomId: ctx.deliberationId,
      lastReviewedAt: new Date(),
      lastReviewedBy: ctx.seedUser,
    },
    update: {
      statusEnum: statusEnum as any,
      satisfied,
      groundsText: responses[0]?.text ?? null,
      lastReviewedAt: new Date(),
      lastReviewedBy: ctx.seedUser,
    },
    select: { id: true },
  });

  // Drop existing seed-managed responses on this CQStatus and recreate (declarative).
  await prisma.cQResponse.deleteMany({ where: { cqStatusId: status.id } });

  let canonicalId: string | null = null;
  for (const r of responses) {
    const contributorId = ctx.authorOf(r.author);
    const evidenceClaimIds = (r.evidenceClaimIds ?? [])
      .map((k) => ctx.state.claims[k])
      .filter(Boolean) as string[];
    const respStatus = (r.canonical ? "CANONICAL" : (r.status ?? "PENDING")) as any;
    const created = await prisma.cQResponse.create({
      data: {
        cqStatusId: status.id,
        groundsText: r.text,
        responseStatus: respStatus,
        contributorId,
        evidenceClaimIds,
        sourceUrls: r.sourceUrls ?? [],
        reviewedAt: respStatus === "PENDING" ? null : new Date(),
        reviewedBy: respStatus === "PENDING" ? null : ctx.seedUser,
      },
      select: { id: true },
    });
    if (r.canonical || respStatus === "CANONICAL") canonicalId = created.id;

    // Endorsements
    for (const pkey of r.endorsements ?? []) {
      const endorserId = ctx.authorOf(pkey);
      await prisma.cQEndorsement.upsert({
        where: { responseId_userId: { responseId: created.id, userId: endorserId } },
        create: { responseId: created.id, userId: endorserId, weight: 1 },
        update: {},
      });
    }
  }

  if (canonicalId) {
    await prisma.cQStatus.update({
      where: { id: status.id },
      data: { canonicalResponseId: canonicalId },
    });
  } else {
    await prisma.cQStatus.update({
      where: { id: status.id },
      data: { canonicalResponseId: null },
    });
  }
}

async function upsertEdge(
  ctx: RuntimeCtx,
  spec: EdgeSpec,
  fromArgumentId: string,
  toArgumentId: string
) {
  const targetScope = (spec.targetScope ?? "conclusion") as any;
  const authorId = ctx.authorOf(spec.author);

  // Resolve targetPremise (if any) → claim id
  let targetPremiseId: string | undefined;
  if (spec.targetScope === "premise") {
    if (!spec.targetPremise) {
      throw new Error(
        `Edge ${spec.from}→${spec.to}: targetScope='premise' requires targetPremise (claim key)`
      );
    }
    targetPremiseId = ctx.state.claims[spec.targetPremise];
    if (!targetPremiseId) {
      throw new Error(`Edge ${spec.from}→${spec.to}: unknown targetPremise claim key ${spec.targetPremise}`);
    }
  }

  const existing = await prisma.argumentEdge.findFirst({
    where: { fromArgumentId, toArgumentId, type: spec.type as any, targetScope },
    select: { id: true },
  });
  if (existing) {
    await prisma.argumentEdge.update({
      where: { id: existing.id },
      data: {
        targetPremiseId,
        cqKey: spec.cqKey,
        attackType: (spec.attackType as any) ?? null,
      },
    });
    return existing.id;
  }
  const created = await prisma.argumentEdge.create({
    data: {
      deliberationId: ctx.deliberationId,
      fromArgumentId,
      toArgumentId,
      type: spec.type as any,
      targetScope,
      targetPremiseId,
      cqKey: spec.cqKey,
      attackType: (spec.attackType as any) ?? null,
      createdById: authorId,
    },
    select: { id: true },
  });
  return created.id;
}

async function upsertClaimEdge(ctx: RuntimeCtx, spec: ClaimEdgeSpec) {
  const fromId = ctx.state.claims[spec.from];
  const toId = ctx.state.claims[spec.to];
  if (!fromId || !toId) {
    throw new Error(`claimEdge ${spec.from}→${spec.to}: unknown claim key`);
  }
  const attackType = (spec.attackType ?? (spec.type === "supports" ? "SUPPORTS" : "REBUTS")) as any;
  await prisma.claimEdge.upsert({
    where: {
      unique_from_to_type_attack: {
        fromClaimId: fromId,
        toClaimId: toId,
        type: spec.type as any,
        attackType,
      },
    },
    create: {
      fromClaimId: fromId,
      toClaimId: toId,
      type: spec.type as any,
      attackType,
      targetScope: spec.targetScope ?? null,
      deliberationId: ctx.deliberationId,
    },
    update: {
      targetScope: spec.targetScope ?? null,
      deliberationId: ctx.deliberationId,
    },
  });
}

async function insertDialogueMove(
  ctx: RuntimeCtx,
  spec: DialogueMoveSpec,
  index: number
) {
  const targetId =
    spec.target.type === "argument"
      ? ctx.state.arguments[spec.target.key]
      : ctx.state.claims[spec.target.key];
  if (!targetId) {
    throw new Error(
      `dialogueMove[${index}]: unknown ${spec.target.type} key "${spec.target.key}"`
    );
  }
  const actorId = ctx.authorOf(spec.actor);
  const polarity =
    spec.polarity ?? (spec.kind === "WHY" || spec.kind === "RETRACT" ? "O" : "P");
  const sigSrc = `${ctx.deliberationId}:${spec.kind}:${spec.target.type}:${spec.target.key}:${index}`;
  const signature = crypto.createHash("sha1").update(sigSrc, "utf8").digest("hex");

  await prisma.dialogueMove.upsert({
    where: { dm_unique_signature: { deliberationId: ctx.deliberationId, signature } },
    create: {
      deliberationId: ctx.deliberationId,
      targetType: spec.target.type,
      targetId,
      kind: spec.kind,
      type: spec.kind,
      actorId,
      authorId: actorId,
      payload: spec.text ? { text: spec.text } : {},
      signature,
      polarity,
    },
    update: {
      payload: spec.text ? { text: spec.text } : {},
      polarity,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo-honesty check (mirrors cite_argument's standingState classifier)
// ─────────────────────────────────────────────────────────────────────────────

async function honestyCheck(argumentId: string, key: string): Promise<string[]> {
  const failures: string[] = [];
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      conclusionClaimId: true,
      conclusion: {
        select: {
          ClaimEvidence: { select: { contentSha256: true } as any },
        },
      },
    },
  });
  const evidence = (arg?.conclusion?.ClaimEvidence ?? []) as any[];
  const evidenceWithProvenance = evidence.filter((e) => !!e?.contentSha256).length;
  if (evidence.length === 0) {
    failures.push(`${key}: no evidence attached`);
  } else if (evidenceWithProvenance === 0 && process.env.SKIP_PROVENANCE !== "1") {
    failures.push(`${key}: ${evidence.length} evidence items, none with contentSha256`);
  }

  const inboundAttacks = await prisma.argumentEdge.count({
    where: { toArgumentId: argumentId, type: { in: ["rebut", "undercut"] as any } },
  });
  const cqAnswered = await prisma.cQStatus.count({
    where: {
      OR: [
        { argumentId },
        { targetType: "argument" as any, targetId: argumentId },
      ],
      statusEnum: { in: ["SATISFIED", "PARTIALLY_SATISFIED"] as any },
    },
  });
  if (inboundAttacks === 0 && cqAnswered === 0) {
    failures.push(`${key}: untested-default (no attacks, no answered CQs)`);
  }
  return failures;
}

/** An "anchor" is an argument that nobody else uses as a sub-argument backing
 *  one of their premises. Sub-arguments are intentionally exempt from the
 *  honesty bar — they are scaffolding, not headline claims. */
function computeAnchorKeys(spec: ChainSpec): Set<string> {
  const used = new Set<string>();
  for (const a of spec.arguments) {
    for (const p of a.premises ?? []) {
      if (typeof p !== "string" && p.supportArg) used.add(p.supportArg);
    }
  }
  const anchors = new Set<string>();
  for (const a of spec.arguments) if (!used.has(a.key)) anchors.add(a.key);
  return anchors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const { spec: specPath } = parseArgs();
  const raw = readFileSync(specPath, "utf8");
  const spec = parseYaml(raw) as ChainSpec;
  if (!spec?.chainKey) throw new Error(`Spec at ${specPath} missing chainKey`);

  const seedUser = await resolveSeedUser();
  const state = loadState(spec.chainKey);

  console.log(`\n── Seeding chain: ${spec.chainKey} ──`);
  console.log(`   spec: ${basename(specPath)}`);
  console.log(`   seed user: ${seedUser}`);
  if (spec.participants?.length) {
    console.log(`   participants: ${spec.participants.length}`);
    for (const p of spec.participants) {
      console.log(`     · ${p.key} (${p.role ?? "—"}) → ${p.authId}`);
    }
  }
  if (spec.sources?.length) {
    console.log(`   sources: ${spec.sources.length}`);
  }

  const deliberationId = await resolveDeliberation(spec, state, seedUser);
  console.log(`   deliberation: ${deliberationId}`);

  const ctx = buildContext(spec, state, seedUser, deliberationId);

  // 1. Claims (+ claim-level evidence)
  console.log(`\n── 1. Claims (${spec.claims.length}) ──`);
  for (const c of spec.claims) {
    const id = await upsertClaim(c.text, deliberationId, seedUser);
    state.claims[c.key] = id;
    console.log(`   ✓ ${c.key} → ${id}`);
    if (c.evidence?.length) {
      const evIds = await attachClaimEvidence(ctx, id, c.evidence, seedUser);
      console.log(`     · claim-evidence: ${evIds.length} attached, enriching...`);
      await enrichSync(evIds);
    }
  }
  saveState(spec.chainKey, state);

  // 2. Arguments + premises + scheme(s) + evidence + approvals
  console.log(`\n── 2. Arguments (${spec.arguments.length}) ──`);
  for (const a of spec.arguments) {
    const conclusionId = state.claims[a.conclusion];
    if (!conclusionId) throw new Error(`Argument ${a.key}: unknown conclusion claim ${a.conclusion}`);
    const primary = await resolveScheme(a.scheme);
    const authorId = ctx.authorOf(a.author);
    const argId = await upsertArgument(a, conclusionId, deliberationId, authorId, state.arguments[a.key]);
    state.arguments[a.key] = argId;
    console.log(`   ✓ ${a.key} → ${argId}  (author: ${a.author ?? "seed"})`);

    const premiseClaimIds = (a.premises ?? []).map((p) => {
      const key = typeof p === "string" ? p : p.claim;
      const id = state.claims[key];
      if (!id) throw new Error(`Argument ${a.key}: unknown premise claim ${key}`);
      return id;
    });
    await bindPremises(argId, premiseClaimIds);
    console.log(`     · premises: ${premiseClaimIds.length}`);

    await bindScheme(argId, primary.id, true);
    for (const sk of a.secondarySchemes ?? []) {
      const sec = await resolveScheme(sk);
      await bindScheme(argId, sec.id, false);
    }
    console.log(
      `     · schemes: ${primary.key}${
        a.secondarySchemes?.length ? ` (+ ${a.secondarySchemes.join(", ")})` : ""
      }`
    );

    const evidenceIds = await attachClaimEvidence(ctx, conclusionId, a.evidence ?? [], authorId);
    if (evidenceIds.length) {
      console.log(`     · evidence: ${evidenceIds.length} attached, enriching...`);
      await enrichSync(evidenceIds);
    }

    if (a.approvals?.length) {
      await upsertApprovals(ctx, argId, a.approvals);
      console.log(`     · approvals: ${a.approvals.length} (${a.approvals.join(", ")})`);
    }
  }
  saveState(spec.chainKey, state);

  // 2b. Sub-argument premise wiring (now that all argument ids exist):
  // For every premise with `supportArg`, register the sub-argument's conclusion
  // claim as an argument-edge of type `support` targeting the parent argument's
  // matching premise. This makes the chain navigable as a graph.
  let subArgEdgeCount = 0;
  for (const parent of spec.arguments) {
    for (const p of parent.premises ?? []) {
      if (typeof p === "string" || !p.supportArg) continue;
      const childId = state.arguments[p.supportArg];
      const parentId = state.arguments[parent.key];
      if (!childId || !parentId) continue;
      await upsertEdge(
        ctx,
        {
          from: p.supportArg,
          to: parent.key,
          type: "support",
          targetScope: "premise",
          targetPremise: p.claim,
        },
        childId,
        parentId
      );
      subArgEdgeCount++;
    }
  }
  if (subArgEdgeCount > 0) {
    console.log(`\n── 2b. Sub-argument premise edges: ${subArgEdgeCount} ──`);
  }

  // 3. Answered CQs
  if (spec.answeredCQs?.length) {
    console.log(`\n── 3. Answered CQs (${spec.answeredCQs.length}) ──`);
    for (const cq of spec.answeredCQs) {
      const argId = state.arguments[cq.argument];
      if (!argId) throw new Error(`answeredCQ: unknown argument ${cq.argument}`);
      const argSpec = spec.arguments.find((a) => a.key === cq.argument)!;
      await answerCQ(ctx, argId, argSpec.scheme, cq);
      const responseCount =
        cq.responses?.length ?? (cq.response ? 1 : 0);
      console.log(
        `   ✓ ${cq.argument} :: ${cq.cqKey} → ${cq.status ?? "SATISFIED"} (${responseCount} response${
          responseCount === 1 ? "" : "s"
        })`
      );
    }
  }

  // 4. Argument edges (explicit attacks/supports)
  if (spec.edges?.length) {
    console.log(`\n── 4. Argument edges (${spec.edges.length}) ──`);
    for (const e of spec.edges) {
      const fromId = state.arguments[e.from];
      const toId = state.arguments[e.to];
      if (!fromId || !toId) throw new Error(`edge ${e.from}→${e.to}: unknown argument key`);
      await upsertEdge(ctx, e, fromId, toId);
      const scope = e.targetScope ?? "conclusion";
      const tail = e.targetPremise ? ` [${e.targetPremise}]` : "";
      console.log(`   ✓ ${e.from} --${e.type}@${scope}${tail}--> ${e.to}`);
    }
  }

  // 5. Claim edges
  if (spec.claimEdges?.length) {
    console.log(`\n── 5. Claim edges (${spec.claimEdges.length}) ──`);
    for (const ce of spec.claimEdges) {
      await upsertClaimEdge(ctx, ce);
      console.log(`   ✓ ${ce.from} --${ce.type}--> ${ce.to}`);
    }
  }

  // 6. Dialogue moves (Ludics-layer seed)
  if (spec.dialogueMoves?.length) {
    console.log(`\n── 6. Dialogue moves (${spec.dialogueMoves.length}) ──`);
    for (let i = 0; i < spec.dialogueMoves.length; i++) {
      await insertDialogueMove(ctx, spec.dialogueMoves[i], i);
      const m = spec.dialogueMoves[i];
      console.log(`   ✓ [${i}] ${m.kind.padEnd(8)} → ${m.target.type}/${m.target.key}  by ${m.actor ?? "seed"}`);
    }
  }

  // 7. Permalinks
  console.log(`\n── 7. Permalinks ──`);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
  for (const a of spec.arguments) {
    const argId = state.arguments[a.key];
    const pl = await getOrCreatePermalink(argId);
    state.permalinks[a.key] = pl.shortCode;
    console.log(`   ${a.key} → ${baseUrl}/a/${pl.shortCode}`);
  }
  saveState(spec.chainKey, state);

  // 8. Honesty check (anchors only)
  console.log(`\n── 8. Honesty check (anchor arguments must be tested + provenanced) ──`);
  const anchors = computeAnchorKeys(spec);
  const allFailures: string[] = [];
  for (const a of spec.arguments) {
    if (!anchors.has(a.key)) {
      console.log(`   · ${a.key} (sub-argument, skipped)`);
      continue;
    }
    const fails = await honestyCheck(state.arguments[a.key], a.key);
    if (fails.length === 0) {
      console.log(`   ✓ ${a.key}`);
    } else {
      for (const f of fails) {
        console.log(`   ✗ ${f}`);
        allFailures.push(f);
      }
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`   chain:        ${spec.chainKey}`);
  console.log(`   participants: ${spec.participants?.length ?? 0}`);
  console.log(`   sources:      ${spec.sources?.length ?? 0}`);
  console.log(`   claims:       ${Object.keys(state.claims).length}`);
  console.log(`   arguments:    ${Object.keys(state.arguments).length} (anchors: ${anchors.size})`);
  console.log(`   edges:        ${spec.edges?.length ?? 0} arg-edges, ${spec.claimEdges?.length ?? 0} claim-edges`);
  console.log(`   answered CQs: ${spec.answeredCQs?.length ?? 0}`);
  console.log(`   moves:        ${spec.dialogueMoves?.length ?? 0}`);
  console.log(`   permalinks:`);
  for (const [k, code] of Object.entries(state.permalinks)) {
    console.log(`     ${k.padEnd(20)} ${baseUrl}/a/${code}`);
  }
  console.log(`   state file:   ${stateFilePath(spec.chainKey)}`);

  if (allFailures.length > 0) {
    console.log(`\n${allFailures.length} honesty-check failure(s) — chain is NOT demo-ready.`);
    process.exit(1);
  }
  console.log(`\nChain is demo-ready: every anchor argument has tested standing and provenanced evidence.`);
  process.exit(0);
}

main().catch((e) => {
  console.error("\nseed-showcase-chain failed:", e?.stack ?? e);
  process.exit(1);
});
