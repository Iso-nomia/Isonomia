#!/usr/bin/env node
/**
 * Isonomia MCP Server (Track B.2)
 * ──────────────────────────────────────────────────────────────────
 *
 * A Model Context Protocol stdio server that exposes Isonomia's
 * argument-graph as structured tools for LLM clients (Claude Desktop,
 * Cursor, Cline, Continue, etc.).
 *
 * B0 (session 26): the tool registry — schemas, descriptions, handlers —
 * lives in the shared workspace package `@app/isonomia-tools` and is
 * instantiated here with this transport's runtime (isoFetch + static
 * bearer + Ludics auto-mint). This file is only the stdio wiring; tool
 * behavior is byte-identical to the pre-extraction server (gated by the
 * B0 tools/list dump-diff). The WebMCP page adapter (B1+) consumes the
 * same registry with a cookie-authenticated fetcher.
 *
 * Run:
 *   ISONOMIA_BASE_URL=https://isonomia.app \
 *   ISONOMIA_API_TOKEN=...                 \
 *   isonomia-mcp
 *
 * Claude Desktop config (~/Library/Application Support/Claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "isonomia": {
 *         "command": "node",
 *         "args": ["/abs/path/to/packages/isonomia-mcp/dist/server.js"],
 *         "env": {
 *           "ISONOMIA_BASE_URL": "https://isonomia.app",
 *           "ISONOMIA_API_TOKEN": "<optional, only for write tools>"
 *         }
 *       }
 *     }
 *   }
 *
 * Env (see http.ts and ludicsAuth.ts for full docs):
 *   ISONOMIA_BASE_URL, ISONOMIA_API_TOKEN, ISONOMIA_TIMEOUT_MS,
 *   LUDICS_JWT_SIGNING_KEY, LUDICS_PARTICIPANT_ID, LUDICS_JWT_ISSUER,
 *   LUDICS_JWT_TTL_SECONDS.
 */
export {};
