/**
 * Snapshot capture CLI.
 *
 * Pipeline (per spec):
 *   1. Seed the deliberation graph via Prisma.
 *   2. Call `computeSyntheticReadout(deliberationId)`.
 *   3. Re-key the readout's `deliberationId` to the spec slug (so
 *      committed fixtures are stable across re-captures), and copy
 *      `adversarialGates` from the spec.
 *   4. Write `corpus/v2/fixtures/<slug>.json`.
 *   5. Update `corpus/v2/manifest.json` with the new entry.
 *   6. ALWAYS run cleanup (try/finally) so partial failures don't leak
 *      seed data.
 *
 * This script touches the real Prisma client; it must NOT run in CI
 * without an isolated dev/test `DATABASE_URL`. It is a developer-run
 * tool. Committed JSON fixtures are what CI grades.
 *
 * Usage:
 *   tsx eval/ai-epi/snapshot/captureFixture.ts                # capture all
 *   tsx eval/ai-epi/snapshot/captureFixture.ts --slug small-single-hub-db
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { computeSyntheticReadout } from "@/lib/deliberation/syntheticReadout";
import { seedDeliberation } from "./seedDeliberation";
import { snapshotExistingDeliberation } from "./snapshotExistingDeliberation";
import { ALL_SPECS } from "./specs";
import type { CaptureSpec, SeededDeliberation } from "./types";
import type { CorpusIndex, Fixture } from "../types";

/** Fixed timestamp used to neutralize volatile `*At` ISO date fields. */
const STABLE_TIMESTAMP = "1970-01-01T00:00:00.000Z";
/** ISO-8601 date-time recognizer (with required `Z` or offset). */
const ISO_TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * Recursively replace ISO-8601 timestamp string values (anywhere in the
 * tree) with a fixed value, so re-captures of the same spec produce
 * byte-identical fixtures.
 */
function neutralizeTimestamps(value: unknown): unknown {
  if (typeof value === "string") {
    return ISO_TIMESTAMP_RE.test(value) ? STABLE_TIMESTAMP : value;
  }
  if (Array.isArray(value)) return value.map(neutralizeTimestamps);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = neutralizeTimestamps(v);
    }
    return out;
  }
  return value;
}

/** Canonical JSON: deterministic key ordering for stable hashing. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

/**
 * Make the readout fully deterministic across re-captures of the same spec.
 *
 * Steps:
 *   1. Substitute every db-generated id (deliberation, arguments, claims,
 *      schemes) with a stable spec-derived id. Done via JSON.stringify +
 *      global string replace so we catch occurrences as values AND as
 *      object keys (e.g. `loadBearingnessScores: { [argId]: number }`).
 *   2. Neutralize all ISO-8601 timestamp string values.
 *   3. Recompute `contentHash` over the canonicalized re-keyed payload
 *      (excluding the `contentHash` field itself), so the hash itself is
 *      deterministic too.
 */
function stabilizeReadout(
  rawReadout: object,
  spec: CaptureSpec,
  seeded: SeededDeliberation,
): Record<string, unknown> & { contentHash: string } {
  const stableDelibId = `fix-${spec.slug}`;
  // For from-existing specs the local ids are already padded sequential
  // strings (e.g. "arg-0001"). For seed specs they are author-chosen
  // (e.g. "a-hub"). Either way, the substitution is db-id → `<prefix>-<localId>`.
  const argPrefix = spec.kind === "from-existing" ? "" : "arg-";
  const claimPrefix = spec.kind === "from-existing" ? "" : "claim-";
  const replacements: Array<[string, string]> = [
    [seeded.deliberationId, stableDelibId],
  ];
  for (const [localId, dbId] of Object.entries(seeded.argumentIds)) {
    replacements.push([dbId, `${argPrefix}${localId}`]);
  }
  for (const [localId, dbId] of Object.entries(seeded.claimIds)) {
    replacements.push([dbId, `${claimPrefix}${localId}`]);
  }
  for (const [key, dbId] of Object.entries(seeded.schemeIds)) {
    replacements.push([dbId, `scheme-${key}`]);
  }
  // Sort longest-first so no replacement can be a prefix of another.
  replacements.sort((a, b) => b[0].length - a[0].length);

  let json = JSON.stringify(rawReadout);
  for (const [from, to] of replacements) {
    if (!from) continue;
    // Escape regex specials in cuid (none today, but defensive).
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    json = json.replace(re, to);
  }

  // Generic cuid sweep: any remaining db-generated id we didn't
  // enumerate (edge ids, scheme-instance ids, inference ids, …) gets
  // assigned a stable `id-NNNN` in lexical order so re-captures stay
  // byte-identical even as the readout pipeline grows new id-bearing
  // fields. Pattern matches Prisma cuid v1 (`cm…` + 22-30 base36 chars).
  const residualCuids = new Set<string>();
  const cuidPattern = /cm[a-z0-9]{20,30}/g;
  for (const match of json.matchAll(cuidPattern)) residualCuids.add(match[0]);
  const sortedResidual = Array.from(residualCuids).sort();
  sortedResidual.forEach((dbId, i) => {
    const re = new RegExp(dbId, "g");
    json = json.replace(re, `id-${String(i + 1).padStart(4, "0")}`);
  });

  const reKeyed = neutralizeTimestamps(JSON.parse(json)) as Record<
    string,
    unknown
  >;
  // Neutralize *nested* contentHash fields (e.g. `fingerprint.contentHash`)
  // — they are computed by the readout pipeline over the raw, non-stable
  // payload and would otherwise make every capture diverge.
  neutralizeNestedContentHashes(reKeyed);
  // Recompute the top-level contentHash over the now fully-deterministic
  // payload (excluding the top-level contentHash field itself).
  const { contentHash: _drop, ...withoutHash } = reKeyed as {
    contentHash?: unknown;
  } & Record<string, unknown>;
  const hash = createHash("sha256")
    .update(canonicalJson(withoutHash))
    .digest("hex");
  return { ...reKeyed, contentHash: `sha256:${hash}` };
}

/** Placeholder for nested `contentHash` fields (see `stabilizeReadout`). */
const NESTED_HASH_PLACEHOLDER = "sha256:__nested_redacted__";

/** In-place: replace every nested `contentHash` field with a placeholder. */
function neutralizeNestedContentHashes(node: unknown, depth = 0): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) neutralizeNestedContentHashes(child, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    // Skip the top-level contentHash; we recompute it.
    if (k === "contentHash" && depth > 0) {
      obj[k] = NESTED_HASH_PLACEHOLDER;
    } else {
      neutralizeNestedContentHashes(v, depth + 1);
    }
  }
}

const CORPUS_V2_ROOT = join(__dirname, "..", "corpus", "v2");
const CORPUS_V2_FIXTURES = join(CORPUS_V2_ROOT, "fixtures");
const CORPUS_V2_MANIFEST = join(CORPUS_V2_ROOT, "manifest.json");

interface CaptureResult {
  slug: string;
  fixturePath: string;
  contentHash: string;
}

async function captureOne(spec: CaptureSpec): Promise<CaptureResult> {
  const isFromExisting = spec.kind === "from-existing";
  console.log(
    `\n[capture] ${spec.slug} — ${isFromExisting ? "snapshotting existing deliberation" : "seeding"}…`,
  );
  const seeded = isFromExisting
    ? await snapshotExistingDeliberation(spec)
    : await seedDeliberation(spec);
  try {
    console.log(
      `[capture] ${spec.slug} — seeded deliberationId=${seeded.deliberationId}`,
    );
    const readout = await computeSyntheticReadout(seeded.deliberationId);
    if (!readout) {
      throw new Error(
        `computeSyntheticReadout returned null for ${spec.slug}`,
      );
    }

    // Re-key all db ids → stable spec-derived ids, neutralize
    // timestamps, and recompute contentHash over the result. After
    // this, re-capturing the same spec produces a byte-identical file.
    const stableReadout = stabilizeReadout(readout, spec, seeded);

    const fixture: Fixture = {
      id: spec.slug,
      description: spec.description,
      adversarialGates: spec.adversarialGates,
      // Cast: corpus-v2 fixtures embed the *full* SyntheticReadout,
      // which is a superset of FixtureReadout (the Pick type).
      readout: stableReadout as unknown as Fixture["readout"],
    };

    mkdirSync(CORPUS_V2_FIXTURES, { recursive: true });
    const fixturePath = join(CORPUS_V2_FIXTURES, `${spec.slug}.json`);
    writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
    console.log(
      `[capture] ${spec.slug} — wrote ${fixturePath} (contentHash=${stableReadout.contentHash})`,
    );

    return {
      slug: spec.slug,
      fixturePath: join("fixtures", `${spec.slug}.json`),
      contentHash: stableReadout.contentHash,
    };
  } finally {
    console.log(`[capture] ${spec.slug} — cleaning up…`);
    await seeded.cleanup().catch((err) => {
      console.error(
        `[capture] ${spec.slug} — CLEANUP FAILED (manual cleanup may be required for deliberationId=${seeded.deliberationId}):`,
        err,
      );
    });
  }
}

function updateManifest(results: CaptureResult[]): void {
  const existing: CorpusIndex = existsSync(CORPUS_V2_MANIFEST)
    ? (JSON.parse(readFileSync(CORPUS_V2_MANIFEST, "utf8")) as CorpusIndex)
    : { version: "v2", fixtures: [] };

  // Merge: replace any entries with matching ids, append new ones,
  // keep entries that weren't part of this capture run.
  const byId = new Map(existing.fixtures.map((f) => [f.id, f]));
  for (const r of results) {
    const spec = ALL_SPECS.find((s) => s.slug === r.slug);
    byId.set(r.slug, {
      id: r.slug,
      path: r.fixturePath,
      description: spec?.description ?? "",
      contentHash: r.contentHash,
    });
  }
  const merged: CorpusIndex = {
    version: "v2",
    fixtures: Array.from(byId.values()).sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  };
  mkdirSync(dirname(CORPUS_V2_MANIFEST), { recursive: true });
  writeFileSync(
    CORPUS_V2_MANIFEST,
    `${JSON.stringify(merged, null, 2)}\n`,
  );
  console.log(
    `\n[capture] manifest written: ${CORPUS_V2_MANIFEST} (${merged.fixtures.length} fixture(s))`,
  );
}

function parseArgs(): { slug: string | null } {
  const args = process.argv.slice(2);
  const i = args.indexOf("--slug");
  if (i >= 0 && args[i + 1]) return { slug: args[i + 1]! };
  return { slug: null };
}

async function main(): Promise<void> {
  const { slug } = parseArgs();
  const targets = slug
    ? ALL_SPECS.filter((s) => s.slug === slug)
    : ALL_SPECS;
  if (targets.length === 0) {
    console.error(
      `No specs match. Available slugs: ${ALL_SPECS.map((s) => s.slug).join(", ")}`,
    );
    process.exit(2);
  }

  const results: CaptureResult[] = [];
  let failures = 0;
  for (const spec of targets) {
    try {
      const r = await captureOne(spec);
      results.push(r);
    } catch (err) {
      failures++;
      console.error(`[capture] ${spec.slug} — FAILED:`, err);
    }
  }

  if (results.length > 0) updateManifest(results);
  console.log(
    `\nSummary: captured ${results.length}/${targets.length} fixture(s), ${failures} failure(s).`,
  );
  process.exit(failures > 0 ? 1 : 0);
}

main();
