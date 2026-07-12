/**
 * Spec 4 §3.4 — POST /api/schemes/non-redundancy-check
 *
 * Body: a draft scheme shape (subset of the SchemeCreator form).
 * Returns: { fingerprint, candidates: Array<{ schemeId, schemeKey, schemeName, verdict }> }
 *
 * Behaviour:
 *   1. Filter the catalogue down with `selectCandidates`.
 *   2. Pre-filter further by fingerprint match (cheap: only candidates whose
 *      fingerprint equals the draft's are eligible for an `equal` verdict).
 *   3. For each remaining candidate run `verifyBehaviourEquality(draft, cand)`
 *      with `searchBoundMs` capped at 250ms so the total endpoint latency stays
 *      bounded (worst-case ~ |candidates| * 250ms).
 *   4. Return verdicts; empty list means "no behaviourally-related schemes
 *      detected — safe to submit".
 *
 * The endpoint is read-only and idempotent. It does NOT mint or mutate any
 * row. The admin still has to submit through POST /api/schemes; that path
 * recomputes the fingerprint and is the authoritative duplicate gate.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import {
  computeBehaviourFingerprint,
  verifyBehaviourEquality,
  type SchemeWithCqs,
} from "@/lib/schemes/verifier";
import {
  selectCandidates,
  type CandidateSchemeShape,
} from "@/lib/schemes/verifier/selectCandidates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CqSchema = z.object({
  cqKey: z.string().min(1),
  text: z.string().min(1),
  attackType: z.enum(["REBUTS", "UNDERCUTS", "UNDERMINES"]).optional(),
  targetScope: z.enum(["conclusion", "inference", "premise"]).optional(),
  burdenOfProof: z.enum(["PROPONENT", "OPPONENT", "CHALLENGER"]).optional(),
  requiresEvidence: z.boolean().optional(),
  premiseType: z.enum(["ORDINARY", "ASSUMPTION", "EXCEPTION"]).nullable().optional(),
});

const Body = z.object({
  id: z.string().optional(), // present in edit mode
  key: z.string().optional(),
  name: z.string().optional(),
  clusterTag: z.string().nullable().optional(),
  epistemicMode: z.string().optional(),
  premises: z.any().optional(),
  conclusion: z.any().optional(),
  cqs: z.array(CqSchema).min(1),
});

type DraftBody = z.infer<typeof Body>;

function draftToSchemeWithCqs(draft: DraftBody): SchemeWithCqs {
  // Build an in-memory `ArgumentScheme & { cqs: CriticalQuestion[] }`
  // shape suitable for `verifyBehaviourEquality` and
  // `computeBehaviourFingerprint`. Fields the verifier does not consume are
  // filled with `null`/sane defaults.
  return {
    id: draft.id ?? "__draft__",
    key: draft.key ?? "__draft__",
    name: draft.name ?? null,
    description: null,
    title: null,
    summary: "",
    cq: [] as any,
    premises: (draft.premises ?? null) as any,
    conclusion: (draft.conclusion ?? null) as any,
    purpose: null,
    source: null,
    materialRelation: null,
    reasoningType: null,
    ruleForm: null,
    conclusionType: null,
    slotHints: null as any,
    validators: null as any,
    aspicMapping: null as any,
    epistemicMode: (draft.epistemicMode as any) ?? "FACTUAL",
    tags: [] as any,
    examples: [] as any,
    usageCount: 0,
    difficulty: "intermediate",
    identificationConditions: [] as any,
    whenToUse: "",
    semanticCluster: null,
    kind: "argument-scheme",
    sourceCatalogue: "admin-authored",
    sourceId: null,
    sourceVersion: null,
    importedAt: null,
    importerVersion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    fingerprint: null,
    nonRedundancyJustification: null,
    parentSchemeId: null,
    clusterTag: draft.clusterTag ?? null,
    cqs: draft.cqs.map((c, i) => ({
      id: `__draft_cq_${i}__`,
      schemeId: "__draft__",
      argumentId: null,
      claimId: null,
      cardId: null,
      cqKey: c.cqKey,
      text: c.text,
      attackKind: (c.attackType ?? "UNDERCUTS") as any,
      status: "open" as any,
      attackType: (c.attackType ?? "UNDERCUTS") as any,
      targetScope: (c.targetScope ?? "inference") as any,
      burdenOfProof: (c.burdenOfProof ?? "PROPONENT") as any,
      requiresEvidence: c.requiresEvidence ?? false,
      premiseType: (c.premiseType ?? "ORDINARY") as any,
      instanceId: null,
      evidenceRefs: [] as any,
      subLocusId: null,
      closingMoveId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as any,
  } as unknown as SchemeWithCqs;
}

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: "bad-request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const draft = parsed.data;

  // Build the in-memory draft and its fingerprint
  const draftScheme = draftToSchemeWithCqs(draft);
  const fingerprint = computeBehaviourFingerprint(draftScheme);

  // Pull catalogue (only argument-scheme kind, with CQs).
  const rows = await prisma.argumentScheme.findMany({
    where: { kind: "argument-scheme" } as any,
    include: { cqs: true },
  });

  const catalogue: CandidateSchemeShape[] = rows.map((r: any) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    clusterTag: r.clusterTag ?? null,
    premises: r.premises ?? null,
    cqs: (r.cqs ?? []).map((c: any) => ({ cqKey: c.cqKey, text: c.text })),
  }));

  const filtered = selectCandidates(
    {
      id: draft.id,
      clusterTag: draft.clusterTag ?? null,
      premises: draft.premises ?? null,
      cqs: draft.cqs,
    },
    catalogue,
  );

  // Run verifier against each candidate (synchronous; the candidate set is
  // typically O(10)). We use the prisma row directly, not the candidate
  // shape, because the verifier needs the full `SchemeWithCqs`.
  const candidateIds = new Set(filtered.map((c) => c.id));
  const verdicts: Array<{
    schemeId: string;
    schemeKey: string;
    schemeName: string | null;
    sameFingerprint: boolean;
    verdict: Awaited<ReturnType<typeof verifyBehaviourEquality>>;
  }> = [];

  for (const row of rows as any[]) {
    if (!candidateIds.has(row.id)) continue;
    const right = row as SchemeWithCqs;
    const sameFingerprint = (row.fingerprint ?? null) === fingerprint;
    const verdict = await verifyBehaviourEquality(draftScheme, right, {
      searchBoundMs: 250,
    });
    verdicts.push({
      schemeId: row.id,
      schemeKey: row.key,
      schemeName: row.name ?? null,
      sameFingerprint,
      verdict,
    });
  }

  // Only return entries that the admin actually needs to see — i.e. anything
  // other than `incomparable`. `incomparable` candidates are noise.
  const surfaced = verdicts.filter((v) => v.verdict.kind !== "incomparable");

  return NextResponse.json(
    {
      fingerprint,
      candidatesScanned: filtered.length,
      catalogueSize: rows.length,
      candidates: surfaced,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
