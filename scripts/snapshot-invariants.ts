/**
 * H0 — Invariant snapshot script.
 *
 * Captures the current shape of the invariant suite under
 * `__tests__/invariants/**` so the Ludics-harmonization programme can detect
 * regressions or silent drift across sprints H1–H8.
 *
 * Output: `__tests__/invariants/_snapshot.json`.
 *
 * Modes:
 *   default          — static parse only (no jest invocation). Fast.
 *   --run            — also runs jest in JSON mode and records pass/fail.
 *
 * Acceptance (per LUDICS_HARMONIZATION_PASS_2_SPRINT_LIST.md §H0):
 *   - script exits 0
 *   - snapshot records the actual count of `it(...)` / `test(...)` cases
 *     across `__tests__/invariants/**` (spec uses ~308 as a floor).
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { execSync } from "node:child_process";

const REPO_ROOT = join(__dirname, "..");
const INVARIANT_DIR = join(REPO_ROOT, "__tests__", "invariants");
const OUTPUT = join(INVARIANT_DIR, "_snapshot.json");

type FileSnapshot = {
  file: string;
  caseCount: number;
  describes: string[];
};

type Snapshot = {
  generatedAt: string;
  programme: "ludics-harmonization";
  sprint: "H0";
  totalFiles: number;
  totalCases: number;
  files: FileSnapshot[];
  lastRun?: {
    timestamp: string;
    numTotalTests: number;
    numPassedTests: number;
    numFailedTests: number;
    numPendingTests: number;
    success: boolean;
  };
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Counts top-level `it(` and `test(` invocations. Skips commented lines.
// Conservative: does not parse template-string evaluated names; treats every
// match as one case. Test files with table-driven loops will under-count;
// jest --run gives the authoritative number.
function staticCount(source: string): { count: number; describes: string[] } {
  const describes: string[] = [];
  let count = 0;
  for (const rawLine of source.split("\n")) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (line.startsWith("*") || line.startsWith("/*")) continue;
    if (/^\s*(it|test)(\.skip|\.only|\.each\([^)]*\))?\(/.test(line)) count += 1;
    const desc = line.match(/^\s*describe\(\s*["'`]([^"'`]+)["'`]/);
    if (desc) describes.push(desc[1]);
  }
  return { count, describes };
}

function buildSnapshot(): Snapshot {
  const files = walk(INVARIANT_DIR).sort();
  const fileSnapshots: FileSnapshot[] = files.map((f) => {
    const src = readFileSync(f, "utf8");
    const { count, describes } = staticCount(src);
    return {
      file: relative(REPO_ROOT, f),
      caseCount: count,
      describes,
    };
  });
  const totalCases = fileSnapshots.reduce((acc, f) => acc + f.caseCount, 0);
  return {
    generatedAt: new Date().toISOString(),
    programme: "ludics-harmonization",
    sprint: "H0",
    totalFiles: fileSnapshots.length,
    totalCases,
    files: fileSnapshots,
  };
}

function runJest(): Snapshot["lastRun"] | undefined {
  // Spawn jest with --json so we can capture aggregate pass/fail counts.
  // We deliberately do NOT fail the snapshot script on jest non-zero exit:
  // a red baseline is still a baseline. The success flag in the snapshot
  // records whether the suite was green at capture time.
  const tmp = join(REPO_ROOT, ".jest-snapshot.json");
  try {
    execSync(
      `npx jest __tests__/invariants/ --json --outputFile=${tmp} --silent`,
      { stdio: "inherit", cwd: REPO_ROOT },
    );
  } catch {
    // intentional: jest exits non-zero on test failures; we still want the JSON.
  }
  let parsed: any;
  try {
    parsed = JSON.parse(readFileSync(tmp, "utf8"));
  } catch (err) {
    console.warn("[snapshot] could not read jest JSON output:", err);
    return undefined;
  }
  return {
    timestamp: new Date().toISOString(),
    numTotalTests: parsed.numTotalTests ?? 0,
    numPassedTests: parsed.numPassedTests ?? 0,
    numFailedTests: parsed.numFailedTests ?? 0,
    numPendingTests: parsed.numPendingTests ?? 0,
    success: Boolean(parsed.success),
  };
}

function main() {
  const argv = process.argv.slice(2);
  const shouldRun = argv.includes("--run");

  const snapshot = buildSnapshot();
  if (shouldRun) {
    const lastRun = runJest();
    if (lastRun) snapshot.lastRun = lastRun;
  }

  writeFileSync(OUTPUT, JSON.stringify(snapshot, null, 2) + "\n", "utf8");

  console.log(
    `[snapshot] wrote ${relative(REPO_ROOT, OUTPUT)}: ${snapshot.totalFiles} files, ${snapshot.totalCases} cases (static count).`,
  );
  if (snapshot.lastRun) {
    const { numPassedTests, numFailedTests, numTotalTests, success } =
      snapshot.lastRun;
    console.log(
      `[snapshot] jest: ${numPassedTests}/${numTotalTests} passed, ${numFailedTests} failed, success=${success}`,
    );
  }
}

main();
