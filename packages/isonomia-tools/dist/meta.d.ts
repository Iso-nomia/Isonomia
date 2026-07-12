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
export declare const WRITE_TOOLS: ReadonlySet<string>;
/** Tools whose input schema REQUIRES deliberationId (page-scopable per §1-C2:
 * the web adapter curries the id from the route and strips it from the
 * advertised schema). */
export declare const DELIBERATION_SCOPED_TOOLS: ReadonlySet<string>;
/** The stdio tools backing the page-scoped WebMCP set (§2 tools 1–9 + 11).
 * Tool 10 (`declare_agent_coordinates`) is web-only and lives in the web
 * adapter, not this registry. Page-facing names/currying are applied by the
 * adapter; this set just selects the members. */
export declare const WEBMCP_BACKING_TOOLS: ReadonlySet<string>;
/** §4 two-class write policy: dialogue-move kinds that rewrite the user's
 * commitment store and therefore require in-page confirmation on the web
 * channel (additive kinds auto-file as PROPOSED/PENDING). */
export declare const COMMITMENT_MUTATING_MOVE_KINDS: ReadonlySet<string>;
