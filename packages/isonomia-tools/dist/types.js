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
export {};
