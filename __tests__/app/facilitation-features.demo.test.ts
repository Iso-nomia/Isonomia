/**
 * Smoke test for the Scope C facilitation demo page.
 *
 * The repo's jest config compiles with `jsx: "preserve"`, which means we
 * cannot render JSX from a test file directly. Instead we read the demo
 * page source and assert structural invariants — that every Scope C
 * component is referenced, the eight tab triggers are wired, and the C4
 * inspectors hit the documented endpoints. This catches the most common
 * demo-page regressions (renamed components, dropped tabs, wrong endpoint
 * URLs) without booting a React renderer.
 */

import { promises as fs } from "fs";
import * as path from "path";

const DEMO_PATH = path.join(
  process.cwd(),
  "app/test/facilitation-features/page.tsx",
);

let source = "";

beforeAll(async () => {
  source = await fs.readFile(DEMO_PATH, "utf8");
});

describe("FacilitationFeaturesPage demo", () => {
  test("is a client component with a default export", () => {
    expect(source.startsWith('"use client"')).toBe(true);
    expect(source).toMatch(/export default function FacilitationFeaturesPage/);
  });

  test("imports every Scope C component", () => {
    const required = [
      "FacilitationCockpit",
      "EquityPanel",
      "FacilitationTimeline",
      "InterventionQueue",
      "QuestionAuthoring",
      "HandoffDialog",
      "PendingHandoffsBanner",
      "FacilitationReport",
      "EquityWarningChip",
      "ChainValidityBadge",
    ];
    for (const name of required) {
      expect(source).toMatch(
        new RegExp(`from\\s+"@/components/facilitation/[^"]+"`),
      );
      expect(source).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  test("exposes the eight expected tab triggers", () => {
    const expected = [
      "cockpit",
      "equity",
      "timeline",
      "interventions",
      "question",
      "handoff",
      "report",
      "c4",
    ];
    for (const value of expected) {
      expect(source).toMatch(
        new RegExp(`<TabsTrigger\\s+value=\"${value}\"`),
      );
      expect(source).toMatch(
        new RegExp(`<TabsContent\\s+value=\"${value}\"`),
      );
    }
  });

  test("provides an inline deliberation id input with persistence", () => {
    expect(source).toMatch(/placeholder=\"deliberationId/);
    expect(source).toMatch(/localStorage/);
    expect(source).toMatch(/facilitation-demo:deliberationId/);
    // URL sync so deep links stay stable
    expect(source).toMatch(/window\.history\.replaceState/);
  });

  test("renders the phase legend and primitives row", () => {
    expect(source).toMatch(/Phase coverage/);
    expect(source).toMatch(/Primitives/);
    // ChainValidityBadge demoed in three states
    const matches = source.match(/<ChainValidityBadge/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  test("C4 inspectors target the documented endpoints", () => {
    expect(source).toMatch(/\/facilitation\/analytics/);
    expect(source).toMatch(/\/facilitation\/sessions\/\$\{sessionId\}\/export/);
    // Header labels mention the surface ids
    expect(source).toMatch(/C4\.1/);
    expect(source).toMatch(/C4\.2/);
  });

  test("guards every tab against a missing deliberation id or session", () => {
    // EmptyHint covers the no-deliberation case
    expect(source).toMatch(/function EmptyHint/);
    // NoActiveSessionHint covers tabs that need a sessionId
    expect(source).toMatch(/function NoActiveSessionHint/);
    // The Pending banner only mounts when an id is present
    expect(source).toMatch(
      /deliberationId\s*&&[\s\S]*?<PendingHandoffsBanner/,
    );
  });
});
