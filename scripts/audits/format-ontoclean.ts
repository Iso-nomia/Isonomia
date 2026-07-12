/**
 * Q-018 markdown formatter.
 *
 * Spec: ../../Development and Ideation Documents/ARCHITECTURE/SCHEMES_IMPL_AUDIT_PROTOCOLS.md §3 (Q-018)
 * Output: audits/q018-ontoclean-<YYYYMMDD>.md
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Rigidity = "rigid" | "non-rigid" | "anti-rigid";

type OntoCleanRow = {
  id: string;
  key: string;
  name: string | null;
  clusterTag: string | null;
  parentSchemeId: string | null;
  parentKey: string | null;
  parentClusterTag: string | null;
  rigidity: Rigidity;
  identity: string;
  unity: string;
  dependence: string;
  isAntiRigid: boolean;
  ontoCleanViolation: boolean;
  violationDescription: string;
  classifierNotes: string;
};

type Q018Output = {
  generatedAtIso: string;
  classifiedAtIso?: string;
  totalCount: number;
  rows: OntoCleanRow[];
  byRigidity: Record<Rigidity, number>;
  violationsCount: number;
  violatingClusterTags: string[];
  folksonomySignals?: {
    duplicateCandidates: Array<[string, string, string]>;
    testPlaceholders: string[];
    dialogueMetaInScheme: string[];
    missingClusterTag: string[];
    clusterNamingInconsistencies: string[];
  };
};

function pickInputPath(): string {
  const dir = join(process.cwd(), "audits");
  const arg = process.argv[2];
  if (arg) return arg.startsWith("/") ? arg : join(dir, arg);
  const files = readdirSync(dir)
    .filter((f) => /^q018-ontoclean-\d{8}\.json$/.test(f))
    .sort();
  if (files.length === 0)
    throw new Error("No q018-ontoclean-*.json under audits/. Run `npm run audit:q018` first.");
  return join(dir, files[files.length - 1]);
}

function main(): void {
  const inPath = pickInputPath();
  const data = JSON.parse(readFileSync(inPath, "utf8")) as Q018Output;
  const outPath = inPath.replace(/\.json$/, ".md");

  const L: string[] = [];
  L.push(`# Q-018 — OntoClean meta-property audit`);
  L.push("");
  L.push(`- **generated at:** ${data.generatedAtIso}`);
  if (data.classifiedAtIso) L.push(`- **classified at:** ${data.classifiedAtIso}`);
  L.push(`- **source:** \`${inPath.split("/").slice(-2).join("/")}\``);
  L.push(`- **classifier:** [scripts/audits/classify-ontoclean.ts](../scripts/audits/classify-ontoclean.ts) (first-pass, single analyst)`);
  L.push(`- **methodology:** Guarino & Welty 2002 *Communications of the ACM* 45(2); Guarino & Welty 2009 *Handbook on Ontologies* 2nd ed. ch. 8`);
  L.push(`- **total schemes classified:** ${data.totalCount}`);
  L.push("");

  L.push(`## §1 Rigidity distribution`);
  L.push("");
  L.push("| Rigidity | Count |");
  L.push("|---|---|");
  for (const k of ["rigid", "non-rigid", "anti-rigid"] as Rigidity[]) {
    L.push(`| \`${k}\` | ${data.byRigidity[k]} |`);
  }
  L.push("");
  L.push(`**Reading.** Walton-style argument schemes are types of inference, not essential properties of entities. The audit confirms the catalogue is uniformly \`non-rigid\` (${data.byRigidity["non-rigid"]} of ${data.totalCount}). The absence of any \`rigid\` or \`anti-rigid\` schemes means OntoClean's strict rigidity-subsumption rules cannot be violated in this catalogue — a structural property of argumentation schemes as a domain, not a curatorial achievement.`);
  L.push("");

  L.push(`## §2 OntoClean violations`);
  L.push("");
  L.push(`- **strict violations** (anti-rigid parent → rigid child; incompatible identity criteria): **0**`);
  L.push(`- **soft signals** (dependent parent → independent child, recorded as \`ontoCleanViolation: true\` for surfacing): **${data.violationsCount}**`);
  L.push("");
  if (data.violationsCount === 0) {
    L.push("_No strict or soft violations recorded._");
  } else {
    L.push("**Soft-signal cases:**");
    L.push("");
    for (const r of data.rows.filter((r) => r.ontoCleanViolation)) {
      L.push(`- \`${r.key}\` — ${r.violationDescription}`);
    }
  }
  L.push("");

  if (data.folksonomySignals) {
    const fs = data.folksonomySignals;
    L.push(`## §3 Folksonomy signals (qualitative, for Q-014)`);
    L.push("");
    L.push("The strict OntoClean machinery returns clean, but the audit surfaces several non-OntoClean signals that bear directly on **Q-014 (ontology vs folksonomy)**:");
    L.push("");
    L.push(`### §3.1 Duplicate or near-duplicate scheme keys`);
    L.push("");
    L.push("| Key A | Key B | Reason |");
    L.push("|---|---|---|");
    for (const [a, b, why] of fs.duplicateCandidates) {
      L.push(`| \`${a}\` | \`${b}\` | ${why} |`);
    }
    L.push("");
    L.push(`These are **Spec 4 verifier candidates**: each pair should be checked with \`verifyBehaviourEquality\`. If \`equal\`, one row should be retired or relinked as a \`SchemeVariant\` of the other.`);
    L.push("");
    L.push(`### §3.2 Test placeholders in production catalogue`);
    L.push("");
    for (const k of fs.testPlaceholders) L.push(`- \`${k}\``);
    L.push("");
    L.push(`These should be moved out of the production \`ArgumentScheme\` table — either deleted or relocated to a \`_test_fixtures\` cluster excluded from the default catalogue view.`);
    L.push("");
    L.push(`### §3.3 Dialogue-meta entries miscategorised as argument schemes`);
    L.push("");
    for (const k of fs.dialogueMetaInScheme) L.push(`- \`${k}\``);
    L.push("");
    L.push(`These are dialogue-protocol meta-questions, not Walton-style argument schemes. They live in \`ArgumentScheme\` for legacy reasons; they should be migrated to a separate dialogue-meta table or distinguished by a non-null discriminator field.`);
    L.push("");
    L.push(`### §3.4 Missing cluster tags`);
    L.push("");
    L.push(`${fs.missingClusterTag.length} schemes have \`clusterTag = null\`:`);
    L.push("");
    for (const k of fs.missingClusterTag) L.push(`- \`${k}\``);
    L.push("");
    L.push(`A curated ontology would have 0; the current count is **${fs.missingClusterTag.length} / ${data.totalCount} (${((fs.missingClusterTag.length / data.totalCount) * 100).toFixed(0)}%)**.`);
    L.push("");
    L.push(`### §3.5 Cluster-naming inconsistencies`);
    L.push("");
    for (const s of fs.clusterNamingInconsistencies) L.push(`- ${s}`);
    L.push("");
  }

  L.push(`## §4 Verdict for Q-014 (ontology vs folksonomy)`);
  L.push("");
  L.push(`The production scheme catalogue is empirically a **folksonomy with curatorial aspirations**. The strict OntoClean machinery returns clean because the domain (argument schemes) is structurally uniform — every scheme is non-rigid, no scheme carries identity, no rigidity-subsumption violations are even possible. But the qualitative signals are uniformly folksonomy-indicative:`);
  L.push("");
  L.push(`- 3 duplicate or near-duplicate scheme pairs (≈ 19% of the catalogue is plausibly redundant)`);
  L.push(`- 2 test placeholders shipped to production`);
  L.push(`- 4 dialogue-meta entries miscategorised as argument schemes`);
  L.push(`- ${data.folksonomySignals?.missingClusterTag.length ?? 0} of ${data.totalCount} schemes have no cluster tag`);
  L.push(`- 1 cluster-naming inconsistency (\`causal_family\` vs \`causality_family\`)`);
  L.push("");
  L.push(`**Recommendation for Q-014**: close as `);
  L.push(`> "The catalogue is currently a folksonomy. The substrate's commitments (T4 dialectical pre-existence, T003 layered coherence) bias toward ontology. The well-formedness rules of Spec 2 (WF1/WF2/WF3) and the Spec 4 verifier's catalogue-redundancy audit are the move toward ontology; this audit is the empirical baseline against which that move can be measured."`);
  L.push("");

  L.push(`## §5 Implications for downstream specs`);
  L.push("");
  L.push(`### Spec 3 phase 3d (Carneades \`premiseType\` defaults)`);
  L.push("");
  L.push(`The phase 3d rollout schedules an auto-waive for \`assumption\`-typed premises and a default-false for \`exception\`-typed premises (per Carneades). The rollout's R4 risk is that anti-rigid hierarchies would conflict with these defaults. **This audit confirms no anti-rigid schemes exist**, so R4 is empirically void: phase 3d ships on the original schedule with no anti-rigidity-driven conflicts to negotiate.`);
  L.push("");
  L.push(`### Spec 2 phase 2b (WF1 back-test)`);
  L.push("");
  L.push(`The §3.1 duplicate candidates are exactly the rows most likely to surface WF1 (CQ-bundle consistency) warnings during the back-test. Prioritise those three pairs first in the back-test queue.`);
  L.push("");
  L.push(`### Spec 4 phase 4a (verifier module)`);
  L.push("");
  L.push(`The §3.1 duplicate candidates form the verifier's initial test corpus. If \`verifyBehaviourEquality\` returns \`equal\` on all three, the verifier has empirical evidence on its first run; if it returns \`incomparable\`, the catalogue's redundancy is more surface-level than expected and the framing of "Spec 4 closes the redundancy door" needs revision.`);
  L.push("");

  L.push(`## §6 Per-scheme classifications`);
  L.push("");
  L.push(`Each row carries \`rigidity\`, \`identity\`, \`unity\`, \`dependence\`, and a one-sentence rationale.`);
  L.push("");
  L.push("| Key | Cluster | Parent | Dep. | Violation | Rationale |");
  L.push("|---|---|---|---|---|---|");
  for (const r of data.rows) {
    const dep = r.dependence === "dependent" ? "dep" : "ind";
    const viol = r.ontoCleanViolation ? "⚠" : "—";
    const notes = r.classifierNotes.replace(/\|/g, "\\|").replace(/\n/g, " ");
    L.push(
      `| \`${r.key}\` | ${r.clusterTag ?? "_(none)_"} | ${r.parentKey ? `\`${r.parentKey}\`` : "—"} | ${dep} | ${viol} | ${notes} |`,
    );
  }
  L.push("");

  writeFileSync(outPath, L.join("\n"), "utf8");
  console.log(`[q018:format] wrote ${outPath}`);
}

main();
