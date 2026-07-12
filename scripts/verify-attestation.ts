/**
 * scripts/verify-attestation.ts
 *
 * Smoke + determinism check for Track A.1 + A.2 of the
 * AI-Epistemic-Infrastructure Roadmap.
 *
 * Usage:
 *   tsx scripts/verify-attestation.ts <shortCode>
 *   BASE_URL=http://localhost:3000 tsx scripts/verify-attestation.ts <shortCode>
 *
 * If <shortCode> is omitted, the script picks the most recently accessed
 * ArgumentPermalink from the database.
 *
 * Exits non-zero on any failed assertion.
 */

import { prisma } from "@/lib/prismaclient";
import { verifyAttestation, type Jwks } from "@/server/trust/attestationSigner";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// ---- Tiny test harness ----
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: unknown, label: string) {
  if (cond) {
    passed++;
    console.log(`  \u2713 ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  \u2717 ${label}`);
  }
}

function section(title: string) {
  console.log(`\n\u2500\u2500 ${title} \u2500\u2500`);
}

// ---- HTTP helper ----
async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // leave json null; caller can inspect text
  }
  return {
    status: res.status,
    headers: res.headers,
    text,
    json,
  };
}

// ---- Resolve target shortCode ----
async function pickShortCode(): Promise<string | null> {
  const cli = process.argv[2];
  if (cli) return cli;
  const row = await prisma.argumentPermalink.findFirst({
    orderBy: [{ lastAccessedAt: "desc" }, { createdAt: "desc" }],
    select: { shortCode: true },
  });
  return row?.shortCode ?? null;
}

// ---- Main ----
async function main() {
  const shortCode = await pickShortCode();
  if (!shortCode) {
    console.error(
      "No ArgumentPermalink found. Pass a short code: tsx scripts/verify-attestation.ts <shortCode>"
    );
    process.exit(2);
  }

  console.log(`Verifying attestation surface for /a/${shortCode}`);
  console.log(`Base URL: ${BASE_URL}`);

  const aifBase = `${BASE_URL}/api/a/${shortCode}/aif`;

  // ===== 1. Attestation envelope =====
  section("1. format=attestation");
  const att1 = await fetchJson(`${aifBase}?format=attestation`);
  assert(att1.status === 200, `GET ${aifBase}?format=attestation \u2192 200`);
  assert(att1.json && typeof att1.json === "object", "response parses as JSON");
  const env = att1.json || {};
  assert(
    typeof env.contentHash === "string" &&
      /^sha256:[0-9a-f]{64}$/.test(env.contentHash),
    `contentHash matches sha256:[0-9a-f]{64} (got ${env.contentHash})`
  );
  assert(
    typeof env.permalink === "string" && env.permalink.includes(`/a/${shortCode}`),
    `permalink references /a/${shortCode}`
  );
  assert(
    typeof env.immutablePermalink === "string" &&
      env.immutablePermalink.includes(env.contentHash?.replace("sha256:", "") || "__none__"),
    "immutablePermalink embeds the content hash"
  );
  assert(typeof env.version === "number" && env.version >= 1, "version is a positive number");
  assert(env.dialecticalStatus && typeof env.dialecticalStatus === "object", "dialecticalStatus block present");
  const ds = env.dialecticalStatus || {};
  for (const k of [
    "incomingAttacks",
    "incomingSupports",
    "incomingAttackEdges",
    "criticalQuestionsRequired",
    "criticalQuestionsAnswered",
    "criticalQuestionsOpen",
    "isTested",
    "testedness",
  ]) {
    assert(k in ds, `dialecticalStatus.${k} present`);
  }
  assert(
    ds.standingScore === null ||
      (typeof ds.standingScore === "number" && ds.standingScore >= 0 && ds.standingScore <= 1),
    "standingScore is null or in [0, 1]"
  );
  assert(
    ["untested", "lightly_tested", "well_tested"].includes(ds.testedness),
    `testedness is one of untested|lightly_tested|well_tested (got ${ds.testedness})`
  );
  // No-signal case: when the scheme requires 0 CQs and no inbound traffic,
  // standingScore must be null (not a misleading 1.0).
  if (
    Number(ds.criticalQuestionsRequired ?? 0) === 0 &&
    Number(ds.incomingAttacks ?? 0) === 0 &&
    Number(ds.incomingSupports ?? 0) === 0 &&
    Number(ds.incomingAttackEdges ?? 0) === 0
  ) {
    assert(
      ds.standingScore === null,
      "standingScore is null when no CQs required and no inbound traffic (no-signal case)"
    );
    assert(ds.testedness === "untested", "testedness is 'untested' in the no-signal case");
  }

  // ===== 2. ETag / Cache headers =====
  section("2. ETag, Link, X-Isonomia headers");
  const etag = att1.headers.get("etag");
  assert(typeof etag === "string" && etag.length > 0, `ETag header present (${etag})`);
  assert(
    att1.headers.get("x-isonomia-content-hash") === env.contentHash,
    "X-Isonomia-Content-Hash matches body contentHash"
  );
  assert(
    att1.headers.get("x-isonomia-permalink-version") === String(env.version),
    "X-Isonomia-Permalink-Version matches body version"
  );
  const linkHeader = att1.headers.get("link") || "";
  assert(linkHeader.includes(`rel="canonical"`), "Link header contains rel=canonical");
  assert(linkHeader.includes(`format=aif`), "Link header advertises format=aif alternate");
  assert(linkHeader.includes(`format=jsonld`), "Link header advertises format=jsonld alternate");
  assert(linkHeader.includes(`format=attestation`), "Link header advertises format=attestation alternate");

  // ===== 3. If-None-Match round-trip =====
  section("3. If-None-Match \u2192 304");
  if (etag) {
    const conditional = await fetchJson(`${aifBase}?format=attestation`, {
      headers: { "If-None-Match": etag },
    });
    assert(conditional.status === 304, `Conditional GET returns 304 (got ${conditional.status})`);
  }

  // ===== 4. HEAD probe =====
  section("4. HEAD probe");
  const headRes = await fetch(`${aifBase}`, { method: "HEAD" });
  assert(headRes.status === 200, `HEAD ${aifBase} \u2192 200`);
  const headEtag = headRes.headers.get("etag");
  assert(headEtag === etag, "HEAD ETag matches GET ETag");
  assert(
    headRes.headers.get("x-isonomia-content-hash") === env.contentHash,
    "HEAD X-Isonomia-Content-Hash matches"
  );

  // ===== 5. Determinism =====
  section("5. Determinism (two consecutive calls \u2192 same hash)");
  const att2 = await fetchJson(`${aifBase}?format=attestation`);
  assert(att2.status === 200, "second attestation call \u2192 200");
  assert(
    att2.json?.contentHash === env.contentHash,
    `contentHash stable across calls (a=${env.contentHash}, b=${att2.json?.contentHash})`
  );

  // ===== 6. AIF graph =====
  section("6. format=aif");
  const aif = await fetchJson(`${aifBase}?format=aif`);
  assert(aif.status === 200, "GET ?format=aif \u2192 200");
  const ct = aif.headers.get("content-type") || "";
  assert(ct.includes("application/ld+json"), `Content-Type is application/ld+json (${ct})`);
  assert(aif.json && typeof aif.json === "object", "AIF response parses as JSON");
  assert(aif.json?.["@context"], "AIF graph has @context");
  assert(Array.isArray(aif.json?.["@graph"]), "AIF graph has @graph array");
  const hasRA = (aif.json?.["@graph"] || []).some((n: any) => {
    const t = n?.["@type"];
    if (Array.isArray(t)) return t.includes("aif:RA");
    return t === "aif:RA";
  });
  assert(hasRA, "AIF graph includes at least one aif:RA node");
  assert(
    aif.json?.["iso:attestation"]?.contentHash === env.contentHash,
    "AIF graph carries layered iso:attestation with matching contentHash"
  );

  // ===== 7. Rich JSON-LD =====
  section("7. format=jsonld");
  const rich = await fetchJson(`${aifBase}?format=jsonld`);
  assert(rich.status === 200, "GET ?format=jsonld \u2192 200");
  assert(rich.json?.["@context"], "rich JSON-LD has @context");
  // Top-level is either a single node or an object with @graph (when ClaimReview is emitted)
  const topNode = Array.isArray(rich.json?.["@graph"]) ? rich.json["@graph"][0] : rich.json;
  const types = Array.isArray(topNode?.["@type"]) ? topNode["@type"] : [topNode?.["@type"]];
  assert(types.includes("aif:RA"), "rich JSON-LD top node @type includes aif:RA");
  assert(types.includes("Claim") || types.includes("CreativeWork"), "rich JSON-LD top node @type includes Claim or CreativeWork");
  assert(
    topNode?.contentHash === env.contentHash,
    "rich JSON-LD carries matching contentHash"
  );
  if (ds.isTested) {
    const hasReview = (rich.json?.["@graph"] || []).some(
      (n: any) => n?.["@type"] === "ClaimReview"
    );
    assert(hasReview, "ClaimReview emitted because dialecticalStatus.isTested=true");
  } else {
    console.log("  (\u2014) isTested=false; ClaimReview emission skipped (expected)");
  }

  // ===== 8. Public page content negotiation =====
  section("8. /a/[id] content negotiation");
  // Browser-style request \u2192 HTML
  const html = await fetch(`${BASE_URL}/a/${shortCode}`, {
    headers: { Accept: "text/html" },
    redirect: "manual",
  });
  assert(
    html.status === 200 || html.status === 304,
    `Accept: text/html \u2192 200/304 (got ${html.status})`
  );
  if (html.status === 200) {
    const body = await html.text();
    assert(body.includes(`application/ld+json`), "HTML page contains JSON-LD <script>");
    assert(body.includes(`citation_title`), "HTML page contains citation_title meta tag");
    assert(body.includes(`format=aif`), "HTML page advertises AIF alternate");
  }
  // JSON-LD client \u2192 redirect to /api/a/[id]/aif
  const ldReq = await fetch(`${BASE_URL}/a/${shortCode}`, {
    headers: { Accept: "application/ld+json" },
    redirect: "manual",
  });
  assert(
    ldReq.status >= 300 && ldReq.status < 400,
    `Accept: application/ld+json \u2192 3xx redirect (got ${ldReq.status})`
  );
  const loc = ldReq.headers.get("location") || "";
  assert(loc.includes(`/api/a/${shortCode}/aif`), `redirect Location points at AIF endpoint (${loc})`);

  // ===== 9. 404 on bogus identifier =====
  section("9. 404 on unknown identifier");
  const bogus = await fetchJson(`${BASE_URL}/api/a/__definitely_not_a_real_code__/aif?format=attestation`);
  assert(bogus.status === 404, `unknown identifier \u2192 404 (got ${bogus.status})`);

  // ===== 10. Evidence provenance (Track A.4) =====
  section("10. Evidence provenance shape");
  // The attestation envelope must carry an `evidence` array, and each entry
  // must have the provenance shape \u2014 even when fields are null. This guards
  // the contract LLM clients consume.
  const att = att1.json as any;
  assert(Array.isArray(att?.evidence), "attestation.evidence is an array");
  let provenanceShapeOk = true;
  for (const e of att.evidence ?? []) {
    const keys = ["evidenceId", "uri", "title", "citation", "contentSha256", "archivedUrl", "archivedUrl"];
    for (const k of keys) {
      if (!(k in e)) {
        provenanceShapeOk = false;
        console.log(`    \u2717 evidence row missing key: ${k}`);
      }
    }
  }
  assert(provenanceShapeOk, "every evidence row carries the provenance contract");

  // Live enrichment smoke-test against a known-stable URL. Skips silently if
  // the helper or DB write fails so the script remains useful on isolated dev DBs.
  try {
    const { fetchEvidenceProvenance } = await import("../lib/citations/evidenceProvenance");
    const probe = await fetchEvidenceProvenance("https://example.com/");
    assert(probe.ok === true, `live fetch example.com \u2192 ok (got ok=${probe.ok}, status=${probe.httpStatus}, err=${probe.error})`);
    assert(
      typeof probe.contentSha256 === "string" && /^sha256:[0-9a-f]{64}$/.test(probe.contentSha256 || ""),
      `live fetch contentSha256 matches sha256:[0-9a-f]{64} (got ${probe.contentSha256})`
    );
    assert(typeof probe.byteSize === "number" && probe.byteSize! > 0, `live fetch byteSize > 0 (got ${probe.byteSize})`);
  } catch (err: any) {
    console.log(`    (\u2014) live provenance probe skipped: ${err?.message || err}`);
  }

  // ===== 11. Signed envelope (?signed=1) — offline signature verification =====
  section("11. ?signed=1 signature verifies against /.well-known/issuer-keys");
  const signedRes = await fetchJson(`${aifBase}?format=attestation&signed=1`);
  if (signedRes.status === 501) {
    // Signing key not configured on this host (no KMS / no MESH_EXPORT_SECRET_KEY).
    // Skip rather than fail so the script stays useful on unconfigured dev DBs.
    console.log(`  (—) signing not configured on this host; ?signed=1 verification skipped`);
  } else {
    assert(signedRes.status === 200, `GET ?format=attestation&signed=1 → 200 (got ${signedRes.status})`);
    const signed = signedRes.json as any;
    assert(signed?.signature && typeof signed.signature === "object", "signed envelope carries a signature block");
    assert(signed?.signature?.alg === "Ed25519", "signature alg is Ed25519");
    assert(Array.isArray(signed?.signature?.signedFields), "signature.signedFields is an array");
    assert(
      signed?.signature?.signedFields?.includes("contentHash") &&
        signed?.signature?.signedFields?.includes("dialecticalStatus"),
      "signature covers contentHash + dialecticalStatus (standing is tamper-evident)"
    );
    assert(
      !signed?.signature?.signedFields?.includes("retrievedAt"),
      "signature excludes the volatile retrievedAt field"
    );

    const jwksRes = await fetchJson(`${BASE_URL}/.well-known/issuer-keys`);
    assert(jwksRes.status === 200, `GET /.well-known/issuer-keys → 200 (got ${jwksRes.status})`);
    assert(jwksRes.headers.get("access-control-allow-origin") === "*", "issuer-keys sets CORS (Access-Control-Allow-Origin: *)");
    const jwks = jwksRes.json as Jwks;
    assert(Array.isArray(jwks?.keys) && jwks.keys.length > 0, "JWKS has at least one key");

    // The whole point: verify offline with only the envelope + the JWKS.
    const ok = verifyAttestation(signed, jwks);
    assert(ok.ok === true, `signature verifies (${ok.ok ? "ok" : (ok as any).reason})`);

    // Tamper: mutating a covered field must break verification.
    const tampered = { ...signed, contentHash: "sha256:" + "0".repeat(64) };
    const tamperedResult = verifyAttestation(tampered, jwks);
    assert(tamperedResult.ok === false, "mutating contentHash (a covered field) breaks verification");

    // Excluded field: mutating retrievedAt must NOT break verification.
    const reFetched = { ...signed, retrievedAt: new Date(0).toISOString() };
    const reFetchedResult = verifyAttestation(reFetched, jwks);
    assert(reFetchedResult.ok === true, "mutating retrievedAt (an excluded field) does not break verification");
  }

  // ===== Summary =====
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
