// B0 smoke gate for the isonomia-mcp stdio server.
//
// 1. `node scripts/smoke.mjs dump` — print sorted tools/list JSON (pipe to a
//    file and diff across changes; the B0 extraction gate is `diff` = empty).
// 2. `node scripts/smoke.mjs` — assert toolCount, call get_capabilities and
//    get_orientation through the real CallTool path (exercises the injected
//    ToolsRuntime without any network), exit non-zero on failure.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "dist", "server.js");
const mode = process.argv[2] ?? "assert";

const child = spawn("node", [serverPath], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, ISONOMIA_BASE_URL: "https://isonomia.app" },
});

let buf = "";
const responses = new Map();
child.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id != null) responses.set(msg.id, msg);
  }
});

const send = (msg) => child.stdin.write(JSON.stringify(msg) + "\n");
const waitFor = (id, ms = 5000) =>
  new Promise((resolve, reject) => {
    const t0 = Date.now();
    const poll = setInterval(() => {
      if (responses.has(id)) {
        clearInterval(poll);
        resolve(responses.get(id));
      } else if (Date.now() - t0 > ms) {
        clearInterval(poll);
        reject(new Error(`timeout waiting for response id=${id}`));
      }
    }, 25);
  });

const fail = (msg) => {
  console.error(`SMOKE FAIL: ${msg}`);
  child.kill();
  process.exit(1);
};

try {
  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0.0.0" },
    },
  });
  const init = await waitFor(1);
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const list = await waitFor(2);
  const tools = list.result.tools
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  if (mode === "dump") {
    console.log(
      JSON.stringify(
        {
          serverInfo: init.result?.serverInfo ?? null,
          instructions: init.result?.instructions ?? null,
          toolCount: tools.length,
          tools,
        },
        null,
        2,
      ),
    );
    child.kill();
    process.exit(0);
  }

  if (tools.length !== 66) fail(`expected 66 tools, got ${tools.length}`);
  if (!init.result?.instructions?.startsWith("Isonomia exposes a deliberation"))
    fail("server instructions missing or changed unexpectedly");

  send({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "get_capabilities", arguments: {} },
  });
  const caps = await waitFor(3);
  const capsBody = JSON.parse(caps.result.content[0].text);
  if (capsBody.toolCount !== 66) fail(`get_capabilities toolCount=${capsBody.toolCount}`);
  if (typeof capsBody.auth?.staticTokenConfigured !== "boolean")
    fail("get_capabilities auth block malformed (ToolsRuntime injection broken?)");
  if (capsBody.apiBaseUrl !== "https://isonomia.app")
    fail(`get_capabilities apiBaseUrl=${capsBody.apiBaseUrl}`);

  send({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "get_orientation", arguments: {} },
  });
  const orient = await waitFor(4);
  const orientBody = JSON.parse(orient.result.content[0].text);
  if (!orientBody.version || !orientBody.contentHash)
    fail("get_orientation missing version/contentHash");
  if (orientBody.contentHash !== capsBody.orientationContentHash)
    fail("orientation contentHash mismatch between get_orientation and get_capabilities");

  console.log(
    `SMOKE OK: 66 tools, instructions present, get_capabilities + get_orientation live (orientation v${orientBody.version}).`,
  );
  child.kill();
  process.exit(0);
} catch (err) {
  fail(err?.message ?? String(err));
}
