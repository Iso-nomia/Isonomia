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
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { createTools, SERVER_INSTRUCTIONS } from "@app/isonomia-tools";
import { BASE_URL, API_TOKEN, isoFetch } from "./http.js";
import { isLudicsAutoMintConfigured } from "./ludicsAuth.js";
const tools = createTools({
    fetch: isoFetch,
    baseUrl: BASE_URL,
    hasStaticToken: Boolean(API_TOKEN),
    autoMintConfigured: isLudicsAutoMintConfigured,
    defaultParticipantId: () => process.env.LUDICS_PARTICIPANT_ID,
});
// ============================================================
// MCP server bootstrap
// ============================================================
async function main() {
    const server = new Server({ name: "isonomia-mcp", version: "0.1.0" }, {
        capabilities: { tools: {} },
        instructions: SERVER_INSTRUCTIONS,
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
        })),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const { name, arguments: args } = req.params;
        const tool = tools.find((t) => t.name === name);
        if (!tool) {
            return {
                content: [{ type: "text", text: `Unknown tool: ${name}` }],
                isError: true,
            };
        }
        try {
            const result = await tool.handler(args ?? {});
            return {
                content: [
                    {
                        type: "text",
                        text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                    },
                ],
            };
        }
        catch (err) {
            return {
                content: [{ type: "text", text: `Error: ${err?.message || String(err)}` }],
                isError: true,
            };
        }
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Log to stderr (stdout is reserved for the MCP protocol stream).
    console.error(`[isonomia-mcp] connected. base=${BASE_URL} authenticated=${API_TOKEN ? "yes" : "no"} tools=${tools.length}`);
}
main().catch((err) => {
    console.error("[isonomia-mcp] fatal:", err);
    process.exit(1);
});
