/**
 * orchestrator/translators/argument-mint.ts
 *
 * Materializes a validated `AdvocateOutput` (Phase 2) onto the live
 * deliberation. For each argument:
 *
 *   1. Mint each premise text as an EMPIRICAL Claim (deduped by
 *      moid via the in-process `ClaimRegistry`; identical premise text
 *      across advocates / rounds collapses to a single canonical Claim).
 *   2. Resolve `conclusionClaimIndex` → conclusion claimId via the
 *      Phase-1 `indexToClaimId` map (caller supplies it).
 *   3. Resolve `schemeKey` → `schemeId` via a one-shot scheme catalog
 *      fetch (cached on the translator instance).
 *   4. POST /api/arguments to create the Argument + ArgumentPremise rows
 *      + ArgumentSchemeInstance + ArgumentSupport bootstrap +
 *      DialogueMove ASSERT (the route does all of this in one call).
 *   5. For each premise's `citationToken`, resolve token → sourceId via
 *      the bound evidence corpus and POST /api/citations/attach to bind
 *      the Source to the Argument with `intent: "supports"`.
 *
 * Idempotency:
 *   - Premise Claim mints dedupe by server-side moid.
 *   - `POST /api/arguments` is NOT inherently idempotent (it creates a new
 *     Argument every call). The orchestrator-level Phase 2 driver checks
 *     `runtime/PHASE_2_PARTIAL.json` before re-running an advocate to avoid
 *     duplicate argument creation on retry.
 *   - `POST /api/citations/attach` is idempotent on (targetType, targetId,
 *     sourceId, locator) — server returns existing row on dup.
 *
 * Author signing:
 *   - Each advocate signs its own argument writes ("advocate-a" / "advocate-b").
 *   - Premise Claim mints are signed by the same advocate (so ownership of
 *     the canonical premise claim falls to whichever advocate first asserted
 *     it; this matches the platform's normal user-mints-claim semantics).
 */

import type { IsonomiaClient, IsonomiaCallContext } from "../isonomia-client";
import type { RoundLogger } from "../log/round-logger";
import { agentByRole } from "../config";
import type { OrchestratorConfig } from "../config";
import type { AdvocateOutput, AdvocateArgument } from "../agents/advocate-schema";
import { ClaimRegistry, resolvePremiseClaimIds } from "./claim-mint";
import { prisma } from "@/lib/prismaclient";

export interface ArgumentMintResult {
  /** Per-input-argument result row (in input order). */
  arguments: Array<{
    /** Index in the input AdvocateOutput.arguments array. */
    inputIndex: number;
    argumentId: string;
    conclusionClaimIndex: number;
    conclusionClaimId: string;
    schemeKey: string;
    schemeId: string;
    premiseClaimIds: string[];
    citations: Array<{ sourceId: string; citationId: string; citationToken: string }>;
    /** Premises whose citationToken was null (no citation attached). */
    uncitedPremiseTexts: string[];
  }>;
  /** Aggregate counters for finalize / logging. */
  totals: {
    argumentsCreated: number;
    premiseClaimsMinted: number;
    premiseClaimsDeduped: number;
    citationsAttached: number;
  };
}

export interface TranslateAdvocateOpts {
  output: AdvocateOutput;
  deliberationId: string;
  iso: IsonomiaClient;
  logger: RoundLogger;
  cfg: OrchestratorConfig;

  /** Phase-1 sub-claim index → claimId map (from PHASE_1_COMPLETE.json). */
  indexToClaimId: Record<number, string>;

  /**
   * Citation token (`src:<id>`) → sourceId map, derived from the bound
   * evidence corpus via `iso.getEvidenceContext()`. Each source object
   * carries a `citationToken` field — build the map once at the
   * Phase-2 driver level and reuse it across both advocates.
   */
  tokenToSourceId: Record<string, string>;

  /**
   * Premise-claim registry. Pass a single registry across both advocates
   * within a round so identical premise text collapses to one Claim.
   */
  registry: ClaimRegistry;

  /** Author role for write signing. Required: must be "advocate-a" or "advocate-b". */
  authorRole: "advocate-a" | "advocate-b";

  /**
   * Optional pre-fetched scheme catalog. If omitted, the translator fetches
   * `/api/schemes` itself on first call and caches the result.
   */
  schemeCatalog?: Array<{ id: string; key: string }>;

  /**
   * Loosened-mode evidence stack id. Required when the output may carry
   * `webCitations` — the translator lazily materializes each web citation
   * as a Source on this stack before resolving premise tokens. Pass the
   * value from `cfg.deliberation.evidenceStackId`.
   */
  stackId?: string | null;
}

export async function translateAdvocateOutput(opts: TranslateAdvocateOpts): Promise<ArgumentMintResult> {
  const ctx: IsonomiaCallContext = { role: opts.authorRole, logger: opts.logger };
  const author = agentByRole(opts.cfg, opts.authorRole);

  // 0. Drop orphan Arguments left behind by a prior crashed mint for this
  //    (deliberation, advocate). Phase 2 has no partial-resume — every run
  //    re-mints from scratch — so any pre-existing rows authored by this bot
  //    in this delib are stale and would otherwise inflate DB counts vs.
  //    PHASE_2_COMPLETE.json provenance.
  const orphanDelete = await prisma.argument.deleteMany({
    where: { deliberationId: opts.deliberationId, authorId: String(author.userId) },
  });
  if (orphanDelete.count > 0) {
    opts.logger.event("orphan_cleanup", {
      step: "argument-mint",
      advocate: opts.authorRole,
      droppedArguments: orphanDelete.count,
    });
  }

  // 0.5 Loosened-mode: materialize any `webCitations` declared in this
  //     output as Sources on the bound stack, and merge their tokens into
  //     `tokenToSourceId` so the per-premise resolution check below can
  //     find them. No-op when no web citations were declared.
  let tokenToSourceId = opts.tokenToSourceId;
  const webCitations = (opts.output as any).webCitations as
    | import("../agents/advocate-schema").WebCitation[]
    | undefined;
  if (webCitations && webCitations.length > 0) {
    const materialized = await materializeWebCitations({
      iso: opts.iso,
      ctx,
      stackId: opts.stackId ?? null,
      webCitations,
      logger: opts.logger,
    });
    tokenToSourceId = { ...opts.tokenToSourceId, ...materialized };
  }

  // 1. Resolve scheme catalog → key→id map.
  const catalog = opts.schemeCatalog ?? (await opts.iso.listSchemes(opts.authorRole, opts.logger));
  const schemeIdByKey = new Map<string, string>();
  for (const s of catalog) schemeIdByKey.set(s.key, s.id);

  // Pre-flight: every schemeKey in this output must resolve. (The Zod schema
  // already enforced membership in EXPERIMENT_SCHEME_KEYS; here we verify the
  // server-side row exists. This is a defense-in-depth check against a
  // stale catalog or a pre-seed run.)
  const missingSchemes = new Set<string>();
  for (const a of opts.output.arguments) {
    if (!schemeIdByKey.has(a.schemeKey)) missingSchemes.add(a.schemeKey);
  }
  if (missingSchemes.size > 0) {
    throw new Error(
      `argument-mint: scheme catalog missing keys [${[...missingSchemes].join(", ")}]; run scripts/seed-experiment-schemes.ts`,
    );
  }

  // 2. Pre-flight: every conclusionClaimIndex must resolve, and every
  //    citationToken must resolve.
  const missingIndices = new Set<number>();
  const missingTokens = new Set<string>();
  for (const a of opts.output.arguments) {
    if (!opts.indexToClaimId[a.conclusionClaimIndex]) missingIndices.add(a.conclusionClaimIndex);
    for (const p of a.premises) {
      if (p.citationToken && !tokenToSourceId[p.citationToken]) missingTokens.add(p.citationToken);
    }
  }
  if (missingIndices.size > 0) {
    throw new Error(
      `argument-mint: indexToClaimId map missing indices [${[...missingIndices].join(", ")}]; check PHASE_1_COMPLETE.json`,
    );
  }
  if (missingTokens.size > 0) {
    throw new Error(
      `argument-mint: tokenToSourceId map missing tokens [${[...missingTokens].join(", ")}]; check evidence-context binding`,
    );
  }

  const sizeBefore = opts.registry.size();
  const results: ArgumentMintResult["arguments"] = [];
  let citationsAttached = 0;

  for (let i = 0; i < opts.output.arguments.length; i++) {
    const arg = opts.output.arguments[i];
    const conclusionClaimId = opts.indexToClaimId[arg.conclusionClaimIndex];
    const schemeId = schemeIdByKey.get(arg.schemeKey)!;

    const argResult = await mintOneArgument({
      arg,
      inputIndex: i,
      conclusionClaimId,
      schemeId,
      tokenToSourceId: tokenToSourceId,
      registry: opts.registry,
      iso: opts.iso,
      ctx,
      deliberationId: opts.deliberationId,
      authorId: String(author.userId),
      logger: opts.logger,
    });

    results.push(argResult);
    citationsAttached += argResult.citations.length;
  }

  const sizeAfter = opts.registry.size();

  // Note: the registry doesn't track dedup hits directly, but `size grew by
  // M < total premises` implies dedup. We approximate by counting unique
  // texts seen this turn.
  const totalPremiseTextsSeen = opts.output.arguments.reduce((n, a) => n + a.premises.length, 0);
  const premiseClaimsMinted = sizeAfter - sizeBefore;
  const premiseClaimsDeduped = totalPremiseTextsSeen - premiseClaimsMinted;

  const totals = {
    argumentsCreated: results.length,
    premiseClaimsMinted,
    premiseClaimsDeduped,
    citationsAttached,
  };

  opts.logger.event("round_summary", {
    step: "argument-mint",
    advocate: opts.authorRole,
    ...totals,
  });

  return { arguments: results, totals };
}

// ─────────────────────────────────────────────────────────────────
// Per-argument minting
// ─────────────────────────────────────────────────────────────────

interface MintOneOpts {
  arg: AdvocateArgument;
  inputIndex: number;
  conclusionClaimId: string;
  schemeId: string;
  tokenToSourceId: Record<string, string>;
  registry: ClaimRegistry;
  iso: IsonomiaClient;
  ctx: IsonomiaCallContext;
  deliberationId: string;
  authorId: string;
  logger: RoundLogger;
}

async function mintOneArgument(opts: MintOneOpts): Promise<ArgumentMintResult["arguments"][number]> {
  // 1. Mint premise claims (deduped via registry / server moid).
  const premiseTexts = opts.arg.premises.map((p) => p.text);
  const premiseClaimIds = await resolvePremiseClaimIds({
    iso: opts.iso,
    ctx: opts.ctx,
    deliberationId: opts.deliberationId,
    registry: opts.registry,
    premiseTexts,
    defaultClaimType: "EMPIRICAL",
  });

  // 2. Build the canonical argument text — concatenate premises + warrant.
  //    The platform stores `text` for surface display; the structural
  //    grounding is in ArgumentPremise + conclusionClaimId.
  const argumentText = buildArgumentText(opts.arg);

  // 3. Create the Argument.
  const { argumentId } = await opts.iso.createArgument(
    {
      deliberationId: opts.deliberationId,
      authorId: opts.authorId,
      conclusionClaimId: opts.conclusionClaimId,
      premiseClaimIds,
      schemeId: opts.schemeId,
      implicitWarrant: opts.arg.warrant,
      text: argumentText,
      ruleType: "DEFEASIBLE",
    },
    opts.ctx,
  );

  // 4. Attach citations (one per premise that has a citationToken).
  const citations: Array<{ sourceId: string; citationId: string; citationToken: string }> = [];
  const uncitedPremiseTexts: string[] = [];
  const seenSourceIds = new Set<string>(); // dedupe per-argument: don't attach the same source twice

  for (let p = 0; p < opts.arg.premises.length; p++) {
    const premise = opts.arg.premises[p];
    if (!premise.citationToken) {
      uncitedPremiseTexts.push(premise.text);
      continue;
    }
    const sourceId = opts.tokenToSourceId[premise.citationToken];
    if (seenSourceIds.has(sourceId)) {
      // Already attached this source to this argument via an earlier premise.
      // Don't re-attach (the API would dedupe but we save the round-trip).
      continue;
    }
    seenSourceIds.add(sourceId);

    try {
      const { citationId } = await opts.iso.attachCitation(
        {
          targetType: "argument",
          targetId: argumentId,
          sourceId,
          // Truncate quote to fit the API's 280-char cap; use the premise text
          // as the quote so the human reviewer sees what the citation supports.
          quote: premise.text.length <= 280 ? premise.text : premise.text.slice(0, 277) + "...",
          intent: "supports",
        },
        opts.ctx,
      );
      citations.push({ sourceId, citationId, citationToken: premise.citationToken });
    } catch (err) {
      const msg = (err as Error).message ?? "";
      // Soft-degrade FK violations on stale evidence-context source IDs:
      // log+skip, treat the premise as uncited, and keep the argument.
      // A single bad source must not abort the whole phase.
      if (msg.includes("Citation_sourceId_fkey")) {
        opts.logger.event("citation_attach_fk_skip", {
          step: "argument-mint",
          argumentIndex: opts.inputIndex,
          premiseIndex: p,
          sourceId,
          citationToken: premise.citationToken,
          message: msg,
        });
        uncitedPremiseTexts.push(premise.text);
        continue;
      }
      throw err;
    }
  }

  return {
    inputIndex: opts.inputIndex,
    argumentId,
    conclusionClaimIndex: opts.arg.conclusionClaimIndex,
    conclusionClaimId: opts.conclusionClaimId,
    schemeKey: opts.arg.schemeKey,
    schemeId: opts.schemeId,
    premiseClaimIds,
    citations,
    uncitedPremiseTexts,
  };
}

/**
 * Build the surface-display text for an Argument. The platform's `text`
 * field is rendered in the UI alongside the structured premises. We
 * concatenate "P1. P2. ... Therefore, <conclusion-shape>." with the warrant
 * appended in a parenthetical when present.
 *
 * Conclusion text is NOT included here (it's looked up via
 * `conclusionClaimId` at render time); we end with "Therefore, [conclusion]."
 * as a placeholder that the UI's argument renderer is happy to consume.
 */
function buildArgumentText(arg: AdvocateArgument): string {
  const premiseLines = arg.premises.map((p) => p.text.trim().replace(/\s+/g, " ")).join(" ");
  const warrantSuffix = arg.warrant ? ` (Warrant: ${arg.warrant.trim().replace(/\s+/g, " ")})` : "";
  return `${premiseLines} Therefore, [conclusion #${arg.conclusionClaimIndex}].${warrantSuffix}`;
}

/**
 * Helper: build a `tokenToSourceId` map from the result of
 * `iso.getEvidenceContext(deliberationId)`. Centralized here so the
 * Phase-2 driver doesn't reimplement the field plucking.
 */
export function buildTokenToSourceIdMap(
  evidenceCtx: { sources: Array<{ sourceId: string; citationToken: string }> },
): Record<string, string> {
  const m: Record<string, string> = {};
  for (const s of evidenceCtx.sources) {
    if (s.citationToken && s.sourceId) m[s.citationToken] = s.sourceId;
  }
  return m;
}

// ─────────────────────────────────────────────────────────────────
// Loosened-mode web-citation materialization
// ─────────────────────────────────────────────────────────────────

export interface MaterializeWebCitationsOpts {
  iso: IsonomiaClient;
  ctx: IsonomiaCallContext;
  /** Bound evidence stack id; required for any web citation. */
  stackId: string | null;
  webCitations: Array<{
    token: string;
    url: string;
    title: string;
    authors?: string[];
    publishedAt?: string;
    snippet: string;
    methodology?: string;
  }>;
  logger: RoundLogger;
}

/**
 * Lazily mint each agent-declared web citation as a Source on the bound
 * evidence stack. Returns `{ token → sourceId }` so the caller can merge
 * the result into the corpus token map and proceed with normal premise
 * citation attachment.
 *
 * Idempotency: `addStackItem` POST is idempotent server-side on (stackId,
 * normalized url) — repeated calls return the existing sourceId.
 */
export async function materializeWebCitations(
  opts: MaterializeWebCitationsOpts,
): Promise<Record<string, string>> {
  if (!opts.webCitations || opts.webCitations.length === 0) return {};
  if (!opts.stackId) {
    throw new Error(
      `materializeWebCitations: deliberation has ${opts.webCitations.length} declared web citations but evidenceStackId is not set on runtime/deliberation.json`,
    );
  }
  const result: Record<string, string> = {};
  for (const wc of opts.webCitations) {
    // Normalize publishedAt to ISO datetime — platform Zod accepts only full datetime.
    // Accept "YYYY", "YYYY-MM", "YYYY-MM-DD" by padding to midnight UTC.
    const normalizePublishedAt = (s: string | undefined | null): string | undefined => {
      if (!s) return undefined;
      if (/T\d{2}:\d{2}/.test(s)) return s; // already datetime
      const m4 = /^(\d{4})$/.exec(s);
      if (m4) return `${m4[1]}-01-01T00:00:00.000Z`;
      const m7 = /^(\d{4})-(\d{2})$/.exec(s);
      if (m7) return `${m7[1]}-${m7[2]}-01T00:00:00.000Z`;
      const m10 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (m10) return `${s}T00:00:00.000Z`;
      return s; // pass through; let server reject if truly malformed
    };
    const item = await opts.iso.addStackItem(
      opts.stackId,
      {
        itemKind: "url",
        url: wc.url,
        title: wc.title,
        authors: wc.authors,
        publishedAt: normalizePublishedAt(wc.publishedAt),
        abstract: wc.snippet,
        keyFindings: wc.snippet ? [wc.snippet] : undefined,
        tags: wc.methodology ? ["web-discovered", wc.methodology] : ["web-discovered"],
      },
      opts.ctx,
    );
    result[wc.token] = item.sourceId;
    opts.logger.event("web_citation_materialized", {
      token: wc.token,
      url: wc.url,
      title: wc.title,
      sourceId: item.sourceId,
      stackItemId: item.stackItemId,
      contentSha256: item.contentSha256 ?? null,
      archived: item.archive ?? null,
    });
  }
  return result;
}
