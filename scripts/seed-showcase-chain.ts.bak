#!/usr/bin/env tsx
/**
 * Showcase chain seeder
 * ────────────────────────────────────────────────────────────────────────────
 * Reads a hand-authored YAML spec from scripts/showcase/<chainKey>.yaml and
 * idempotently materializes a fully-tested argument chain into the database:
 *
 *   • upserts claims (by content moid)
 *   • creates / connects argument records, premise links, scheme bindings
 *   • creates ClaimEvidence rows and SYNCHRONOUSLY enriches each with
 *     contentSha256 + archive.org snapshot (so the demo doesn't depend on
 *     the background worker having run)
 *   • marks specified critical questions as SATISFIED with a real response
 *   • creates support/rebut/undercut edges between arguments
 *   • mints a permalink for each argument and prints the URLs
 *
 * Idempotency: a sidecar JSON file at scripts/showcase/.state/<chainKey>.json
 * tracks created IDs by spec key. Re-running updates rather than duplicates.
 *
 * Demo-honesty check: after seeding, every argument is run through the same
 * dialectical-fitness criteria the cite_argument MCP tool exposes. The script
 * exits non-zero if any argument would render with standingState="untested-default"
 * or with zero attached evidence — i.e. if the seeded chain would fail the
 * demo's own honesty bar.
 *
 * Usage:
 *   SEED_USER_AUTH_ID=<firebase auth_id> npx tsx scripts/seed-showcase-chain.ts \
 *     --spec scripts/showcase/teen-screens.yaml
 *
 * Env:
 *   SEED_USER_AUTH_ID  required — auth_id (Firebase id) of the seeding user
 *   SEED_DELIB_ID      optional — reuse an existing deliberation id
 *   SKIP_PROVENANCE    optional — set to "1" to skip the live evidence fetch
 *                                 (useful for offline development)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve, basename } from "path";
import { parse as parseYaml } from "yaml";
import { prisma } from "@/lib/prismaclient";
import { mintClaimMoid } from "@/lib/ids/mintMoid";
import { getOrCreatePermalink } from "@/lib/citations/permalinkService";
import { enrichEvidenceProvenance } from "@/lib/citations/evidenceProvenance";

// ─────────────────────────────────────────────────────────────────────────────
// Spec types — mirror the YAML shape
// ─────────────────────────────────────────────────────────────────────────────

interface ClaimSpec {
  key: string;
  text: string;
}

interface EvidenceSpec {
  url: string;
  title?: string;
  quote?: string;
}

interface ArgumentSpec {
  key: string;
  conclusion: string; // claim key
  scheme: string; // scheme key (e.g. "expert_opinion")
  text: string;
  premises?: string[]; // claim keys
  evidence?: EvidenceSpec[];
}

interface AnsweredCQSpec {
  argument: string;
  cqKey: string;
  response: string;
}

interface EdgeSpec {
  from: string;
  to: string;
  type: "support" | "rebut" | "undercut";
  note?: string;
}

interface ChainSpec {
  chainKey: string;
  deliberationTitle: string;
  deliberationDescription?: string;
  claims: ClaimSpec[];
  arguments: ArgumentSpec[];
  answeredCQs?: AnsweredCQSpec[];
  edges?: EdgeSpec[];
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
// Seeding logic
// ─────────────────────────────────────────────────────────────────────────────

async function resolveSeedUser(): Promise<string> {
  const authId = process.env.SEED_USER_AUTH_ID?.trim();
  if (!authId) {
    throw new Error(
      "SEED_USER_AUTH_ID env var required (auth_id / Firebase id of the seeding user)"
    );
  }
  // The Argument.authorId / ClaimEvidence.addedById / CQStatus.createdById
  // fields throughout the codebase are stored as the raw auth_id string,
  // not the User table primary key. We don't need a User row lookup here.
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

async function upsertClaim(
  text: string,
  deliberationId: string,
  userId: string
): Promise<string> {
  const moid = mintClaimMoid(text);
  const row = await prisma.claim.upsert({
    where: { moid },
    create: {
      text,
      moid,
      createdById: userId,
      deliberationId,
    },
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
  userId: string,
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
          lastUpdatedAt: new Date(),
        },
      });
      return existingId;
    }
  }
  const created = await prisma.argument.create({
    data: {
      deliberationId,
      authorId: userId,
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
  // Replace the premise set wholesale to keep the seed declarative.
  await prisma.argumentPremise.deleteMany({ where: { argumentId } });
  if (premiseClaimIds.length === 0) return;
  await prisma.argumentPremise.createMany({
    data: premiseClaimIds.map((claimId) => ({ argumentId, claimId })),
    skipDuplicates: true,
  });
}

async function bindPrimaryScheme(argumentId: string, schemeId: string) {
  // De-mark any prior primary scheme for this argument, then upsert ours.
  await prisma.argumentSchemeInstance.updateMany({
    where: { argumentId, isPrimary: true, NOT: { schemeId } },
    data: { isPrimary: false },
  });
  await prisma.argumentSchemeInstance.upsert({
    where: { argumentId_schemeId: { argumentId, schemeId } },
    create: {
      argumentId,
      schemeId,
      isPrimary: true,
      role: "primary",
      explicitness: "explicit",
      confidence: 1.0,
    },
    update: { isPrimary: true, role: "primary" },
  });
}

async function attachEvidence(
  conclusionClaimId: string,
  evidence: EvidenceSpec[],
  userId: string
): Promise<string[]> {
  if (evidence.length === 0) return [];
  await prisma.claimEvidence.createMany({
    data: evidence.map((ev) => ({
      claimId: conclusionClaimId,
      uri: ev.url,
      title: ev.title ?? null,
      citation: ev.quote ?? null,
      addedById: userId,
    })),
    skipDuplicates: true,
  });
  const rows = await prisma.claimEvidence.findMany({
    where: {
      claimId: conclusionClaimId,
      uri: { in: evidence.map((e) => e.url) },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function enrichSync(evidenceIds: string[]) {
  if (process.env.SKIP_PROVENANCE === "1") {
    console.log(`    (—) SKIP_PROVENANCE=1, leaving evidence unhashed`);
    return;
  }
  // Bounded concurrency: 4 in flight at a time so we don't hammer the
  // network or archive.org's rate limit.
  const queue = [...evidenceIds];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length > 0) {
      const id = queue.shift()!;
      try {
        await enrichEvidenceProvenance(id, { archive: true });
      } catch (e: any) {
        console.warn(`    (!) provenance enrichment failed for ${id}: ${e?.message ?? e}`);
      }
    }
  });
  await Promise.all(workers);
}

async function answerCQ(
  argumentId: string,
  schemeKey: string,
  cqKey: string,
  responseText: string,
  userId: string,
  deliberationId: string
) {
  // Look up scheme + CQ catalog entry (informational; the CQStatus row keys
  // by schemeKey + cqKey strings, not by FK).
  const cqDef = await prisma.criticalQuestion.findFirst({
    where: { scheme: { key: schemeKey }, cqKey },
    select: { id: true, text: true },
  });
  if (!cqDef) {
    console.warn(
      `    (!) cqKey "${cqKey}" not found in scheme "${schemeKey}" catalog \u2014 creating CQStatus anyway`
    );
  }

  const status = await prisma.cQStatus.upsert({
    where: {
      targetType_targetId_schemeKey_cqKey: {
        targetType: "argument" as any,
        targetId: argumentId,
        schemeKey,
        cqKey,
      },
    },
    create: {
      targetType: "argument" as any,
      targetId: argumentId,
      argumentId,
      schemeKey,
      cqKey,
      statusEnum: "SATISFIED" as any,
      satisfied: true,
      groundsText: responseText,
      createdById: userId,
      roomId: deliberationId,
      lastReviewedAt: new Date(),
      lastReviewedBy: userId,
    },
    update: {
      statusEnum: "SATISFIED" as any,
      satisfied: true,
      groundsText: responseText,
      lastReviewedAt: new Date(),
      lastReviewedBy: userId,
    },
    select: { id: true },
  });

  // Attach a CQResponse marked APPROVED so multi-response consumers see it
  // as the canonical answer.
  const existingResponse = await prisma.cQResponse.findFirst({
    where: { cqStatusId: status.id, contributorId: userId },
    select: { id: true },
  });
  let responseId: string;
  if (existingResponse) {
    await prisma.cQResponse.update({
      where: { id: existingResponse.id },
      data: { groundsText: responseText, responseStatus: "APPROVED" as any, reviewedAt: new Date(), reviewedBy: userId },
    });
    responseId = existingResponse.id;
  } else {
    const created = await prisma.cQResponse.create({
      data: {
        cqStatusId: status.id,
        groundsText: responseText,
        responseStatus: "APPROVED" as any,
        contributorId: userId,
        evidenceClaimIds: [],
        sourceUrls: [],
        reviewedAt: new Date(),
        reviewedBy: userId,
      },
      select: { id: true },
    });
    responseId = created.id;
  }
  await prisma.cQStatus.update({
    where: { id: status.id },
    data: { canonicalResponseId: responseId },
  });
}

async function upsertEdge(
  fromArgumentId: string,
  toArgumentId: string,
  type: EdgeSpec["type"],
  deliberationId: string,
  userId: string
) {
  const existing = await prisma.argumentEdge.findFirst({
    where: { fromArgumentId, toArgumentId, type: type as any },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.argumentEdge.create({
    data: {
      deliberationId,
      fromArgumentId,
      toArgumentId,
      type: type as any,
      createdById: userId,
    },
    select: { id: true },
  });
  return created.id;
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

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const { spec: specPath } = parseArgs();
  const raw = readFileSync(specPath, "utf8");
  const spec = parseYaml(raw) as ChainSpec;
  if (!spec?.chainKey) throw new Error(`Spec at ${specPath} missing chainKey`);

  const userId = await resolveSeedUser();
  const state = loadState(spec.chainKey);

  console.log(`\n── Seeding chain: ${spec.chainKey} ──`);
  console.log(`   spec: ${basename(specPath)}`);
  console.log(`   user: ${userId}`);

  const deliberationId = await resolveDeliberation(spec, state, userId);
  console.log(`   deliberation: ${deliberationId}`);

  // 1. Claims
  console.log(`\n── 1. Claims (${spec.claims.length}) ──`);
  for (const c of spec.claims) {
    const id = await upsertClaim(c.text, deliberationId, userId);
    state.claims[c.key] = id;
    console.log(`   ✓ ${c.key} → ${id}`);
  }
  saveState(spec.chainKey, state);

  // 2. Arguments + premises + scheme + evidence
  console.log(`\n── 2. Arguments (${spec.arguments.length}) ──`);
  for (const a of spec.arguments) {
    const conclusionId = state.claims[a.conclusion];
    if (!conclusionId) throw new Error(`Argument ${a.key}: unknown conclusion claim ${a.conclusion}`);
    const scheme = await resolveScheme(a.scheme);
    const argId = await upsertArgument(a, conclusionId, deliberationId, userId, state.arguments[a.key]);
    state.arguments[a.key] = argId;
    console.log(`   ✓ ${a.key} → ${argId}`);

    const premiseClaimIds = (a.premises ?? []).map((pk) => {
      const id = state.claims[pk];
      if (!id) throw new Error(`Argument ${a.key}: unknown premise claim ${pk}`);
      return id;
    });
    await bindPremises(argId, premiseClaimIds);
    console.log(`     · premises: ${premiseClaimIds.length}`);

    await bindPrimaryScheme(argId, scheme.id);
    console.log(`     · scheme: ${scheme.key}`);

    const evidenceIds = await attachEvidence(conclusionId, a.evidence ?? [], userId);
    console.log(`     · evidence: ${evidenceIds.length} attached, enriching...`);
    await enrichSync(evidenceIds);
  }
  saveState(spec.chainKey, state);

  // 3. Answered CQs
  if (spec.answeredCQs?.length) {
    console.log(`\n── 3. Answered CQs (${spec.answeredCQs.length}) ──`);
    for (const cq of spec.answeredCQs) {
      const argId = state.arguments[cq.argument];
      if (!argId) throw new Error(`answeredCQ: unknown argument ${cq.argument}`);
      const argSpec = spec.arguments.find((a) => a.key === cq.argument)!;
      await answerCQ(argId, argSpec.scheme, cq.cqKey, cq.response, userId, deliberationId);
      console.log(`   ✓ ${cq.argument} :: ${cq.cqKey} → SATISFIED`);
    }
  }

  // 4. Edges
  if (spec.edges?.length) {
    console.log(`\n── 4. Edges (${spec.edges.length}) ──`);
    for (const e of spec.edges) {
      const fromId = state.arguments[e.from];
      const toId = state.arguments[e.to];
      if (!fromId || !toId) throw new Error(`edge ${e.from}→${e.to}: unknown argument key`);
      await upsertEdge(fromId, toId, e.type, deliberationId, userId);
      console.log(`   ✓ ${e.from} --${e.type}--> ${e.to}`);
    }
  }

  // 5. Permalinks
  console.log(`\n── 5. Permalinks ──`);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";
  for (const a of spec.arguments) {
    const argId = state.arguments[a.key];
    const pl = await getOrCreatePermalink(argId);
    state.permalinks[a.key] = pl.shortCode;
    console.log(`   ${a.key} → ${baseUrl}/a/${pl.shortCode}`);
  }
  saveState(spec.chainKey, state);

  // 6. Honesty check
  console.log(`\n── 6. Honesty check (each anchor must be tested + provenanced) ──`);
  const allFailures: string[] = [];
  for (const a of spec.arguments) {
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
  console.log(`   chain: ${spec.chainKey}`);
  console.log(`   claims: ${Object.keys(state.claims).length}`);
  console.log(`   arguments: ${Object.keys(state.arguments).length}`);
  console.log(`   permalinks: ${Object.values(state.permalinks).map((s) => baseUrl + "/a/" + s).join("\n              ")}`);
  console.log(`   state file: ${stateFilePath(spec.chainKey)}`);

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
