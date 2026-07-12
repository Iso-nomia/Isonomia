/**
 * GET /.well-known/argument-graph
 *
 * Track B.1 — machine-readable manifest of Isonomia's argument-graph
 * capabilities. This is the single discovery doc an LLM agent or
 * indexing pipeline should fetch first; it points at every other
 * shape (HTML, JSON-LD, AIF, attestation envelope, MCP, OpenAPI,
 * corpus snapshot).
 *
 * Companion to /.well-known/llms.txt (the human/LLM-readable prose
 * version).
 *
 * Returned as application/json. No auth, edge-cacheable.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

const MANIFEST = {
  "$schema":
    "https://isonomia.app/schemas/argument-graph-manifest/v1.json",
  version: "1.0",
  service: {
    name: "Isonomia",
    description:
      "Argument-graph platform exposing every public argument as a machine-citable, dialectically-attested, content-hashed epistemic artifact.",
    baseUrl: BASE_URL,
    licenseCorpus: "CC-BY-4.0",
    licenseCorpusUrl: "https://creativecommons.org/licenses/by/4.0/",
    docs: `${BASE_URL}/.well-known/llms.txt`,
  },
  formats: [
    {
      mediaType: "text/html",
      description: "Human-rendered argument-object landing page.",
    },
    {
      mediaType: "application/ld+json",
      description:
        "Rich JSON-LD: Claim + ScholarlyArticle + ClaimReview + AIF subgraph.",
    },
    {
      mediaType: "application/json",
      description: "AIF graph (RA + I-nodes, conflict, support).",
    },
    {
      mediaType: "application/vnd.isonomia.attestation+json",
      description:
        "Compact citation envelope (the LLM unit). Returned by ?format=attestation.",
    },
  ],
  endpoints: {
    argumentByPermalink: {
      url: `${BASE_URL}/a/{shortCode}`,
      method: "GET",
      contentNegotiation: true,
      description:
        "Resolve a public argument by short code. Honors Accept header for HTML, JSON-LD, AIF.",
    },
    argumentByPermalinkImmutable: {
      url: `${BASE_URL}/a/{shortCode}@{contentHash}`,
      method: "GET",
      description:
        "Immutable form pinned to a specific sha256 content hash. Use for citations that must survive future edits.",
    },
    argumentAttestation: {
      url: `${BASE_URL}/api/a/{shortCode}/aif`,
      method: "GET",
      query: { format: ["aif", "jsonld", "attestation"], signed: ["0", "1"] },
      description:
        "Argument representation by short code with explicit format selector. Append &signed=1 for an Ed25519-signed, offline-verifiable attestation envelope (see the top-level `signing` block); the default (unsigned) response is unchanged.",
    },
    claim: {
      url: `${BASE_URL}/api/c/{moid}`,
      method: "GET",
      description:
        "Resolve a claim by canonical MOID with supporting and attacking arguments.",
    },
    argumentCitedBy: {
      url: `${BASE_URL}/api/v3/arguments/{shortCode}/cited-by`,
      method: "GET",
      query: {
        limit: "1..200",
        sort: ["recent", "stance"],
        public_only: "bool",
        include_standing: "bool",
      },
      description:
        "Phase 10a — cited-by graph for an argument: who supports it, contests it, builds on it (uses its conclusion as a premise), or reuses it across rooms. Typed per edge; attacks are surfaced at counts.contests so the list is never one-sided. Honest-empty is a 200 with counts.total=0 — absence of engagement, never settledness.",
    },
    claimCitedBy: {
      url: `${BASE_URL}/api/v3/claims/{moid}/cited-by`,
      method: "GET",
      description:
        "Phase 10a — cited-by graph for a claim: arguments that use it as a premise (builds-on) or contest it. Deliberately omits arguments that CONCLUDE the claim (that is /stances — producing, not citing); links.stances routes for/against.",
    },
    webmention: {
      url: `${BASE_URL}/api/webmention`,
      method: "POST",
      body: { source: "url of the external page", target: "the /a/{shortCode} or /c/{moid} permalink it links" },
      description:
        "Phase 10a (10.6) — Webmention receiver. An external page linking a permalink can notify us; we verify the backlink and record it as an external citation. Per policy it lands 'unreviewed' — displayed on the cited-by surface but excluded from the headline count until a moderator marks it trusted.",
    },
    search: {
      url: `${BASE_URL}/api/v3/search/arguments`,
      method: "GET",
      query: {
        q: "free-text",
        limit: "1..50",
        scheme: "argumentation scheme key",
        against: "claim moid (returns counter-arguments)",
        sort: ["recent", "dialectical_fitness"],
        mode: ["lexical", "hybrid", "vector"],
      },
      description:
        "Public argument search. Use sort=dialectical_fitness for tested-and-survived re-ranking. Default mode is hybrid (pgvector cosine + lexical OR-tokens fused via RRF). Human-readable equivalent: GET /search/arguments.",
    },
    humanSearchPage: {
      url: `${BASE_URL}/search/arguments`,
      method: "GET",
      description:
        "Human-facing search UI rendered server-side over the same /api/v3/search/arguments engine. Supports the same query params (q, scheme, sort, mode, against, limit) and emits <link rel=\"alternate\" type=\"application/json\"> pointing back at the API form for crawlers.",
    },
    proposeArgument: {
      url: `${BASE_URL}/api/arguments/quick`,
      method: "POST",
      auth: "bearer",
      description:
        "Quick Argument API. Token-gated; returns a permalink for the newly-created argument.",
    },
    deliberationFingerprint: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/fingerprint`,
      method: "GET",
      description:
        "Track AI-EPI Pt. 4 §1 — deterministic deliberation-scope statistical summary. Returns contentHash that keys every other Pt. 4 readout.",
    },
    deliberationContestedFrontier: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/frontier`,
      method: "GET",
      query: {
        sortBy: ["loadBearingness", "recency", "severity"],
      },
      description:
        "Track AI-EPI Pt. 4 §2 — open dialectical edges (unanswered undercuts, undermines, CQs, terminal leaves) with a load-bearingness ranking. Use before any 'middle ground' or 'consensus' summary.",
    },
    deliberationMissingMoves: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/missing-moves`,
      method: "GET",
      description:
        "Track AI-EPI Pt. 4 §3 — diff between scheme-typical-move catalog and actual graph. Names absent CQs and undercuts by catalog key.",
    },
    deliberationChains: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/chains`,
      method: "GET",
      description:
        "Track AI-EPI Pt. 4 §4 — ArgumentChain projections with chainStanding (worst-link), chainFitness, weakestLink, and uncoveredClaims.",
    },
    deliberationSyntheticReadout: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/synthetic-readout`,
      method: "GET",
      description:
        "Track AI-EPI Pt. 4 §5 — editorial primitive. Composes fingerprint + frontier + missing-moves + chains + topology (hub set with multiplicity, load-bearing premises, calibrated ambiguity, size tier + hierarchical-mode disclosure) and exposes refusalSurface.cannotConcludeBecause: a structured enumeration of conclusions the graph will not currently license. Consumers that close on a refused conclusion, name a single hub when topology.hubs.shape !== 'single-dominant', or omit sizeDisclosure when hierarchicalMode is true lie about a structured field.",
    },
    deliberationCrossContext: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/cross-context`,
      method: "GET",
      description:
        "Track AI-EPI Pt. 4 §7 — canonical-claim families across rooms, plexus-edge counts (ArgumentImport), sibling-room scheme reuse. aggregateAcceptance is a deterministic fold over localStatus enums.",
    },
    eccArrow: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/ecc/arrow?claimId={claimId}`,
      method: "GET",
      description:
        "Sprint E — typed ECC `Hom(I, claim)` arrow + Ambler 1996 Def. 8/17 meta (simple, entire, selected, logical). The `logical` predicate is strict (ECC plan §4 row 1).",
    },
    eccCulprits: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/ecc/culprits?claimId={claimId}`,
      method: "GET",
      description:
        "Sprint E — Ambler §4 retraction candidates per claim, hydrated with AssumptionUse text/status. Answers 'what would I have to retract to reject claim X?'",
    },
    eccConfidence: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/ecc/confidence?claimId={claimId}&mode=min|product`,
      method: "GET",
      description:
        "Sprint E — `confidence(arrow, monoid)` per claim. Closed-enum monoid (ECC plan §4 row 5).",
    },
    eccEnthymemes: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/ecc/enthymemes`,
      method: "GET",
      query: { argumentId: "optional; omit for delib-wide scan" },
      description:
        "Sprint E — `detectEnthymemes()` per argument or per deliberation. Names missing premise roles by scheme key.",
    },
    eccTransport: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/ecc/transport`,
      method: "GET",
      query: { fromRoomId: "optional source delib id" },
      description:
        "Sprint E — cached RoomTransportSnapshot rows landing on this deliberation. One-hop only (ECC plan §4 row 2).",
    },
    eccAggregate: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/ecc/aggregate?claimId={claimId}&mode=min|product`,
      method: "GET",
      description:
        "Sprint E — `{ local, imported, total }` band per claim via aggregateAcrossRooms. Isonomia construction (ECC plan §0.5.7).",
    },
    eccEvidential: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/ecc/evidential?mode=min|product&imports=off|materialized|virtual|all`,
      method: "GET",
      description:
        "Sprint E — typed evidential projection for the whole deliberation (bypasses the ECC_TYPED_PIPELINE feature flag). Returns support, hom, nodes, plus supportBand when imports are folded in.",
    },
    eccBeliefRevision: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/ecc/belief-revision?claimId={claimId}`,
      method: "GET",
      description:
        "Sprint E — cached BeliefRevisionProposal rows (Sprint D1) for an OUT-labelled claim, hydrated with referenced AssumptionUse rows.",
    },
    eccProposeWarrant: {
      url: `${BASE_URL}/api/v3/deliberations/{id}/ecc/propose-warrant`,
      method: "POST",
      auth: "bearer",
      description:
        "Sprint E — internal-hom write. Materializes a warrant claim + AI-authored backing argument + AssumptionUse on the host argument. Per ECC plan §4 row 3, the resulting derivation is non-logical until a HUMAN ratifies.",
    },
  },
  citation: {
    envelopePath: "/api/a/{shortCode}/aif?format=attestation",
    envelopeMediaType: "application/vnd.isonomia.attestation+json",
    contentAddressing: "sha256",
    immutableUrlPattern: "/a/{shortCode}@{contentHash}",
    fields: [
      "permalink",
      "immutablePermalink",
      "contentHash",
      "version",
      "retrievedAt",
      "conclusion",
      "scheme",
      "premises",
      "evidence[].contentSha256",
      "evidence[].archive.url",
      "dialecticalStatus.criticalQuestionsAnswered",
      "dialecticalStatus.criticalQuestionsRequired",
      "dialecticalStatus.incomingAttacks",
      "dialecticalStatus.incomingSupports",
      "dialecticalStatus.testedness",
      "dialecticalStatus.standingScore",
      "dialecticalStatus.standingState",
    ],
  },
  signing: {
    // Track AI-EPI Pt. 5 §1/§3. Any attestation can be requested signed; the
    // signature is verifiable offline against the JWKS below — no call back to
    // Isonomia required.
    enabled: true,
    signaturePolicy: "ed25519-detached-jcs",
    signedEnvelopeQuery: "?format=attestation&signed=1",
    signedExample: `${BASE_URL}/api/a/{shortCode}/aif?format=attestation&signed=1`,
    jwksUrl: `${BASE_URL}/.well-known/issuer-keys`,
    revocationListUrl: `${BASE_URL}/.well-known/revoked-attestations`,
    canonicalization: "RFC 8785 (JCS)",
    signatureBlock: "signature = { alg: 'Ed25519', keyId, sig, signedAt, signedFields, jcsHash, status? }",
    coverage:
      "The signature covers the content-bearing summary fields — including contentHash, conclusion, premises, scheme, and dialecticalStatus (so a claim's shown standing is tamper-evident). The volatile retrievedAt is NOT covered. `signature.status` is an advisory hint; the authoritative revocation check is the revocationListUrl.",
    verify:
      "Rebuild JCS(pickFields(envelope, signedFields)) and Ed25519-verify the detached signature against the JWKS entry for signature.keyId; then confirm (shortCode@contentHash) is absent from the revocation list.",
    // did:web issuer document + W3C Verifiable Credential form (?format=vc) are planned (Item 4).
    didWeb: null,
    verifiableCredential: null,
  },
  counterCitation: {
    enabled: true,
    description:
      "Citations include the strongest known counter-argument inline. Use cite_argument (MCP) or fetch ?format=attestation.",
    tool: "cite_argument",
  },
  mcp: {
    transport: "stdio",
    package: "@isonomia/mcp",
    localPackagePath: "packages/isonomia-mcp/dist/server.js",
    spec: "https://modelcontextprotocol.io",
    tools: [
      {
        name: "search_arguments",
        description:
          "Free-text search over public arguments; supports sort=dialectical_fitness re-rank and mode=hybrid|lexical|vector retrieval (hybrid is the default and fuses pgvector cosine + lexical via RRF).",
      },
      {
        name: "get_argument",
        description:
          "Full attestation envelope by permalink, with provenance and dialectical state.",
      },
      {
        name: "get_claim",
        description:
          "Claim by MOID with supporting argument permalinks and attestation URLs.",
      },
      {
        name: "find_counterarguments",
        description:
          "Counter-arguments for a target claim. Honest-empty: returns no results rather than self-counters. Supports mode=hybrid (default) for paraphrase-tolerant candidate recall.",
      },
      {
        name: "get_cited_by",
        description:
          "Phase 10a — cited-by graph for an argument or claim: who supports, contests, builds on (uses as a premise), or reuses it. Attacks surfaced at counts.contests; honest-empty means absence of engagement, not settledness. Distinct from get_claim_stances (which is who concludes for/against).",
      },
      {
        name: "get_citation_neighbourhood",
        description:
          "Phase 10a — bounded (≤2-hop) cited-by traversal from an argument, following public-argument citers; returns typed, standing-annotated nodes + edges with a truncation flag.",
      },
      {
        name: "cite_argument",
        description:
          "Returns a citation block with provenance counters, standingState classifier, the strongest known objection attached by default, and the Isonomia URN (iso:argument:<shortCode>). Pass format=apa|mla|chicago|bibtex|ris|csl for the canonical scholarly citation string (AI-EPI E.1).",
      },
      {
        name: "propose_argument",
        description:
          "Create a new argument via the Quick Argument API. Token-gated.",
      },
      {
        name: "get_deliberation_fingerprint",
        description:
          "Pt. 4 §1 — deterministic statistical summary of a deliberation. Honesty floor for any deliberation summary; the contentHash is the cache key for every other Pt. 4 readout.",
      },
      {
        name: "get_contested_frontier",
        description:
          "Pt. 4 §2 — open dialectical edges in a deliberation with a load-bearingness ranking. Required before any 'consensus' or 'middle ground' summary.",
      },
      {
        name: "get_missing_moves",
        description:
          "Pt. 4 §3 — diff between scheme-typical moves and what the graph contains. Names absent moves by catalog key.",
      },
      {
        name: "get_chains",
        description:
          "Pt. 4 §4 — ArgumentChain projections with worst-link standing and weakest-link annotations.",
      },
      {
        name: "get_synthetic_readout",
        description:
          "Pt. 4 §5 — composed deliberation readout with refusalSurface.cannotConcludeBecause. The editorial primitive.",
      },
      {
        name: "get_cross_context",
        description:
          "Pt. 4 §7 — canonical-claim families and plexus-edge counts across rooms. Use when local depth is thin.",
      },
      {
        name: "summarize_debate",
        description:
          "Pt. 4 wrapper — forces deliberation summaries through the synthetic-readout primitive instead of free synthesis from search hits.",
      },
      {
        name: "ecc_arrow",
        description:
          "Sprint E — typed `Hom(I, claim)` ECC arrow + structural meta (Ambler 1996 Def. 8/17).",
      },
      {
        name: "ecc_culprits",
        description:
          "Sprint E — Ambler §4 belief-revision: ranked retraction candidates per claim. The canonical 'what would I have to retract to reject claim X?' tool.",
      },
      {
        name: "ecc_confidence",
        description:
          "Sprint E — confidence(arrow, monoid) with mode in {min, product} (closed enum, ECC plan §4 row 5; ds retired 2026-06-03).",
      },
      {
        name: "ecc_enthymemes",
        description:
          "Sprint E — detectEnthymemes() per argument or per deliberation; names missing premise roles by scheme key.",
      },
      {
        name: "ecc_transport",
        description:
          "Sprint E — read RoomTransportSnapshot rows (one-hop only, ECC plan §4 row 2).",
      },
      {
        name: "ecc_aggregate",
        description:
          "Sprint E — { local, imported, total } band per claim. Isonomia construction (ECC plan §0.5.7).",
      },
      {
        name: "ecc_evidential",
        description:
          "Sprint E — typed evidential projection for the whole deliberation; emits supportBand when imports are folded in.",
      },
      {
        name: "ecc_belief_revision_proposals",
        description:
          "Sprint E — cached BeliefRevisionProposal rows (Sprint D1) for an OUT claim.",
      },
      {
        name: "propose_warrant",
        description:
          "Sprint E — internal-hom write. AI-authored warrants are non-logical until a HUMAN ratifies (ECC plan §4 row 3).",
      },
    ],
  },
  schemas: {
    aif: {
      url: "http://www.arg.dundee.ac.uk/aif",
      description: "Argument Interchange Format (RA, CA, MA nodes).",
    },
    schemaOrg: {
      types: ["Claim", "ScholarlyArticle", "ClaimReview"],
      activated: true,
    },
    openapi: {
      url: `${BASE_URL}/api/v3/openapi.json`,
      version: "3.1",
      description: "Hand-curated OpenAPI 3.1 spec for the public API.",
    },
    jsonld: {
      contextPrefixes: ["aif", "as", "cq"],
    },
  },
  corpus: {
    available: false,
    plannedDistribution: "huggingface",
    plannedLicense: "CC-BY-4.0",
    plannedMediaType: "application/x-parquet",
    description:
      "Public, dated snapshot of the argument graph including conclusion-claim and full-argument embeddings. Planned: HuggingFace Datasets.",
    contents: [
      "arguments.parquet",
      "claims.parquet",
      "manifest.json",
      "LICENSE.md",
    ],
  },
  capabilities: {
    contentNegotiation: true,
    contentAddressing: true,
    archiveOrgEvidence: true,
    counterCitationReflex: true,
    dialecticalFitnessRanking: true,
    honestEmptyOnSelfCounter: true,
    standingStateClassifier: true,
    citedByGraph: true,
    immutablePermalinks: true,
    deliberationFingerprint: true,
    contestedFrontier: true,
    missingMovesCatalog: true,
    chainExposure: true,
    syntheticReadoutWithRefusalSurface: true,
    crossDeliberationContext: true,
    eccTypedAlgebra: true,
    eccBeliefRevision: true,
    eccCrossRoomTransportOneHop: true,
    eccProposeWarrantAiFlagged: true,
    signedAttestations: true,
    attestationRevocation: true,
    offlineVerifiableProvenance: true,
  },
  meta: {
    generatedAt: new Date().toISOString().slice(0, 10),
    docsHumanReadable: `${BASE_URL}/.well-known/llms.txt`,
    demoExplainer: `${BASE_URL}/test/ai-epistemic`,
  },
};

export async function GET() {
  return NextResponse.json(MANIFEST, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
