/**
 * Tool metadata (session 26 §3-A1): which tools write, which are
 * deliberation-scoped (required deliberationId → curried out of the
 * advertised schema by the web adapter), and which form the page-scoped
 * WebMCP set (§2). Inert for the stdio transport; consumed by the web
 * adapter in B1+.
 *
 * Source of truth for the classification: the B0 tool inventory
 * (RESEARCH_PROGRAMME/10_IDEATION_SESSIONS/26-webmcp-deliberation-toolset-
 * scoping-2026-07-07.md §2 + the server.ts survey it cites).
 */
/** Tools that mutate server state (everything else is a read). */
export const WRITE_TOOLS = new Set([
    "resolve_citation",
    "resolve_citations_bulk",
    "propose_argument",
    "propose_structured_argument",
    "propose_argument_chain",
    "answer_critical_question",
    "challenge_critical_question",
    "attack_argument",
    "post_dialogue_move",
    "challenge_argument",
    "respond_to_challenge",
    "decline_challenge",
    "compile_deliberation",
    "propose_warrant",
    "compute_articulation_join", // latent write: may mint a Design row (derivedBy: 'join')
    "bind_participant_to_design",
    "propose_synthesis",
]);
/** Tools whose input schema REQUIRES deliberationId (page-scopable per §1-C2:
 * the web adapter curries the id from the route and strips it from the
 * advertised schema). */
export const DELIBERATION_SCOPED_TOOLS = new Set([
    "list_behaviours",
    "get_deliberation_schema",
    "get_behaviour_at_locus",
    "get_exposure_map",
    "get_unwitnessed_exposure",
    "get_legal_moves",
    "get_commitments",
    "attack_argument",
    "post_dialogue_move",
    "challenge_argument",
    "respond_to_challenge",
    "compile_deliberation",
    "get_deliberation_fingerprint",
    "get_contested_frontier",
    "get_missing_moves",
    "get_chains",
    "get_synthetic_readout",
    "get_cross_context",
    "summarize_debate",
    "get_deliberation_evidence_context",
    "ecc_arrow",
    "ecc_culprits",
    "ecc_confidence",
    "ecc_enthymemes",
    "ecc_transport",
    "ecc_aggregate",
    "ecc_evidential",
    "ecc_belief_revision_proposals",
    "propose_warrant",
    "list_bindable_moves",
    "bind_participant_to_design",
    "propose_synthesis",
]);
/** The stdio tools backing the page-scoped WebMCP set (§2 tools 1–9 + 11).
 * Tool 10 (`declare_agent_coordinates`) is web-only and lives in the web
 * adapter, not this registry. Page-facing names/currying are applied by the
 * adapter; this set just selects the members. */
export const WEBMCP_BACKING_TOOLS = new Set([
    "get_synthetic_readout", // → get_deliberation_summary
    "search_arguments", // → find_arguments (within_deliberation pinned)
    "get_argument",
    "get_legal_moves",
    "list_schemes",
    "propose_structured_argument", // → propose_argument (page name)
    "attack_argument",
    "post_dialogue_move",
    "answer_critical_question",
    "get_commitments",
]);
/** §4 two-class write policy: dialogue-move kinds that rewrite the user's
 * commitment store and therefore require in-page confirmation on the web
 * channel (additive kinds auto-file as PROPOSED/PENDING). */
export const COMMITMENT_MUTATING_MOVE_KINDS = new Set([
    "CONCEDE",
    "ACCEPT",
    "RETRACT",
    "CLOSE",
]);
