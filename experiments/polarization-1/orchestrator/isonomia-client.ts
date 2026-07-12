/**
 * orchestrator/isonomia-client.ts
 *
 * Typed wrapper over every Isonomia REST call the orchestrator makes.
 *
 * Responsibilities:
 *   • Auth header switching per agent role
 *   • Retry policy:
 *       - 5xx: exponential backoff, 3 retries
 *       - 4xx: no retry (caller decides)
 *       - network/timeout: exponential backoff, 3 retries
 *   • Request/response logging via the supplied RoundLogger (optional)
 *   • JSON serialization
 *
 * Design notes:
 *   • The client itself is stateless — auth is supplied per call (or via
 *     `withAgent()` for ergonomics).
 *   • We use the agent's bearer ID token. Refresh is the orchestrator's
 *     responsibility (call `npm run refresh:agents` between phases).
 */

import type { OrchestratorConfig, AgentIdentity } from "./config";
import { agentByRole } from "./config";
import type { RoundLogger } from "./log/round-logger";

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 3;

export interface IsonomiaCallContext {
  /** Agent role whose bearer token should sign this call. */
  role: string;
  /** Optional logger to emit `isonomia_call` / `isonomia_error` events. */
  logger?: RoundLogger;
}

export class IsonomiaError extends Error {
  status: number;
  body: string;
  path: string;
  method: string;
  constructor(method: string, path: string, status: number, body: string) {
    super(`Isonomia ${method} ${path} → ${status}: ${body.slice(0, 300)}`);
    this.method = method;
    this.path = path;
    this.status = status;
    this.body = body;
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 && status < 600;
}

export class IsonomiaClient {
  constructor(private cfg: OrchestratorConfig) {}

  private agent(role: string): AgentIdentity {
    return agentByRole(this.cfg, role);
  }

  private async raw(
    method: string,
    pathStr: string,
    init: { body?: unknown; ctx: IsonomiaCallContext; query?: Record<string, string | number | undefined> },
  ): Promise<{ status: number; bodyText: string; bodyJson: unknown }> {
    const agent = this.agent(init.ctx.role);
    const qs = init.query
      ? "?" +
        Object.entries(init.query)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join("&")
      : "";
    const url = `${this.cfg.isonomiaBaseUrl}${pathStr}${qs}`;

    let attempt = 0;
    let lastErr: unknown = null;
    while (attempt < MAX_RETRIES) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method,
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${agent.idToken}`,
            "User-Agent": "polarization-1-orchestrator/0.1",
          },
          body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
        const bodyText = await res.text();
        let bodyJson: unknown = null;
        if (bodyText) {
          try { bodyJson = JSON.parse(bodyText); } catch { bodyJson = bodyText; }
        }

        init.ctx.logger?.event("isonomia_call", {
          agent: init.ctx.role,
          method,
          path: pathStr,
          status: res.status,
          requestBody: init.body ?? null,
          responseBody: bodyJson,
          attempt,
        });

        if (!res.ok) {
          if (isRetryableStatus(res.status) && attempt < MAX_RETRIES) {
            await sleep(250 * 2 ** (attempt - 1));
            continue;
          }
          throw new IsonomiaError(method, pathStr, res.status, bodyText);
        }
        return { status: res.status, bodyText, bodyJson };
      } catch (err) {
        if (err instanceof IsonomiaError) {
          // Already non-retryable or out of retries — propagate.
          init.ctx.logger?.event("isonomia_error", {
            agent: init.ctx.role,
            method,
            path: pathStr,
            status: err.status,
            error: err.body.slice(0, 500),
            attempt,
          });
          throw err;
        }
        lastErr = err;
        init.ctx.logger?.event("isonomia_error", {
          agent: init.ctx.role,
          method,
          path: pathStr,
          status: 0,
          error: (err as Error)?.message ?? String(err),
          attempt,
        });
        if (attempt >= MAX_RETRIES) break;
        await sleep(250 * 2 ** (attempt - 1));
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(
      `Isonomia ${method} ${pathStr} failed after ${MAX_RETRIES} attempts: ${
        (lastErr as Error)?.message ?? String(lastErr)
      }`,
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Identity
  // ─────────────────────────────────────────────────────────────────

  async getMe(role: string, logger?: RoundLogger): Promise<{ uid: string; userId: string | number }> {
    const r = await this.raw("GET", "/api/me", { ctx: { role, logger } });
    return r.bodyJson as { uid: string; userId: string | number };
  }

  // ─────────────────────────────────────────────────────────────────
  // Schemes (read-only; no auth required but we send it anyway)
  // ─────────────────────────────────────────────────────────────────

  async getSchemes(role: string, logger?: RoundLogger): Promise<unknown> {
    const r = await this.raw("GET", "/api/schemes", { ctx: { role, logger } });
    return r.bodyJson;
  }

  /**
   * Typed read of `/api/schemes` returning just `{id, key}` per scheme.
   * Used by Phase-2 translators to resolve `schemeKey` → `schemeId`.
   */
  async listSchemes(
    role: string,
    logger?: RoundLogger,
  ): Promise<Array<{ id: string; key: string }>> {
    const r = await this.raw("GET", "/api/schemes", { ctx: { role, logger } });
    const body = r.bodyJson as { items?: Array<{ id: string; key: string }> } | null;
    return body?.items ?? [];
  }

  // ─────────────────────────────────────────────────────────────────
  // Claim minting
  // ─────────────────────────────────────────────────────────────────

  async createClaim(
    body: { deliberationId: string; text: string; claimType?: string },
    ctx: IsonomiaCallContext,
  ): Promise<{ id: string; moid: string; text: string }> {
    const r = await this.raw("POST", "/api/claims", { body, ctx });
    const j = r.bodyJson as any;
    // POST /api/claims returns the claim under various shapes depending on
    // the path; normalize to {id, moid, text}.
    const claim = j?.claim ?? j?.data ?? j;
    return { id: claim.id, moid: claim.moid, text: claim.text };
  }

  // ─────────────────────────────────────────────────────────────────
  // Claim edges (topology)
  // ─────────────────────────────────────────────────────────────────

  async createClaimEdge(
    fromClaimId: string,
    body: {
      toClaimId: string;
      type: "supports" | "rebuts";
      attackType?: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
      targetScope?: string;
    },
    ctx: IsonomiaCallContext,
  ): Promise<unknown> {
    const r = await this.raw(
      "POST",
      `/api/claims/${encodeURIComponent(fromClaimId)}/edges`,
      { body, ctx },
    );
    return r.bodyJson;
  }

  // ─────────────────────────────────────────────────────────────────
  // Representative claim (Stage-2 prereq endpoint)
  // ─────────────────────────────────────────────────────────────────

  async setRepresentativeClaim(
    deliberationId: string,
    claimId: string | null,
    ctx: IsonomiaCallContext,
  ): Promise<{ deliberationId: string; representativeClaimId: string | null }> {
    const r = await this.raw(
      "PATCH",
      `/api/deliberations/${encodeURIComponent(deliberationId)}/representative-claim`,
      { body: { claimId }, ctx },
    );
    return r.bodyJson as { deliberationId: string; representativeClaimId: string | null };
  }

  // ─────────────────────────────────────────────────────────────────
  // Evidence context
  // ─────────────────────────────────────────────────────────────────

  async createStack(
    body: { name: string; slug?: string; visibility?: "public_open" | "public_closed" | "private" | "unlisted"; description?: string | null },
    ctx: IsonomiaCallContext,
  ): Promise<{ id: string; slug: string }> {
    const r = await this.raw("POST", "/api/stacks", { body, ctx });
    const j = r.bodyJson as { id: string; slug: string };
    return { id: j.id, slug: j.slug };
  }

  async addStackItem(
    stackId: string,
    body: {
      itemKind: "url" | "doi";
      url?: string;
      doi?: string;
      title?: string;
      authors?: string[];
      publishedAt?: string;
      abstract?: string;
      keyFindings?: string[];
      tags?: string[];
    },
    ctx: IsonomiaCallContext,
  ): Promise<{ stackItemId: string; sourceId: string; contentSha256?: string | null; archive?: { url: string; capturedAt: string } | null }> {
    const r = await this.raw("POST", `/api/stacks/${encodeURIComponent(stackId)}/items`, { body, ctx });
    return r.bodyJson as any;
  }

  async ensureDeliberation(
    body: { hostType: "library_stack" | "article" | "post" | "room_thread" | "site" | "inbox_thread"; hostId: string },
    ctx: IsonomiaCallContext,
  ): Promise<{ id: string; created: boolean }> {
    const r = await this.raw("POST", "/api/deliberations/ensure", { body, ctx });
    const j = r.bodyJson as { id: string; created: boolean };
    return { id: j.id, created: !!j.created };
  }

  async bindEvidenceStack(
    deliberationId: string,
    stackId: string,
    ctx: IsonomiaCallContext,
  ): Promise<unknown> {
    const r = await this.raw(
      "POST",
      `/api/deliberations/${encodeURIComponent(deliberationId)}/evidence-context`,
      { body: { stackId }, ctx },
    );
    return r.bodyJson;
  }

  async getEvidenceContext(
    deliberationId: string,
    ctx: IsonomiaCallContext,
  ): Promise<{
    stack: { id: string; name: string; sourceCount: number };
    sources: Array<{
      sourceId: string;
      url: string | null;
      doi: string | null;
      title: string | null;
      authors: string[];
      publishedAt: string | null;
      abstract: string | null;
      keyFindings: string[];
      tags: string[];
      contentSha256: string | null;
      archiveUrl: string | null;
      citationToken: string;
    }>;
  }> {
    const r = await this.raw(
      "GET",
      `/api/deliberations/${encodeURIComponent(deliberationId)}/evidence-context`,
      { ctx },
    );
    return r.bodyJson as any;
  }

  // ─────────────────────────────────────────────────────────────────
  // State (composed from existing v3 endpoints — H2 not yet built)
  // ─────────────────────────────────────────────────────────────────

  async getFingerprint(deliberationId: string, ctx: IsonomiaCallContext): Promise<unknown> {
    const r = await this.raw(
      "GET",
      `/api/v3/deliberations/${encodeURIComponent(deliberationId)}/fingerprint`,
      { ctx },
    );
    return r.bodyJson;
  }

  async getFrontier(deliberationId: string, ctx: IsonomiaCallContext): Promise<unknown> {
    const r = await this.raw(
      "GET",
      `/api/v3/deliberations/${encodeURIComponent(deliberationId)}/frontier`,
      { ctx },
    );
    return r.bodyJson;
  }

  async getMissingMoves(deliberationId: string, ctx: IsonomiaCallContext): Promise<unknown> {
    const r = await this.raw(
      "GET",
      `/api/v3/deliberations/${encodeURIComponent(deliberationId)}/missing-moves`,
      { ctx },
    );
    return r.bodyJson;
  }

  async getChains(deliberationId: string, ctx: IsonomiaCallContext): Promise<unknown> {
    const r = await this.raw(
      "GET",
      `/api/v3/deliberations/${encodeURIComponent(deliberationId)}/chains`,
      { ctx },
    );
    return r.bodyJson;
  }

  /**
   * List claims in a deliberation. Used by Phase 1 finalize audit.
   * Returns up to 500 claims with `id` and `text`.
   */
  async listClaims(
    deliberationId: string,
    ctx: IsonomiaCallContext,
  ): Promise<Array<{ id: string; text: string }>> {
    const r = await this.raw(
      "GET",
      `/api/claims/search`,
      { ctx, query: { deliberationId } },
    );
    const body = r.bodyJson as { ok?: boolean; claims?: Array<{ id: string; text: string }> } | null;
    return body?.claims ?? [];
  }

  // ─────────────────────────────────────────────────────────────────
  // Arguments (Phase 2/3)
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /api/arguments — create an Argument with N premises and a scheme.
   * Premises must already exist as Claims (mint via `createClaim` first and
   * pass their IDs as `premiseClaimIds`).
   *
   * The route also creates the supporting `ArgumentPremise` rows, an
   * `ArgumentSchemeInstance`, an `ArgumentSupport` bootstrap, and a
   * `DialogueMove` ASSERT — the caller does not need to make any of those
   * calls separately.
   */
  async createArgument(
    body: {
      deliberationId: string;
      authorId: string;
      conclusionClaimId: string;
      premiseClaimIds: string[];
      schemeId?: string | null;
      implicitWarrant?: string | null;
      text?: string;
      premisesAreAxioms?: boolean;
      ruleType?: "DEFEASIBLE" | "STRICT";
      ruleName?: string | null;
    },
    ctx: IsonomiaCallContext,
  ): Promise<{ argumentId: string }> {
    const r = await this.raw("POST", "/api/arguments", { body, ctx });
    const j = r.bodyJson as { argumentId?: string; argument?: { id?: string } } | null;
    const id = j?.argumentId ?? j?.argument?.id;
    if (!id) {
      throw new Error(`createArgument: missing argumentId in response (got ${JSON.stringify(j).slice(0, 200)})`);
    }
    return { argumentId: id };
  }

  /**
   * POST /api/citations/attach — bind a Source to an Argument (or other
   * target). Phase-2 advocates emit `citationToken` per premise; the
   * translator resolves the token → sourceId via `getEvidenceContext` and
   * calls this once per premise-source pair.
   *
   * Returns `{citationId}`. Idempotent on (targetType, targetId, sourceId,
   * locator) — server returns the existing row on duplicate.
   */
  async attachCitation(
    body: {
      targetType: "argument" | "claim" | "card" | "comment" | "move" | "proposition";
      targetId: string;
      sourceId: string;
      locator?: string;
      quote?: string;
      note?: string;
      relevance?: number;
      intent?: "supports" | "refutes" | "context" | "defines" | "method" | "background" | "acknowledges" | "example" | null;
    },
    ctx: IsonomiaCallContext,
  ): Promise<{ citationId: string }> {
    const r = await this.raw("POST", "/api/citations/attach", { body, ctx });
    const j = r.bodyJson as { citation?: { id?: string } } | null;
    const id = j?.citation?.id;
    if (!id) {
      throw new Error(`attachCitation: missing citation.id in response (got ${JSON.stringify(j).slice(0, 200)})`);
    }
    return { citationId: id };
  }

  /**
   * POST /api/arguments/{targetArgumentId}/attacks — create an
   * `ArgumentEdge` row binding a rebuttal Argument to the argument it
   * attacks. Used by Phase-3 (Dialectical Testing).
   *
   * Per-type guards on the route:
   *   - REBUTS: `targetClaimId` MUST equal the target argument's `conclusionClaimId`.
   *   - UNDERMINES: `targetPremiseId` REQUIRED, must be a Claim ID present in the target's `ArgumentPremise` rows.
   *   - UNDERCUTS: no extra targeting fields required.
   *
   * If `cqKey` is set, the route ALSO upserts a `CQStatus` row marking
   * the CQ as `answered` on the target argument with this rebuttal as
   * the responding argument. (Phase-3 also writes its own CQStatus rows
   * directly via prisma for the OPEN-state raises that don't have an
   * accompanying rebuttal — see attack-mint.ts.)
   *
   * Returns `{edgeId}`.
   */
  async attachAttack(
    targetArgumentId: string,
    body: {
      deliberationId: string;
      createdById: string;
      fromArgumentId: string;
      attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
      targetScope: "conclusion" | "inference" | "premise";
      toArgumentId?: string | null;
      targetClaimId?: string | null;
      targetPremiseId?: string | null;
      cqKey?: string | null;
    },
    ctx: IsonomiaCallContext,
  ): Promise<{ edgeId: string }> {
    const r = await this.raw(
      "POST",
      `/api/arguments/${encodeURIComponent(targetArgumentId)}/attacks`,
      { body, ctx },
    );
    const j = r.bodyJson as { edgeId?: string } | null;
    const id = j?.edgeId;
    if (!id) {
      throw new Error(`attachAttack: missing edgeId in response (got ${JSON.stringify(j).slice(0, 200)})`);
    }
    return { edgeId: id };
  }

  // ─────────────────────────────────────────────────────────────────
  // Argument Chains (Phase 6 — chain-architect)
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /api/argument-chains — create a top-level ArgumentChain row.
   * Phase-6 chain-architect mints one chain per hinge sub-claim
   * (chainType=TREE) using the methodologist agent's bearer token.
   */
  async createArgumentChain(
    body: {
      deliberationId: string;
      name: string;
      description?: string;
      purpose?: string;
      chainType: "SERIAL" | "CONVERGENT" | "DIVERGENT" | "TREE" | "GRAPH";
      isPublic?: boolean;
      isEditable?: boolean;
    },
    ctx: IsonomiaCallContext,
  ): Promise<{ chainId: string }> {
    const r = await this.raw("POST", "/api/argument-chains", { body, ctx });
    const j = r.bodyJson as { chain?: { id?: string } } | null;
    const id = j?.chain?.id;
    if (!id) {
      throw new Error(
        `createArgumentChain: missing chain.id in response (got ${JSON.stringify(j).slice(0, 200)})`,
      );
    }
    return { chainId: id };
  }

  /**
   * POST /api/argument-chains/{chainId}/nodes — bind an existing Argument
   * to the chain with optional role + epistemic-status annotations.
   */
  async addChainNode(
    chainId: string,
    body: {
      argumentId: string;
      role?: "PREMISE" | "EVIDENCE" | "CONCLUSION" | "OBJECTION" | "REBUTTAL" | "QUALIFIER" | "COMMENT";
      positionX?: number;
      positionY?: number;
      epistemicStatus?:
        | "ASSERTED"
        | "HYPOTHETICAL"
        | "COUNTERFACTUAL"
        | "CONDITIONAL"
        | "QUESTIONED"
        | "DENIED"
        | "SUSPENDED";
      scopeId?: string;
      dialecticalRole?:
        | "THESIS"
        | "ANTITHESIS"
        | "SYNTHESIS"
        | "OBJECTION"
        | "RESPONSE"
        | "CONCESSION";
    },
    ctx: IsonomiaCallContext,
  ): Promise<{ nodeId: string }> {
    const r = await this.raw(
      "POST",
      `/api/argument-chains/${encodeURIComponent(chainId)}/nodes`,
      { body, ctx },
    );
    const j = r.bodyJson as { node?: { id?: string }; nodeId?: string } | null;
    const id = j?.node?.id ?? j?.nodeId;
    if (!id) {
      throw new Error(
        `addChainNode: missing node.id in response (got ${JSON.stringify(j).slice(0, 200)})`,
      );
    }
    return { nodeId: id };
  }

  /**
   * POST /api/argument-chains/{chainId}/edges — link two existing chain
   * nodes with a typed edge. edgeType must match the prisma
   * `ArgumentChainEdgeType` enum (10 members incl. ASPIC+ attack types).
   */
  async addChainEdge(
    chainId: string,
    body: {
      sourceNodeId: string;
      targetNodeId: string;
      edgeType:
        | "SUPPORTS"
        | "ENABLES"
        | "PRESUPPOSES"
        | "REFUTES"
        | "QUALIFIES"
        | "EXEMPLIFIES"
        | "GENERALIZES"
        | "REBUTS"
        | "UNDERCUTS"
        | "UNDERMINES";
      strength?: number;
      description?: string;
      slotMapping?: Record<string, string>;
    },
    ctx: IsonomiaCallContext,
  ): Promise<{ edgeId: string }> {
    const r = await this.raw(
      "POST",
      `/api/argument-chains/${encodeURIComponent(chainId)}/edges`,
      { body, ctx },
    );
    const j = r.bodyJson as { edge?: { id?: string }; edgeId?: string } | null;
    const id = j?.edge?.id ?? j?.edgeId;
    if (!id) {
      throw new Error(
        `addChainEdge: missing edge.id in response (got ${JSON.stringify(j).slice(0, 200)})`,
      );
    }
    return { edgeId: id };
  }

  // ─────────────────────────────────────────────────────────────────
  // CQ raise (Phase 7 — challenger)
  // ─────────────────────────────────────────────────────────────────

  /**
   * POST /api/arguments/{argumentId}/cqs/{cqKey}/ask — open a critical
   * question against a target argument. Side-effects on the platform:
   *   1. Upserts a `CQStatus` row keyed on (argumentId, cqKey) with
   *      status = "open" (no-op if a non-open row already exists for
   *      this cqKey on this argument; resets to "open" otherwise).
   *   2. Creates a WHY `DialogueMove` authored by the calling agent,
   *      targeting the argument.
   *
   * Phase 7 (T2.1) calls this for every (target, schemeKey, cqKey)
   * tuple the challenger raises. The CQStatus row is the substrate the
   * fingerprint's `cqCoverage` aggregate reads; the WHY DialogueMove is
   * the substrate `challengerCoverage` reads (via per-argument distinct
   * challenger authors, once that index includes WHY-move authors).
   */
  async raiseCq(
    targetArgumentId: string,
    cqKey: string,
    body: { deliberationId: string; authorId: string; schemeKey?: string },
    ctx: IsonomiaCallContext,
  ): Promise<{ ok: true }> {
    await this.raw(
      "POST",
      `/api/arguments/${encodeURIComponent(targetArgumentId)}/cqs/${encodeURIComponent(cqKey)}/ask`,
      { body, ctx },
    );
    return { ok: true };
  }

  /**
   * POST /api/ca — create a `ConflictApplication` row binding a
   * conflicting (challenger-voice) argument to a conflicted (target)
   * argument. Phase 7 (T2.1) uses this to anchor the CQ-raise as a
   * countable challenger event in `challengerCoverage` (the
   * fingerprint's `challengerAuthorsByArg` set credits CA-createdBy).
   *
   * Important behavioural note: the route auto-marks the matching
   * `CQStatus` row as `answered` when both `schemeKey` and `cqKey`
   * are passed at the **top level** of the body. Phase 7 wants the CQ
   * to remain `open` (the challenger is *raising* the CQ, not
   * answering it), so the schemeKey + cqKey are passed only inside
   * `metaJson` and the top-level `cqKey` is intentionally omitted.
   * The accompanying `raiseCq` call (which fires before this one) is
   * what creates the `CQStatus` row in `open` state.
   */
  async createConflictApplication(
    body: {
      deliberationId: string;
      conflictingArgumentId: string;
      conflictedArgumentId: string;
      legacyAttackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
      legacyTargetScope: "conclusion" | "inference" | "premise";
      metaJson: {
        schemeKey: string;
        cqKey: string;
        cqText?: string;
        cqContext?: string;
        source?: string;
      };
    },
    ctx: IsonomiaCallContext,
  ): Promise<{ caId: string }> {
    const r = await this.raw("POST", "/api/ca", { body, ctx });
    const j = r.bodyJson as { id?: string; caId?: string } | null;
    const id = j?.id ?? j?.caId;
    if (!id) {
      throw new Error(
        `createConflictApplication: missing id in response (got ${JSON.stringify(j).slice(0, 200)})`,
      );
    }
    return { caId: id };
  }
}
