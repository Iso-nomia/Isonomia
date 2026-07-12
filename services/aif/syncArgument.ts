/**
 * services/aif/syncArgument.ts
 *
 * Shared helper that backfills the AIF graph (AifNode / AifEdge) from a single
 * Argument row plus its ArgumentPremise + Claim children. Used both by:
 *
 *   • scripts/backfill-aif-from-arguments.ts (one-shot, per deliberation)
 *   • app/api/arguments/route.ts             (runtime, at ASSERT-DM creation)
 *
 * Contract — for one Argument we ensure:
 *   (a) exactly one RA AifNode  (key: dialogueMetadata.argumentId === argumentId)
 *   (b) one I  AifNode per Claim referenced as premise or conclusion
 *       (key: dialogueMetadata.claimId === claimId, scoped per deliberation)
 *   (c) one AifEdge { I_premise → RA, edgeRole: "premise" }    per ArgumentPremise
 *   (d) one AifEdge { RA → I_conclusion, edgeRole: "conclusion" } (if conclusionClaimId)
 *   (e) one AifEdge { DM_stub → RA, edgeRole: "asserts", causedByMoveId: dmId }
 *       for every DialogueMove whose payload.argumentId matches.
 *       The DM-stub AifNode (nodeKind = "DM") is ensured if missing.
 *
 * Stable keys
 * ───────────
 *   AifNode has no FK to Argument/Claim and no unique constraint we can
 *   piggy-back on, so idempotency is enforced via `findFirst` on
 *   `dialogueMetadata` JSON paths — matching the convention already used by
 *   `packages/ludics-engine/aif-sync.ts` and `scripts/add-dialogue-aif-links.ts`.
 *   For edges, we look up the (sourceId, targetId, edgeRole) triple before
 *   inserting.
 *
 * T4 invariant: this helper only reads the Argument layer (authorId is fine);
 * it never reads `participantId` off any Ludics table.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prismaclient";
import { AIF_VERSION_STAMP } from "@/lib/aif/version";

export const ARGUMENT_AIF_EDGE_ROLES = {
  PREMISE: "premise",
  CONCLUSION: "conclusion",
  ASSERTS: "asserts",
} as const;

type Tx = PrismaClient | Prisma.TransactionClient;

export interface SyncArgumentResult {
  argumentId: string;
  deliberationId: string;
  raNodeId: string;
  raNodeCreated: boolean;
  iNodesCreated: number;
  iNodesSkipped: number;
  premiseEdgesCreated: number;
  premiseEdgesSkipped: number;
  conclusionEdgesCreated: number;
  conclusionEdgesSkipped: number;
  assertsEdgesCreated: number;
  assertsEdgesSkipped: number;
  dmStubsCreated: number;
}

/**
 * Optional pre-loaded lookup maps for a single deliberation. When supplied,
 * the helper skips its JSON-path `findFirst` queries (which seq-scan AifNode
 * and DialogueMove because `dialogueMetadata` / `payload` are unindexed) and
 * uses the caches instead. Backfill builds these once; runtime callers omit.
 *
 * Created rows are pushed back into the caches so a batch loop converges to
 * an idempotent state without round-tripping after every insert.
 */
export interface SyncArgumentCaches {
  raByArgumentId: Map<string, string>;
  iByClaimId: Map<string, string>;
  dmStubByMoveId: Map<string, string>;
  /** Key: `${sourceId}|${targetId}|${edgeRole}` */
  edgeTriples: Set<string>;
  /** All DMs whose payload.argumentId matches, grouped by argumentId. */
  dmsByArgumentId: Map<string, string[]>;
  /** Existing DialogueMove.aifRepresentation values, by moveId. */
  aifReprByMoveId: Map<string, string | null>;
  /** Pre-loaded Argument rows (with premises) keyed by id. */
  argumentById?: Map<
    string,
    {
      id: string;
      deliberationId: string;
      text: string | null;
      schemeId: string | null;
      conclusionClaimId: string | null;
      premises: { claimId: string }[];
    }
  >;
  /** Pre-loaded Claim text keyed by claim id. */
  claimTextById?: Map<string, string | null>;
}

export interface SyncArgumentOptions {
  argumentId: string;
  /** Optional Prisma client / transaction handle. Defaults to the singleton. */
  tx?: Tx;
  /**
   * If provided, the `asserts` edge for this DialogueMove is created right
   * now (in addition to the deliberation-wide scan, which still runs).
   * Pass this from the API path that has just written the ASSERT DM, so the
   * triple is observable in the same transaction.
   */
  dialogueMoveId?: string;
  /** When true, no writes happen; counts reflect what would be created. */
  dryRun?: boolean;
  /** Pre-loaded caches (see `buildSyncArgumentCaches`). */
  caches?: SyncArgumentCaches;
}

/**
 * Build per-deliberation lookup maps in 5 bulk queries. Use this from
 * backfill scripts to amortize the JSON-path scan cost across N arguments.
 */
export async function buildSyncArgumentCaches(
  deliberationId: string,
  tx: Tx = defaultPrisma,
): Promise<SyncArgumentCaches> {
  const [raNodes, iNodes, dmNodes, edges, dms, args, claims] = await Promise.all([
    tx.aifNode.findMany({
      where: { deliberationId, nodeKind: "RA" },
      select: { id: true, dialogueMetadata: true },
    }),
    tx.aifNode.findMany({
      where: { deliberationId, nodeKind: "I" },
      select: { id: true, dialogueMetadata: true },
    }),
    tx.aifNode.findMany({
      where: { deliberationId, nodeKind: "DM" },
      select: { id: true, dialogueMoveId: true },
    }),
    tx.aifEdge.findMany({
      where: { deliberationId },
      select: { sourceId: true, targetId: true, edgeRole: true },
    }),
    tx.dialogueMove.findMany({
      where: { deliberationId },
      select: { id: true, payload: true, aifRepresentation: true },
    }),
    tx.argument.findMany({
      where: { deliberationId },
      select: {
        id: true,
        deliberationId: true,
        text: true,
        schemeId: true,
        conclusionClaimId: true,
        premises: { select: { claimId: true } },
      },
    }),
    tx.claim.findMany({
      where: { deliberationId },
      select: { id: true, text: true },
    }),
  ]);

  const raByArgumentId = new Map<string, string>();
  for (const n of raNodes) {
    const argId = (n.dialogueMetadata as any)?.argumentId;
    if (typeof argId === "string") raByArgumentId.set(argId, n.id);
  }
  const iByClaimId = new Map<string, string>();
  for (const n of iNodes) {
    const cid = (n.dialogueMetadata as any)?.claimId;
    if (typeof cid === "string") iByClaimId.set(cid, n.id);
  }
  const dmStubByMoveId = new Map<string, string>();
  for (const n of dmNodes) {
    if (n.dialogueMoveId) dmStubByMoveId.set(n.dialogueMoveId, n.id);
  }
  const edgeTriples = new Set<string>();
  for (const e of edges) edgeTriples.add(`${e.sourceId}|${e.targetId}|${e.edgeRole}`);

  const dmsByArgumentId = new Map<string, string[]>();
  const aifReprByMoveId = new Map<string, string | null>();
  for (const m of dms) {
    aifReprByMoveId.set(m.id, m.aifRepresentation ?? null);
    const argId = (m.payload as any)?.argumentId;
    if (typeof argId === "string") {
      const arr = dmsByArgumentId.get(argId);
      if (arr) arr.push(m.id);
      else dmsByArgumentId.set(argId, [m.id]);
    }
  }

  return {
    raByArgumentId,
    iByClaimId,
    dmStubByMoveId,
    edgeTriples,
    dmsByArgumentId,
    aifReprByMoveId,
    argumentById: new Map(args.map((a) => [a.id, a])),
    claimTextById: new Map(claims.map((c) => [c.id, c.text])),
  };
}

function emptyResult(argumentId: string, deliberationId: string, raNodeId: string): SyncArgumentResult {
  return {
    argumentId,
    deliberationId,
    raNodeId,
    raNodeCreated: false,
    iNodesCreated: 0,
    iNodesSkipped: 0,
    premiseEdgesCreated: 0,
    premiseEdgesSkipped: 0,
    conclusionEdgesCreated: 0,
    conclusionEdgesSkipped: 0,
    assertsEdgesCreated: 0,
    assertsEdgesSkipped: 0,
    dmStubsCreated: 0,
  };
}

async function ensureRaNode(
  tx: Tx,
  argumentId: string,
  deliberationId: string,
  argText: string | null,
  schemeId: string | null,
  dryRun: boolean,
  caches?: SyncArgumentCaches,
): Promise<{ id: string; created: boolean }> {
  if (caches) {
    const hit = caches.raByArgumentId.get(argumentId);
    if (hit) return { id: hit, created: false };
  } else {
    const existing = await tx.aifNode.findFirst({
      where: {
        deliberationId,
        nodeKind: "RA",
        dialogueMetadata: { path: ["argumentId"], equals: argumentId },
      },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };
  }
  if (dryRun) {
    const id = `dry:RA:${argumentId}`;
    caches?.raByArgumentId.set(argumentId, id);
    return { id, created: true };
  }

  const node = await tx.aifNode.create({
    data: {
      deliberationId,
      nodeKind: "RA",
      nodeSubtype: "inference",
      label: (argText ?? "Argument").substring(0, 50),
      text: argText,
      schemeKey: schemeId ?? null,
      dialogueMetadata: {
        argumentId,
        sourceArgumentId: argumentId,
        createdBy: "syncArgument",
        createdAt: new Date().toISOString(),
        aifVersion: AIF_VERSION_STAMP.aifVersion,
        meshAifProfile: AIF_VERSION_STAMP.meshAifProfile,
      },
    },
    select: { id: true },
  });
  caches?.raByArgumentId.set(argumentId, node.id);
  return { id: node.id, created: true };
}

async function ensureINode(
  tx: Tx,
  claimId: string,
  deliberationId: string,
  claimText: string | null,
  dryRun: boolean,
  caches?: SyncArgumentCaches,
): Promise<{ id: string; created: boolean }> {
  if (caches) {
    const hit = caches.iByClaimId.get(claimId);
    if (hit) return { id: hit, created: false };
  } else {
    const existing = await tx.aifNode.findFirst({
      where: {
        deliberationId,
        nodeKind: "I",
        dialogueMetadata: { path: ["claimId"], equals: claimId },
      },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };
  }
  if (dryRun) {
    const id = `dry:I:${claimId}`;
    caches?.iByClaimId.set(claimId, id);
    return { id, created: true };
  }

  const node = await tx.aifNode.create({
    data: {
      deliberationId,
      nodeKind: "I",
      nodeSubtype: "proposition",
      label: (claimText ?? "Claim").substring(0, 50),
      text: claimText,
      dialogueMetadata: {
        claimId,
        sourceClaimId: claimId,
        createdBy: "syncArgument",
        createdAt: new Date().toISOString(),
        aifVersion: AIF_VERSION_STAMP.aifVersion,
        meshAifProfile: AIF_VERSION_STAMP.meshAifProfile,
      },
    },
    select: { id: true },
  });
  caches?.iByClaimId.set(claimId, node.id);
  return { id: node.id, created: true };
}

async function ensureEdge(
  tx: Tx,
  deliberationId: string,
  sourceId: string,
  targetId: string,
  edgeRole: string,
  causedByMoveId: string | null,
  dryRun: boolean,
  caches?: SyncArgumentCaches,
): Promise<boolean> {
  // Skip lookup if either endpoint is a dry-run placeholder.
  if (sourceId.startsWith("dry:") || targetId.startsWith("dry:")) {
    if (caches) caches.edgeTriples.add(`${sourceId}|${targetId}|${edgeRole}`);
    return true; // count as "would create"
  }
  const key = `${sourceId}|${targetId}|${edgeRole}`;
  if (caches) {
    if (caches.edgeTriples.has(key)) return false;
  } else {
    const where: Prisma.AifEdgeWhereInput = {
      deliberationId,
      sourceId,
      targetId,
      edgeRole,
    };
    if (causedByMoveId) where.causedByMoveId = causedByMoveId;
    const existing = await tx.aifEdge.findFirst({ where, select: { id: true } });
    if (existing) return false;
  }
  if (dryRun) {
    caches?.edgeTriples.add(key);
    return true;
  }
  await tx.aifEdge.create({
    data: {
      deliberationId,
      sourceId,
      targetId,
      edgeRole,
      causedByMoveId: causedByMoveId ?? null,
    },
  });
  caches?.edgeTriples.add(key);
  return true;
}

async function ensureDmStub(
  tx: Tx,
  moveId: string,
  deliberationId: string,
  dryRun: boolean,
  caches?: SyncArgumentCaches,
): Promise<{ id: string; created: boolean } | null> {
  if (caches) {
    const hit = caches.dmStubByMoveId.get(moveId);
    if (hit) return { id: hit, created: false };
    if (!caches.aifReprByMoveId.has(moveId)) return null; // unknown DM
  } else {
    const move = await tx.dialogueMove.findUnique({
      where: { id: moveId },
      select: {
        id: true,
        deliberationId: true,
        kind: true,
        actorId: true,
        createdAt: true,
        aifRepresentation: true,
        replyToMoveId: true,
      },
    });
    if (!move) return null;
    if (move.aifRepresentation) {
      const existing = await tx.aifNode.findUnique({
        where: { id: move.aifRepresentation },
        select: { id: true },
      });
      if (existing) return { id: existing.id, created: false };
    }
    const existingByMove = await tx.aifNode.findFirst({
      where: { deliberationId, nodeKind: "DM", dialogueMoveId: moveId },
      select: { id: true },
    });
    if (existingByMove) return { id: existingByMove.id, created: false };
  }
  if (dryRun) {
    const id = `dry:DM:${moveId}`;
    caches?.dmStubByMoveId.set(moveId, id);
    return { id, created: true };
  }
  // Need DM metadata for the AifNode payload — fetch only on the write path.
  const move = await tx.dialogueMove.findUnique({
    where: { id: moveId },
    select: {
      id: true,
      kind: true,
      actorId: true,
      createdAt: true,
      replyToMoveId: true,
    },
  });
  if (!move) return null;

  const node = await tx.aifNode.create({
    data: {
      deliberationId,
      nodeKind: "DM",
      nodeSubtype: "dialogue_move",
      dialogueMoveId: moveId,
      dialogueMetadata: {
        locution: move.kind ?? null,
        speaker: move.actorId,
        timestamp: move.createdAt.toISOString(),
        ...(move.replyToMoveId ? { replyToMoveId: move.replyToMoveId } : {}),
        createdBy: "syncArgument",
        aifVersion: AIF_VERSION_STAMP.aifVersion,
        meshAifProfile: AIF_VERSION_STAMP.meshAifProfile,
      },
    },
    select: { id: true },
  });
  // Best-effort: also point the DialogueMove at this representation. Failures
  // (e.g. the column being held by another row in a race) are non-fatal — the
  // DM-stub itself is enough for the asserts edge.
  try {
    await tx.dialogueMove.update({
      where: { id: moveId },
      data: { aifRepresentation: node.id },
    });
  } catch {
    /* ignore */
  }
  caches?.dmStubByMoveId.set(moveId, node.id);
  caches?.aifReprByMoveId.set(moveId, node.id);
  return { id: node.id, created: true };
}

/**
 * Sync a single Argument into the AIF graph. Idempotent.
 *
 * If `dialogueMoveId` is supplied, only that DM (plus any other DMs already
 * pointing at the argument) yields an `asserts` edge; the helper still scans
 * the deliberation for other matching DMs so a backfill call without
 * `dialogueMoveId` produces the same final state.
 */
export async function syncArgumentToAif(opts: SyncArgumentOptions): Promise<SyncArgumentResult> {
  const tx: Tx = opts.tx ?? defaultPrisma;
  const dryRun = opts.dryRun === true;

  const arg = opts.caches?.argumentById?.get(opts.argumentId)
    ?? (await tx.argument.findUnique({
      where: { id: opts.argumentId },
      select: {
        id: true,
        deliberationId: true,
        text: true,
        schemeId: true,
        conclusionClaimId: true,
        premises: { select: { claimId: true } },
      },
    }));
  if (!arg) {
    throw new Error(`[syncArgumentToAif] Argument not found: ${opts.argumentId}`);
  }

  const ra = await ensureRaNode(
    tx,
    arg.id,
    arg.deliberationId,
    arg.text ?? null,
    arg.schemeId ?? null,
    dryRun,
    opts.caches,
  );
  const result = emptyResult(arg.id, arg.deliberationId, ra.id);
  result.raNodeCreated = ra.created;

  // Collect claim ids we need I-nodes for.
  const premiseClaimIds = Array.from(new Set(arg.premises.map((p) => p.claimId)));
  const allClaimIds = new Set<string>(premiseClaimIds);
  if (arg.conclusionClaimId) allClaimIds.add(arg.conclusionClaimId);

  const claimRows = allClaimIds.size
    ? (opts.caches?.claimTextById
        ? [...allClaimIds].map((id) => ({ id, text: opts.caches!.claimTextById!.get(id) ?? null }))
        : await tx.claim.findMany({
            where: { id: { in: [...allClaimIds] } },
            select: { id: true, text: true },
          }))
    : [];
  const claimTextById = new Map(claimRows.map((c) => [c.id, c.text]));

  const iNodeIdByClaim = new Map<string, string>();
  for (const cid of allClaimIds) {
    const node = await ensureINode(tx, cid, arg.deliberationId, claimTextById.get(cid) ?? null, dryRun, opts.caches);
    iNodeIdByClaim.set(cid, node.id);
    if (node.created) result.iNodesCreated++;
    else result.iNodesSkipped++;
  }

  // (c) premise edges
  for (const cid of premiseClaimIds) {
    const iId = iNodeIdByClaim.get(cid);
    if (!iId) continue;
    const created = await ensureEdge(
      tx,
      arg.deliberationId,
      iId,
      ra.id,
      ARGUMENT_AIF_EDGE_ROLES.PREMISE,
      null,
      dryRun,
      opts.caches,
    );
    if (created) result.premiseEdgesCreated++;
    else result.premiseEdgesSkipped++;
  }

  // (d) conclusion edge
  if (arg.conclusionClaimId) {
    const iId = iNodeIdByClaim.get(arg.conclusionClaimId);
    if (iId) {
      const created = await ensureEdge(
        tx,
        arg.deliberationId,
        ra.id,
        iId,
        ARGUMENT_AIF_EDGE_ROLES.CONCLUSION,
        null,
        dryRun,
        opts.caches,
      );
      if (created) result.conclusionEdgesCreated++;
      else result.conclusionEdgesSkipped++;
    }
  }

  // (e) asserts edges — from every DM whose payload.argumentId === arg.id.
  // We always scan the deliberation so backfill and runtime paths converge to
  // the same final state. `dialogueMoveId` is treated as a hint to also
  // include that move (covers the same-transaction case where the DM may not
  // yet be visible to a fresh findMany under some isolation levels).
  let dmIdList: string[];
  if (opts.caches) {
    dmIdList = opts.caches.dmsByArgumentId.get(arg.id) ?? [];
  } else {
    const dms = await tx.dialogueMove.findMany({
      where: {
        deliberationId: arg.deliberationId,
        payload: { path: ["argumentId"], equals: arg.id },
      },
      select: { id: true },
    });
    dmIdList = dms.map((m) => m.id);
  }
  const dmIds = new Set<string>(dmIdList);
  if (opts.dialogueMoveId) dmIds.add(opts.dialogueMoveId);

  for (const dmId of dmIds) {
    const stub = await ensureDmStub(tx, dmId, arg.deliberationId, dryRun, opts.caches);
    if (!stub) continue;
    if (stub.created) result.dmStubsCreated++;
    const created = await ensureEdge(
      tx,
      arg.deliberationId,
      stub.id,
      ra.id,
      ARGUMENT_AIF_EDGE_ROLES.ASSERTS,
      dmId,
      dryRun,
      opts.caches,
    );
    if (created) result.assertsEdgesCreated++;
    else result.assertsEdgesSkipped++;
  }

  return result;
}
