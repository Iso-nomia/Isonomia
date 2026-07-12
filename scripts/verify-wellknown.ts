/**
 * scripts/verify-wellknown.ts
 *
 * Track B.1 smoke test:
 *   - GET /.well-known/llms.txt          (text/markdown)
 *   - GET /.well-known/argument-graph    (application/json manifest)
 *
 * Asserts content type, required keys, and that the endpoints the
 * manifest advertises actually respond.
 *
 * Usage:
 *   npx tsx scripts/verify-wellknown.ts
 *
 * Requires the Next dev server to be running at ISONOMIA_BASE_URL
 * (default http://localhost:3000).
 */

const BASE_URL = process.env.ISONOMIA_BASE_URL || "http://localhost:3000";

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

async function main() {
  console.log(`Verifying .well-known endpoints against ${BASE_URL}\n`);

  // ── llms.txt ────────────────────────────────────────────────────────
  section("/.well-known/llms.txt");
  const llmsRes = await fetch(`${BASE_URL}/.well-known/llms.txt`, {
    headers: { Accept: "text/markdown, text/plain, */*" },
  });
  assert(llmsRes.status === 200, "responds 200");
  const llmsCt = llmsRes.headers.get("content-type") ?? "";
  assert(
    llmsCt.includes("text/markdown") || llmsCt.includes("text/plain"),
    `content-type is text/markdown (got: ${llmsCt})`
  );
  const llmsBody = await llmsRes.text();
  assert(llmsBody.length > 200, "body has substantive content (>200 chars)");
  assert(llmsBody.startsWith("# "), "body starts with a markdown H1");
  for (const required of [
    "Quick links",
    "Canonical retrieval shapes",
    "Citation contract",
    "Model Context Protocol",
    "argument-graph",
    "openapi.json",
  ]) {
    assert(llmsBody.includes(required), `mentions "${required}"`);
  }
  assert(
    llmsRes.headers.get("access-control-allow-origin") === "*",
    "is CORS-public"
  );

  // ── argument-graph ──────────────────────────────────────────────────
  section("/.well-known/argument-graph");
  const agRes = await fetch(`${BASE_URL}/.well-known/argument-graph`);
  assert(agRes.status === 200, "responds 200");
  const agCt = agRes.headers.get("content-type") ?? "";
  assert(agCt.includes("application/json"), `content-type is JSON (got: ${agCt})`);
  const manifest: any = await agRes.json();
  assert(
    agRes.headers.get("access-control-allow-origin") === "*",
    "is CORS-public"
  );

  // ── manifest shape ─────────────────────────────────────────────────
  section("manifest shape");
  assert(typeof manifest.version === "string", "version is a string");
  assert(manifest.service?.name === "Isonomia", "service.name === 'Isonomia'");
  assert(
    typeof manifest.service?.baseUrl === "string" &&
      manifest.service.baseUrl.startsWith("http"),
    "service.baseUrl is an http(s) URL"
  );
  assert(
    Array.isArray(manifest.formats) && manifest.formats.length >= 4,
    "formats includes at least 4 representations"
  );
  for (const k of [
    "argumentByPermalink",
    "argumentByPermalinkImmutable",
    "argumentAttestation",
    "claim",
    "search",
    "proposeArgument",
  ]) {
    assert(
      typeof manifest.endpoints?.[k]?.url === "string",
      `endpoints.${k}.url is set`
    );
  }
  assert(
    manifest.citation?.contentAddressing === "sha256",
    "citation.contentAddressing === 'sha256'"
  );
  assert(
    manifest.counterCitation?.enabled === true,
    "counterCitation.enabled === true"
  );
  assert(
    manifest.mcp?.transport === "stdio" &&
      Array.isArray(manifest.mcp?.tools) &&
      manifest.mcp.tools.length === 6,
    "mcp manifests 6 stdio tools"
  );
  for (const t of [
    "search_arguments",
    "get_argument",
    "get_claim",
    "find_counterarguments",
    "cite_argument",
    "propose_argument",
  ]) {
    assert(
      manifest.mcp.tools.some((x: any) => x.name === t),
      `mcp.tools includes "${t}"`
    );
  }
  assert(
    typeof manifest.schemas?.openapi?.url === "string" &&
      manifest.schemas.openapi.url.endsWith("/api/v3/openapi.json"),
    "schemas.openapi.url points at /api/v3/openapi.json"
  );
  assert(
    Array.isArray(manifest.schemas?.schemaOrg?.types) &&
      manifest.schemas.schemaOrg.types.includes("ClaimReview"),
    "schemas.schemaOrg.types includes ClaimReview"
  );
  assert(
    manifest.capabilities?.counterCitationReflex === true,
    "capabilities.counterCitationReflex === true"
  );
  assert(
    manifest.capabilities?.contentAddressing === true,
    "capabilities.contentAddressing === true"
  );
  assert(
    typeof manifest.meta?.docsHumanReadable === "string" &&
      manifest.meta.docsHumanReadable.endsWith("/.well-known/llms.txt"),
    "meta.docsHumanReadable cross-links to llms.txt"
  );

  // ── advertised endpoints actually respond ──────────────────────────
  // Manifest advertises canonical (prod) URLs. For the smoke check we
  // rewrite them onto the BASE_URL we're verifying against.
  section("advertised endpoints respond");
  const advertisedBase = manifest.service.baseUrl.replace(/\/$/, "");
  const localize = (u: string) =>
    u.startsWith(advertisedBase) ? BASE_URL + u.slice(advertisedBase.length) : u;
  const searchUrl = localize(manifest.endpoints.search.url);
  const searchRes = await fetch(`${searchUrl}?limit=1`);
  assert(searchRes.status === 200, `GET search.url responds 200 (${searchUrl})`);
  if (searchRes.status === 200) {
    const j: any = await searchRes.json();
    assert(j.ok === true, "search response has ok:true");
    assert(Array.isArray(j.results), "search response has results[]");
  }
  const docsUrl = localize(manifest.meta.docsHumanReadable);
  const docsRes = await fetch(docsUrl, { headers: { Accept: "text/markdown" } });
  assert(docsRes.status === 200, `meta.docsHumanReadable resolves 200 (${docsUrl})`);

  // ── summary ─────────────────────────────────────────────────────────
  console.log(`\n${passed}/${passed + failed} passed`);
  if (failed > 0) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
