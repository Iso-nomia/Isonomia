/**
 * list_bindable_moves — Cluster D helper read.
 *
 * Returns LudicMoves in a deliberation that are eligible targets for
 * `bind_participant_to_design`, optionally constrained to a specific
 * design / behaviour / locus, and (when available) paired with
 * already-existing DialogueMoves that could serve as the witnessing
 * dialogue act.
 *
 * Designed so an agent can execute the full pipeline
 *   get_articulation_lattice → list_bindable_moves → bind_participant_to_design
 * in a single turn: every returned row carries a `ludicMoveId`, a
 * `suggestedCanonicalText`, and (when present) a `dialogueMoveId` that
 * has not yet been used as a witness.
 *
 * T4 invariant: participantId fields from WitnessRecord / DialogueMove are
 * NEVER returned. Callers are expected to supply their own participantId
 * (typically from `LUDICS_PARTICIPANT_ID` on the MCP server) when invoking
 * `bind_participant_to_design`.
 */

import { prisma } from "@/lib/prismaclient";
import { canonicalizeClaimText } from "@/lib/ids/mintMoid";

export interface CandidateDialogueMove {
  /** Use as `dialogueMoveId` in bind_participant_to_design. */
  dialogueMoveId: string;
  /** DialogueMove.kind: ASSERT | WHY | GROUNDS | RETRACT | … */
  kind: string;
  /** Pre-canonicalized text — pass straight to `canonicalText` in bind_participant_to_design. */
  canonicalText: string;
  /** The pre-canonicalization source text (for human review). */
  sourceText: string;
  /** Whether DialogueMove.locusId already matches the LudicMove.locus. */
  locusAlignedExactly: boolean;
}

export interface BindableMove {
  ludicMoveId: string;
  locus: string;
  moveType: string;        // "positive" | "negative" | "daimon"
  stratumLabel: string;    // "walked" | "witnessable" | "latent"
  designId: string | null;
  behaviourId: string | null;
  /**
   * True when an active (non-fossilized) WitnessRecord already exists for
   * this LudicMove. Such moves are NOT bindable a second time and are
   * excluded by default; pass `includeWitnessed: true` to surface them.
   */
  witnessed: boolean;
  /**
   * DialogueMoves in the same deliberation that (a) have not yet been
   * used as a witness in any WitnessRecord (since dialogueMoveId is
   * @unique), and (b) target this LudicMove's locus or carry a
   * canonicalizable payload. Empty when no eligible dialogue acts exist.
   */
  candidateDialogueMoves: CandidateDialogueMove[];
}

export interface ListBindableMovesOptions {
  designId?: string;
  behaviourId?: string;
  locus?: string;
  /** When true, includes moves that already have an active witness. Default false. */
  includeWitnessed?: boolean;
  /** Hard cap on returned rows. Default 50, max 200. */
  limit?: number;
}

export interface ListBindableMovesResult {
  deliberationId: string;
  count: number;
  truncated: boolean;
  bindableMoves: BindableMove[];
}

function extractText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  for (const key of ["text", "brief", "note"] as const) {
    const v = p[key];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

export async function listBindableMoves(
  deliberationId: string,
  options: ListBindableMovesOptions = {},
): Promise<ListBindableMovesResult> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  // ── Resolve design filter ─────────────────────────────────────────────────
  // If behaviourId is supplied, expand to the set of designIds in that behaviour.
  let designIdFilter: string[] | undefined;
  if (options.designId) {
    designIdFilter = [options.designId];
  } else if (options.behaviourId) {
    const designs = await prisma.design.findMany({
      where: { behaviourId: options.behaviourId, deliberationId },
      select: { id: true },
    });
    designIdFilter = designs.map((d) => d.id);
    if (designIdFilter.length === 0) {
      return {
        deliberationId,
        count: 0,
        truncated: false,
        bindableMoves: [],
      };
    }
  }

  // ── Load candidate LudicMoves ─────────────────────────────────────────────
  const ludicMoves = await prisma.ludicMove.findMany({
    where: {
      deliberationId,
      ...(options.locus ? { locus: options.locus } : {}),
      ...(designIdFilter ? { designId: { in: designIdFilter } } : {}),
    },
    select: {
      id: true,
      locus: true,
      moveType: true,
      stratumLabel: true,
      designId: true,
    },
    // Fetch slightly more than `limit` so we can drop witnessed rows before truncation.
    take: limit * 4,
    orderBy: [{ locus: "asc" }, { id: "asc" }],
  });

  if (ludicMoves.length === 0) {
    return { deliberationId, count: 0, truncated: false, bindableMoves: [] };
  }

  // ── Map designId → behaviourId (for designs we just touched) ──────────────
  const designIds = Array.from(
    new Set(ludicMoves.map((m) => m.designId).filter((x): x is string => !!x)),
  );
  const behaviourByDesignId = new Map<string, string>();
  if (designIds.length > 0) {
    const designs = await prisma.design.findMany({
      where: { id: { in: designIds } },
      select: { id: true, behaviourId: true },
    });
    for (const d of designs) behaviourByDesignId.set(d.id, d.behaviourId);
  }

  // ── Witnessed set ─────────────────────────────────────────────────────────
  const witnessedSet = await prisma.witnessRecord
    .findMany({
      where: {
        ludicMoveId: { in: ludicMoves.map((m) => m.id) },
        fossilizedAt: null,
      },
      select: { ludicMoveId: true },
    })
    .then((rows) => new Set(rows.map((r) => r.ludicMoveId)));

  // ── Candidate DialogueMoves (unwitnessed, same deliberation) ──────────────
  // Pull all DialogueMoves in the deliberation with a non-null payload, then
  // exclude those already used as a witness. Filter by locus per LudicMove
  // below. (Scoped narrowly for cost: most deliberations have O(10²) moves.)
  const allDialogueMoves = await prisma.dialogueMove.findMany({
    where: { deliberationId },
    select: {
      id: true,
      kind: true,
      payload: true,
      locusId: true,
    },
    take: 500,
    orderBy: { createdAt: "desc" },
  });

  const witnessedDialogueIds = new Set<string>();
  if (allDialogueMoves.length > 0) {
    const used = await prisma.witnessRecord.findMany({
      where: { dialogueMoveId: { in: allDialogueMoves.map((m) => m.id) } },
      select: { dialogueMoveId: true },
    });
    for (const u of used) witnessedDialogueIds.add(u.dialogueMoveId);
  }

  const unwitnessedDialogueMoves = allDialogueMoves.filter(
    (m) => !witnessedDialogueIds.has(m.id),
  );

  // Index by locus for cheap per-LudicMove lookup. Moves without a locusId
  // are also indexed under the synthetic key "" so we can still surface them
  // as last-resort candidates.
  const dialogueByLocus = new Map<string, typeof unwitnessedDialogueMoves>();
  for (const m of unwitnessedDialogueMoves) {
    const key = m.locusId ?? "";
    const bucket = dialogueByLocus.get(key) ?? [];
    bucket.push(m);
    dialogueByLocus.set(key, bucket);
  }

  // ── Assemble rows ─────────────────────────────────────────────────────────
  const rows: BindableMove[] = [];
  for (const m of ludicMoves) {
    const witnessed = witnessedSet.has(m.id);
    if (witnessed && !options.includeWitnessed) continue;

    const exactCandidates = (dialogueByLocus.get(m.locus) ?? []).map((dm) => ({
      dm,
      aligned: true,
    }));
    // Fall back to dialogue acts with no locusId at all — they may still be
    // canonical-text donors even when the agent has to assign a locus manually.
    const looseCandidates =
      exactCandidates.length > 0
        ? []
        : (dialogueByLocus.get("") ?? []).map((dm) => ({ dm, aligned: false }));

    const candidates: CandidateDialogueMove[] = [...exactCandidates, ...looseCandidates]
      .slice(0, 5)
      .map(({ dm, aligned }) => {
        const sourceText = extractText(dm.payload) ?? "";
        return {
          dialogueMoveId: dm.id,
          kind: dm.kind,
          canonicalText: sourceText ? canonicalizeClaimText(sourceText) : "",
          sourceText,
          locusAlignedExactly: aligned,
        };
      })
      .filter((c) => c.canonicalText.length > 0);

    rows.push({
      ludicMoveId: m.id,
      locus: m.locus,
      moveType: m.moveType,
      stratumLabel: m.stratumLabel,
      designId: m.designId,
      behaviourId: m.designId ? behaviourByDesignId.get(m.designId) ?? null : null,
      witnessed,
      candidateDialogueMoves: candidates,
    });

    if (rows.length >= limit) break;
  }

  return {
    deliberationId,
    count: rows.length,
    truncated: rows.length >= limit && ludicMoves.length > rows.length,
    bindableMoves: rows,
  };
}
