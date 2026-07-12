/**
 * scripts/verify-mcp.ts
 *
 * Track B.2 smoke test: spawns the MCP stdio server as a child process,
 * speaks the JSON-RPC framing the protocol expects, and exercises every
 * tool against the local dev server.
 *
 * Usage:
 *   npx tsx scripts/verify-mcp.ts
 *   npx tsx scripts/verify-mcp.ts <shortCode>
 *
 * Requires the Next dev server to be running at ISONOMIA_BASE_URL
 * (default http://localhost:3000) and the MCP package to have been built
 * (npm run -w @app/isonomia-mcp build).
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { prisma } from "../lib/prismaclient";

const BASE_URL = process.env.ISONOMIA_BASE_URL || "http://localhost:3000";
const MCP_BIN = path.join(
  process.cwd(),
  "packages/isonomia-mcp/dist/server.js"
);

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: any, label: string) {
  if (cond) {
    console.log(`  \u2713 ${label}`);
    passed++;
  } else {
    console.log(`  \u2717 ${label}`);
    failed++;
    failures.push(label);
  }
}
function section(title: string) {
  console.log(`\n\u2500\u2500 ${title} \u2500\u2500`);
}

// ─── stdio JSON-RPC client ─────────────────────────────────────────────
class McpClient {
  private proc;
  private buf = "";
  private nextId = 1;
  private pending = new Map<number, (msg: any) => void>();

  constructor(env: Record<string, string>) {
    this.proc = spawn("node", [MCP_BIN], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.proc.stderr.on("data", (chunk) => {
      // surface server stderr (banner, errors) prefixed for clarity
      process.stderr.write(`[mcp:stderr] ${chunk}`);
    });
    this.proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[mcp] server exited with code ${code}`);
      }
    });
  }

  private onData(chunk: string) {
    this.buf += chunk;
    // Newline-delimited JSON (the SDK's stdio transport uses this framing).
    let nl;
    while ((nl = this.buf.indexOf("\n")) !== -1) {
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.id != null && this.pending.has(msg.id)) {
          this.pending.get(msg.id)!(msg);
          this.pending.delete(msg.id);
        }
      } catch (err) {
        console.error("[mcp] failed to parse line:", line.slice(0, 200));
      }
    }
  }

  request(method: string, params?: any): Promise<any> {
    const id = this.nextId++;
    const msg = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request ${method} timed out`));
      }, 30000);
      this.pending.set(id, (resp) => {
        clearTimeout(timer);
        resolve(resp);
      });
      this.proc.stdin.write(JSON.stringify(msg) + "\n");
    });
  }

  notify(method: string, params?: any) {
    this.proc.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n"
    );
  }

  close() {
    try {
      this.proc.stdin.end();
    } catch {}
    this.proc.kill();
  }
}

// ─── Pick a shortCode from the DB ──────────────────────────────────────
async function pickShortCode(): Promise<string | null> {
  const cli = process.argv[2];
  if (cli) return cli;
  const row = await prisma.argumentPermalink.findFirst({
    orderBy: [{ lastAccessedAt: "desc" }, { createdAt: "desc" }],
    select: { shortCode: true },
  });
  return row?.shortCode ?? null;
}

async function main() {
  const shortCode = await pickShortCode();
  if (!shortCode) {
    console.error("No ArgumentPermalink in DB. Pass one as the first arg.");
    process.exit(2);
  }
  console.log(`Verifying MCP tools against /a/${shortCode}`);
  console.log(`MCP bin: ${MCP_BIN}`);
  console.log(`API base: ${BASE_URL}`);

  const client = new McpClient({ ISONOMIA_BASE_URL: BASE_URL });

  // ── MCP handshake ──
  const init = await client.request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "verify-mcp", version: "0.1.0" },
  });
  assert(init?.result?.serverInfo?.name === "isonomia-mcp", "initialize \u2192 isonomia-mcp");
  client.notify("notifications/initialized");
  // Brief settle so the server flushes its banner before we send the next request.
  await new Promise((r) => setTimeout(r, 100));

  // ── tools/list ──
  section("1. tools/list");
  const list = await client.request("tools/list", {});
  const toolNames: string[] = (list?.result?.tools ?? []).map((t: any) => t.name);
  assert(toolNames.length === 6, `tools/list returns 6 tools (got ${toolNames.length})`);
  for (const expected of [
    "search_arguments",
    "get_argument",
    "get_claim",
    "find_counterarguments",
    "cite_argument",
    "propose_argument",
  ]) {
    assert(toolNames.includes(expected), `tool registered: ${expected}`);
  }

  // helper to call a tool and parse its single text payload as JSON
  async function callTool(name: string, args: any) {
    const r = await client.request("tools/call", { name, arguments: args });
    const block = r?.result?.content?.[0];
    if (!block || block.type !== "text") {
      return { ok: false, raw: r, parsed: null };
    }
    let parsed: any = null;
    try {
      parsed = JSON.parse(block.text);
    } catch {
      parsed = block.text;
    }
    return { ok: !r?.result?.isError, parsed, raw: r };
  }

  // ── get_argument ──
  section("2. get_argument");
  const ga = await callTool("get_argument", { permalink: shortCode });
  assert(ga.ok, "get_argument \u2192 not error");
  assert(ga.parsed?.contentHash?.startsWith?.("sha256:"), "get_argument returns contentHash");
  assert(typeof ga.parsed?.permalink === "string", "get_argument returns permalink");
  assert(Array.isArray(ga.parsed?.evidence), "get_argument returns evidence array");
  assert(ga.parsed?.dialecticalStatus, "get_argument returns dialecticalStatus");

  // ── cite_argument ──
  section("3. cite_argument");
  const ca = await callTool("cite_argument", { permalink: shortCode });
  assert(ca.ok, "cite_argument → not error");
  assert(typeof ca.parsed?.markdown === "string" && ca.parsed.markdown.length > 50, "cite_argument returns markdown block");
  assert(ca.parsed?.contentHash?.startsWith?.("sha256:"), "cite_argument returns contentHash");
  assert(typeof ca.parsed?.immutablePermalink === "string", "cite_argument returns immutablePermalink");
  // Premise / evidence provenance counters (Claude-feedback fix)
  assert(
    ca.parsed?.provenance && typeof ca.parsed.provenance.premiseCount === "number",
    "cite_argument returns provenance.premiseCount"
  );
  assert(
    typeof ca.parsed?.provenance?.evidenceAttachedCount === "number",
    "cite_argument returns provenance.evidenceAttachedCount"
  );
  assert(
    typeof ca.parsed?.provenance?.unattestedPremises === "boolean",
    "cite_argument returns provenance.unattestedPremises flag"
  );
  // standingState classification (Claude-feedback fix)
  const validStates = ["untested-default", "untested-supported", "tested-attacked", "tested-survived", "tested-undermined"];
  assert(
    validStates.includes(ca.parsed?.dialecticalStatus?.standingState),
    `cite_argument exposes standingState (got ${ca.parsed?.dialecticalStatus?.standingState})`
  );
  // Counter-citation reflex (Claude-feedback fix): default ON; when no
  // counter exists, must be honest-empty (null), not throw.
  assert(
    "strongestObjection" in (ca.parsed ?? {}),
    "cite_argument includes strongestObjection field by default"
  );
  assert(
    ca.parsed?.strongestObjection === null ||
      (typeof ca.parsed?.strongestObjection === "object" &&
        typeof ca.parsed.strongestObjection.permalink === "string"),
    "strongestObjection is either null (honest-empty) or a counter-argument object with permalink"
  );

  // ── search_arguments ──
  section("4. search_arguments");
  const sa = await callTool("search_arguments", { query: "the", limit: 3 });
  assert(sa.ok, "search_arguments → not error");
  assert(Array.isArray(sa.parsed?.results), "search_arguments returns results array");
  // dialectical_fitness sort (Upgrade #3)
  const saF = await callTool("search_arguments", { query: "the", limit: 3, sort: "dialectical_fitness" });
  assert(saF.ok, "search_arguments sort=dialectical_fitness → not error");
  assert(saF.parsed?.query?.sort === "dialectical_fitness", "response echoes sort=dialectical_fitness");
  if (Array.isArray(saF.parsed?.results) && saF.parsed.results.length > 0) {
    assert(
      typeof saF.parsed.results[0].dialecticalFitness === "number",
      "dialectical_fitness sort decorates each result with dialecticalFitness number"
    );
  } else {
    console.log("    (—) skipped fitness-monotonic check: no results in fitness mode");
  }

  // ── get_claim ──
  section("5. get_claim");
  const conclusionMoid = ga.parsed?.conclusion?.moid;
  if (conclusionMoid) {
    const gc = await callTool("get_claim", { moid: conclusionMoid });
    assert(gc.ok, "get_claim \u2192 not error");
    assert(gc.parsed?.claim?.moid === conclusionMoid, "get_claim returns matching moid");
    assert(Array.isArray(gc.parsed?.arguments?.supporting), "get_claim returns supporting list");
  } else {
    console.log("    (\u2014) skipped: argument has no conclusion claim moid");
  }

  // ── find_counterarguments ──
  section("6. find_counterarguments");
  const fc = await callTool("find_counterarguments", {
    claim_text: ga.parsed?.conclusion?.text?.slice?.(0, 60) || "test",
    limit: 3,
  });
  assert(fc.ok, "find_counterarguments → not error");
  assert(Array.isArray(fc.parsed?.results), "find_counterarguments returns results array");

  // Honest-empty rule (Claude-feedback fix): when given the conclusion's
  // own MOID as the target, the same argument must not appear as its own
  // counter. Same-conclusion-moid is excluded server-side.
  if (conclusionMoid) {
    const fcSelf = await callTool("find_counterarguments", {
      claim_moid: conclusionMoid,
      limit: 5,
    });
    assert(fcSelf.ok, "find_counterarguments(self-moid) → not error");
    const sameMoidLeak = (fcSelf.parsed?.results ?? []).some(
      (r: any) => r?.conclusion?.moid === conclusionMoid
    );
    assert(!sameMoidLeak, "find_counterarguments excludes arguments with same conclusion MOID (no false self-counters)");
  } else {
    console.log("    (—) skipped self-moid honest-empty check: no conclusion moid");
  }

  // ── propose_argument (no token \u2192 should error gracefully) ──
  section("7. propose_argument (no token)");
  const pa = await callTool("propose_argument", {
    claim: "MCP smoke test claim",
  });
  assert(!pa.ok, "propose_argument without token \u2192 error");
  const errMsg = (pa.parsed && typeof pa.parsed === "string") ? pa.parsed : JSON.stringify(pa.parsed);
  assert(errMsg.includes("ISONOMIA_API_TOKEN"), "error message mentions ISONOMIA_API_TOKEN");

  client.close();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
