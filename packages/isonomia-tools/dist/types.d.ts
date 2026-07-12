/**
 * Transport-agnostic types for the shared Isonomia tool registry (B0,
 * session 26 §3-A1). The registry holds schemas + descriptions + handlers;
 * everything environment-specific (auth, env vars, base URL, token minting)
 * is injected through ToolsRuntime by the consuming transport:
 *
 *   - stdio MCP server (@app/isonomia-mcp): isoFetch + ISONOMIA_API_TOKEN +
 *     Ludics auto-mint (packages/isonomia-mcp/src/http.ts).
 *   - WebMCP page adapter (B1+): same-origin fetch riding the __session
 *     cookie; hasStaticToken=true (the session user IS the write identity).
 */
/** Init options understood by every transport's fetcher. Mirrors (and is the
 * single source of truth for) the stdio server's IsoFetchInit. */
export interface IsoFetchInit extends RequestInit {
    /** When true, the transport attaches its credential if configured. */
    authenticated?: boolean;
    /** When true, returns the raw response body as a string instead of parsing JSON. */
    raw?: boolean;
    /**
     * When set and the transport supports Ludics auto-mint, a fresh
     * deliberation-scoped JWT is minted for this request. Transports without
     * auto-mint (e.g. the web adapter) ignore this.
     */
    ludicsDeliberationId?: string;
    /** Per-request timeout override in ms. */
    timeoutMs?: number;
    /**
     * HTTP statuses whose JSON bodies are returned as values instead of thrown,
     * so protocol rejections (R-codes) reach the agent as structured data.
     */
    tolerateStatuses?: number[];
}
export type IsoFetch = <T = unknown>(path: string, init?: IsoFetchInit) => Promise<T>;
/** One registered tool: name, description, JSON-Schema input, handler. */
export interface ToolSpec {
    name: string;
    description: string;
    inputSchema: any;
    handler: (args: any) => Promise<unknown>;
}
/** Everything a transport must supply to instantiate the registry. */
export interface ToolsRuntime {
    /** The transport's HTTP fetcher (isoFetch-compatible). */
    fetch: IsoFetch;
    /** Public API base, e.g. "https://isonomia.app". */
    baseUrl: string;
    /** Whether a static write credential is configured (stdio: ISONOMIA_API_TOKEN;
     * web: true — the session cookie is the credential). Write tools refuse
     * with a descriptive error when false. */
    hasStaticToken: boolean;
    /** Whether Ludics scoped-JWT auto-mint is configured (stdio-only; web: () => false). */
    autoMintConfigured: () => boolean;
    /** Default Ludics participant id, if configured (stdio: LUDICS_PARTICIPANT_ID;
     * web: () => undefined). */
    defaultParticipantId: () => string | undefined;
}
