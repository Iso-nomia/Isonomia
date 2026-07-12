/**
 * scripts/verify-openapi.ts
 *
 * Track B.3 smoke test:
 *   - GET /api/v3/openapi.json     (the spec itself)
 *   - GET /api/v3/docs             (Scalar-rendered docs page)
 *   - Live-probe each documented public GET path against the running
 *     server and assert the response shape matches the spec.
 *
 * Hand-written structural validator (no swagger-parser dep) because the
 * spec is hand-curated and we want a tight, focused check that mirrors
 * the style of verify-attestation.ts / verify-mcp.ts / verify-wellknown.ts.
 *
 * Usage:
 *   npx tsx scripts/verify-openapi.ts
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
  console.log(`Verifying OpenAPI surface against ${BASE_URL}\n`);

  // \u2500\u2500 spec itself \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  section("/api/v3/openapi.json");
  const specRes = await fetch(`${BASE_URL}/api/v3/openapi.json`);
  assert(specRes.status === 200, "responds 200");
  const ct = specRes.headers.get("content-type") ?? "";
  assert(ct.includes("application/json"), `content-type is JSON (got: ${ct})`);
  assert(
    specRes.headers.get("access-control-allow-origin") === "*",
    "is CORS-public",
  );
  const cc = specRes.headers.get("cache-control") ?? "";
  assert(/max-age=\d+/.test(cc), `Cache-Control sets max-age (got: ${cc})`);

  const spec: any = await specRes.json();

  // \u2500\u2500 OpenAPI 3.1 structural shape \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  section("OpenAPI 3.1 structure");
  assert(spec.openapi === "3.1.0", `openapi === '3.1.0' (got: ${spec.openapi})`);
  assert(typeof spec.info?.title === "string", "info.title set");
  assert(spec.info?.version === "v3", "info.version === 'v3'");
  assert(typeof spec.info?.description === "string", "info.description set");
  assert(
    spec.info?.["x-mcp-server"]?.package === "@isonomia/mcp",
    "info.x-mcp-server.package === '@isonomia/mcp'",
  );
  assert(
    Array.isArray(spec.info?.["x-mcp-server"]?.tools) &&
      spec.info["x-mcp-server"].tools.length === 6,
    "info.x-mcp-server lists 6 MCP tools",
  );
  assert(Array.isArray(spec.servers) && spec.servers.length >= 1, "servers[] set");
  assert(Array.isArray(spec.tags) && spec.tags.length >= 4, "tags[] >= 4");
  assert(spec.components?.securitySchemes?.bearerAuth?.scheme === "bearer", "bearerAuth scheme set");

  // \u2500\u2500 paths coverage \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  section("paths");
  const expectedPaths: Array<{ path: string; method: string; opId: string }> = [
    { path: "/api/v3/search/arguments", method: "get", opId: "searchArguments" },
    { path: "/api/a/{shortCode}/aif", method: "get", opId: "getArgumentRepresentation" },
    { path: "/api/a/{shortCode}/aif", method: "head", opId: "headArgumentRepresentation" },
    { path: "/api/c/{moid}", method: "get", opId: "getClaim" },
    { path: "/api/arguments/quick", method: "post", opId: "proposeArgument" },
    { path: "/.well-known/argument-graph", method: "get", opId: "getArgumentGraphManifest" },
    { path: "/.well-known/llms.txt", method: "get", opId: "getLlmsTxt" },
  ];
  for (const e of expectedPaths) {
    const op = spec.paths?.[e.path]?.[e.method];
    assert(!!op, `paths[${e.path}].${e.method} present`);
    assert(op?.operationId === e.opId, `${e.path}.${e.method}.operationId === '${e.opId}'`);
    assert(typeof op?.description === "string" && op.description.length > 40, `${e.opId} has substantive description`);
  }

  // proposeArgument requires bearerAuth
  const propose = spec.paths?.["/api/arguments/quick"]?.post;
  assert(
    Array.isArray(propose?.security) &&
      propose.security.some((s: any) => s.bearerAuth !== undefined),
    "proposeArgument requires bearerAuth",
  );

  // \u2500\u2500 schemas coverage \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  section("components.schemas");
  for (const s of [
    "Error",
    "Scheme",
    "Conclusion",
    "Premise",
    "EvidenceProvenance",
    "Testedness",
    "StandingState",
    "DialecticalStatus",
    "AttestationEnvelope",
    "ArgumentJsonLd",
    "ArgumentSearchResult",
    "SearchResponse",
    "ClaimEvidenceItem",
    "ClaimResponse",
    "ProposeArgumentInput",
    "ProposeArgumentResponse",
  ]) {
    assert(!!spec.components?.schemas?.[s], `components.schemas.${s} defined`);
  }

  // StandingState 5-bucket enum (Claude-feedback batch)
  const ss = spec.components?.schemas?.StandingState;
  assert(
    Array.isArray(ss?.enum) && ss.enum.length === 5,
    "StandingState has 5 enum values",
  );
  for (const v of [
    "untested-default",
    "untested-supported",
    "tested-attacked",
    "tested-undermined",
    "tested-survived",
  ]) {
    assert(ss?.enum?.includes(v), `StandingState includes '${v}'`);
  }

  // \u2500\u2500 docs page \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  section("/api/v3/docs");
  const docsRes = await fetch(`${BASE_URL}/api/v3/docs`);
  assert(docsRes.status === 200, "responds 200");
  const docsBody = await docsRes.text();
  assert(
    docsBody.includes('id="api-reference"'),
    "renders Scalar <script id='api-reference'>",
  );
  assert(
    docsBody.includes('data-url="/api/v3/openapi.json"'),
    "Scalar element points at /api/v3/openapi.json",
  );
  assert(
    docsBody.includes("@scalar/api-reference"),
    "loads the Scalar bundle",
  );

  // \u2500\u2500 live-probe documented GET endpoints \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // Anything path-parameterized (/api/a/{shortCode}, /api/c/{moid}) needs
  // a real id; we resolve one via search first.
  section("live response shapes");
  const searchProbe = await fetch(
    `${BASE_URL}/api/v3/search/arguments?limit=1`,
  );
  assert(searchProbe.status === 200, "GET /api/v3/search/arguments?limit=1 \u2192 200");
  const searchJson: any = searchProbe.status === 200 ? await searchProbe.json() : null;
  assert(searchJson?.ok === true, "search ok:true");
  assert(Array.isArray(searchJson?.results), "search has results[]");

  const sample = searchJson?.results?.[0];
  if (sample) {
    // search result shape sanity
    assert(typeof sample.permalink === "string", "search result has permalink");
    assert(typeof sample.attestationUrl === "string", "search result has attestationUrl");
    assert(typeof sample.scheme === "object", "search result has scheme");

    // pull short code from permalink (.../a/<shortCode>)
    const m = String(sample.permalink).match(/\/a\/([^/?#]+)/);
    const shortCode = m?.[1];
    if (shortCode) {
      const aifRes = await fetch(`${BASE_URL}/api/a/${shortCode}/aif`);
      assert(aifRes.status === 200, `GET /api/a/${shortCode}/aif \u2192 200`);
      assert(!!aifRes.headers.get("etag"), "AIF response has ETag");
      assert(
        !!aifRes.headers.get("x-isonomia-content-hash"),
        "AIF response has X-Isonomia-Content-Hash",
      );
      const headRes = await fetch(`${BASE_URL}/api/a/${shortCode}/aif`, { method: "HEAD" });
      assert(headRes.status === 200, `HEAD /api/a/${shortCode}/aif \u2192 200`);
    } else {
      assert(false, "could not extract shortCode from search result permalink");
    }

    // claim probe via the conclusion MOID exposed in the AIF result
    const moid = sample?.conclusion?.moid;
    if (moid) {
      const claimRes = await fetch(`${BASE_URL}/api/c/${moid}`);
      assert(claimRes.status === 200, `GET /api/c/${moid} \u2192 200`);
      const claimJson: any = await claimRes.json();
      assert(claimJson?.ok === true, "claim ok:true");
      assert(typeof claimJson?.claim === "object", "claim payload present");
    }
  } else {
    console.log("  \u2192 no search results; skipping path-parameterized live probes");
  }

  // discovery surfaces (advertised by the spec)
  const agRes = await fetch(`${BASE_URL}/.well-known/argument-graph`);
  assert(agRes.status === 200, "GET /.well-known/argument-graph \u2192 200");
  const llmsRes = await fetch(`${BASE_URL}/.well-known/llms.txt`);
  assert(llmsRes.status === 200, "GET /.well-known/llms.txt \u2192 200");

  // \u2500\u2500 summary \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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
