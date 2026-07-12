/**
 * scripts/lint-no-legacy-ludics-read.ts
 *
 * H2 lint — enforces invariant **I-No-Legacy-Read**:
 *
 *   No file under `lib/ludics/substrate/**` may read legacy Ludics
 *   tables (`prisma.ludicDesign`, `prisma.ludicAct`,
 *   `prisma.ludicChronicle`, `prisma.ludicChronicleCache`).
 *
 * Run: `npm run lint:no-legacy-ludics-read`
 *
 * Exit code 0 when clean; 1 with a list of offending files + lines
 * otherwise. Designed to be cheap and dependency-free (regex over
 * source text, no AST parser) so it can run as part of the existing
 * lint pipeline without inflating CI cold-start.
 *
 * The chronicles escape hatch (`lib/ludics/chronicles/reconstruct.ts`)
 * is *not* under the lint's enforcement scope. It is the single
 * permitted reader of `LudicAct` for the chronicle-reconstruction
 * migration path described in
 * `Development and Ideation Documents/ARCHITECTURE/LUDICS_HARMONIZATION_PASS_2_SPRINT_LIST.md`
 * §H2.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** Roots whose contents are subject to the no-legacy-read rule. */
const ENFORCED_ROOTS: readonly string[] = ["lib/ludics/substrate"];

/** Forbidden prisma model accessors. */
const FORBIDDEN_PATTERNS: readonly RegExp[] = [
  /\bprisma\s*\.\s*ludicDesign\b/,
  /\bprisma\s*\.\s*ludicAct\b/,
  /\bprisma\s*\.\s*ludicChronicle\b/,
  /\bprisma\s*\.\s*ludicChronicleCache\b/,
];

export interface Offence {
  file: string;
  line: number;
  text: string;
  pattern: string;
}

/** Walk `root` recursively yielding every `.ts` / `.tsx` file path. */
function* walkTsFiles(root: string): Generator<string> {
  if (!fs.existsSync(root)) return;
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        yield full;
      }
    }
  }
}

/** Scan the enforced roots for forbidden reads. */
export function lintNoLegacyLudicsRead(repoRoot: string): Offence[] {
  const offences: Offence[] = [];
  for (const rel of ENFORCED_ROOTS) {
    const root = path.join(repoRoot, rel);
    for (const file of walkTsFiles(root)) {
      const text = fs.readFileSync(file, "utf8");
      // Strip block comments wholesale before scanning so JSDoc that
      // mentions the forbidden APIs in prose does not flag the file.
      // Replacement preserves newlines so line numbers stay stable.
      const codeOnly = text.replace(/\/\*[\s\S]*?\*\//g, (match) =>
        match.replace(/[^\n]/g, " "),
      );
      const lines = codeOnly.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        // Strip line comments too (`// prisma.ludicAct.X` in prose).
        const stripped = raw.replace(/\/\/.*$/, "");
        for (const pat of FORBIDDEN_PATTERNS) {
          if (pat.test(stripped)) {
            offences.push({
              file: path.relative(repoRoot, file),
              line: i + 1,
              text: raw.trim(),
              pattern: pat.source,
            });
          }
        }
      }
    }
  }
  return offences;
}

function main(): void {
  const repoRoot = process.cwd();
  const offences = lintNoLegacyLudicsRead(repoRoot);
  if (offences.length === 0) {
    console.log(
      "[lint-no-legacy-ludics-read] OK — no legacy Ludics reads under lib/ludics/substrate/**.",
    );
    process.exit(0);
  }
  console.error(
    `[lint-no-legacy-ludics-read] ${offences.length} offence(s) — substrate code must not read legacy Ludics tables:`,
  );
  for (const o of offences) {
    console.error(`  ${o.file}:${o.line}  /${o.pattern}/  ${o.text}`);
  }
  console.error(
    "Hint: route the read through lib/ludics/substrate/read.ts, or " +
      "(for chronicle reconstruction) lib/ludics/chronicles/reconstruct.ts.",
  );
  process.exit(1);
}

// Only run when invoked directly (e.g. `tsx scripts/lint-no-legacy-ludics-read.ts`).
if (require.main === module) {
  main();
}
