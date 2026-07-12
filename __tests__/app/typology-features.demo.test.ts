/**
 * Smoke test for the Scope B typology demo page.
 *
 * The repo's jest config compiles with `jsx: "preserve"`, which means we
 * cannot render JSX from a test file directly. Instead we read the demo
 * page source and assert structural invariants — that every Scope B
 * component is referenced, the six tab triggers are wired, and the
 * canonical export inspector hits the documented endpoint. Mirrors
 * `__tests__/app/facilitation-features.demo.test.ts`.
 */

import { promises as fs } from "fs";
import * as path from "path";

const DEMO_PATH = path.join(process.cwd(), "app/test/typology-features/page.tsx");

let source = "";

beforeAll(async () => {
  source = await fs.readFile(DEMO_PATH, "utf8");
});

describe("TypologyFeaturesPage demo", () => {
  test("is a client component with a default export", () => {
    expect(source.startsWith('"use client"')).toBe(true);
    expect(source).toMatch(/export default function TypologyFeaturesPage/);
  });

  test("imports every Scope B typology component", () => {
    const required = [
      "AxisBadge",
      "DisagreementTagger",
      "TypologyCandidateQueue",
      "MetaConsensusEditor",
      "MetaConsensusSummaryCard",
      "ChainValidityBadge",
    ];
    for (const name of required) {
      expect(source).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  test("exposes the six expected tab triggers", () => {
    const expected = ["tagger", "candidates", "editor", "summaries", "chain", "export"];
    for (const value of expected) {
      expect(source).toMatch(new RegExp(`<TabsTrigger\\s+value=\"${value}\"`));
      expect(source).toMatch(new RegExp(`<TabsContent\\s+value=\"${value}\"`));
    }
  });

  test("provides an inline deliberation id input with persistence", () => {
    expect(source).toMatch(/placeholder=\"deliberationId/);
    expect(source).toMatch(/localStorage/);
    expect(source).toMatch(/typology-demo:deliberationId/);
    expect(source).toMatch(/window\.history\.replaceState/);
  });

  test("export inspector hits the canonical endpoint", () => {
    expect(source).toMatch(/\/api\/deliberations\/\$\{deliberationId\}\/typology\/export/);
  });

  test("guards against missing deliberation id", () => {
    expect(source).toMatch(/ContextBanner/);
    expect(source).toMatch(/seed-typology-demo/);
  });

  test("polish: copyable seed command", () => {
    expect(source).toMatch(/navigator\.clipboard\.writeText/);
    expect(source).toMatch(/npx tsx scripts\/seed-typology-demo\.ts/);
  });

  test("polish: empty chain renders as pending, not mismatch", () => {
    // Both SnapshotStrip and ChainPanel coerce empty event lists to
    // `valid={null}` so the badge shows \"Chain pending\" instead of the
    // alarming \"Chain mismatch\" returned by the EMPTY verifier reason.
    expect(source).toMatch(/eventsList\.length === 0 \? null/);
    expect(source).toMatch(/events\.length === 0 \? null/);
  });

  test("polish: tagger demo can pick recent claims/arguments", () => {
    expect(source).toMatch(/\/api\/deliberations\/\$\{deliberationId\}\/claims\?limit=20/);
    expect(source).toMatch(/\/api\/deliberations\/\$\{deliberationId\}\/arguments\?limit=20/);
    expect(source).toMatch(/Pick recent /);
  });

  test("polish: header offers a one-click 'use open session' helper", () => {
    expect(source).toMatch(/\/api\/deliberations\/\$\{delibInput\.trim\(\)\}\/facilitation\/sessions/);
    expect(source).toMatch(/Use open session/);
  });

  test("polish: surfaces a load error when typology endpoints fail", () => {
    expect(source).toMatch(/loadError/);
    // Status-aware error messages: 401, 403, 404, generic.
    expect(source).toMatch(/Sign in to view typology data/);
    expect(source).toMatch(/don't have a role/);
    expect(source).toMatch(/Couldn't load typology data/);
  });
});
