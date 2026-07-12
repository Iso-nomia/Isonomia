/**
 * Q-018 first-pass classifier.
 *
 * Spec: ../../Development and Ideation Documents/ARCHITECTURE/SCHEMES_IMPL_AUDIT_PROTOCOLS.md §3 (Q-018)
 * Run: tsx scripts/audits/classify-ontoclean.ts [path/to/q018-*.json]
 *
 * Loads the latest q018-ontoclean-*.json (or a specified path),
 * applies a hand-encoded per-key classification table, computes
 * derived flags + summary counts, and writes back to the same
 * file. Re-runnable: classifications below are the source of
 * truth.
 *
 * Methodology — Guarino & Welty 2002/2009 OntoClean:
 *   - rigidity: rigid (essential to all instances) / non-rigid
 *     (essential to some) / anti-rigid (essential to none).
 *     Walton-style argument schemes are uniformly **non-rigid** —
 *     they are *types of inference*, not essential properties of
 *     entities. None of the catalogue's 31 schemes are rigid or
 *     anti-rigid.
 *   - identity: carries-identity iff there is a stable
 *     instance-level equality criterion. Argument schemes do not
 *     carry identity for their *instances* (two arguments using
 *     the same scheme are not therefore identical).
 *   - unity: carries-unity iff each instance is a structured
 *     whole with definite parts. Schemes prescribe inference
 *     structure but their instances are not unified wholes in the
 *     mereological sense Guarino intends.
 *   - dependence: dependent iff the scheme presupposes a relation
 *     or sortal extrinsic to its premise/conclusion contents.
 *     Almost all substantive Walton schemes are dependent
 *     (expert_opinion → expertise-relation; analogy →
 *     similarity-relation; etc.); placeholder / dialogue-meta
 *     schemes are independent.
 *
 * OntoClean strict violations checked:
 *   1. anti-rigid parent subsuming rigid child (none possible — no
 *      rigid or anti-rigid schemes exist).
 *   2. incompatible identity criteria across hierarchy (none
 *      possible — no scheme carries identity).
 *   3. independent parent with dependent child (semantically OK)
 *      vs dependent parent with independent child (a soft signal
 *      of category-mixing, recorded but not flagged as strict
 *      violation).
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Rigidity = "rigid" | "non-rigid" | "anti-rigid";
type Identity = "carries-identity" | "no-identity";
type Unity = "carries-unity" | "no-unity";
type Dependence = "dependent" | "independent";

type Classification = {
  rigidity: Rigidity;
  identity: Identity;
  unity: Unity;
  dependence: Dependence;
  notes: string;
};

const DEFAULT: Classification = {
  rigidity: "non-rigid",
  identity: "no-identity",
  unity: "no-unity",
  dependence: "dependent",
  notes:
    "Walton-style argument scheme — non-rigid (type of inference, not essence), no instance-equality criterion, no mereological unity. Dependence stated per scheme's required extrinsic relation.",
};

const TABLE: Record<string, Classification> = {
  // === Authority family ===
  expert_opinion: {
    ...DEFAULT,
    notes:
      "Depends on expertise-relation (E is an expert in domain D). Walton's flagship scheme. Confidence: high.",
  },
  "expert-opinion": {
    ...DEFAULT,
    notes:
      "Hyphenated duplicate of `expert_opinion`. **Folksonomy signal** — catalogue contains naming-convention duplicates. Spec 4 verifier should flag as `equal` candidate. Confidence: high.",
  },
  popular_opinion: {
    ...DEFAULT,
    notes:
      "Depends on majority-belief relation (most people in reference group G believe P). Confidence: high.",
  },
  popular_practice: {
    ...DEFAULT,
    notes:
      "Depends on common-practice relation (most people in G do A). Parent `popular_opinion` is structurally compatible (both authority_family, both non-rigid, both dependent). Confidence: high.",
  },
  witness_testimony: {
    ...DEFAULT,
    notes:
      "Depends on testimony-relation (witness W reports event E). Confidence: high.",
  },

  // === Causal family ===
  causal: {
    ...DEFAULT,
    notes:
      "Depends on causal relation. Confidence: high. Note: near-duplicate of `cause_to_effect` — Spec 4 verifier should compare.",
  },
  cause_to_effect: {
    ...DEFAULT,
    notes:
      "Depends on causal relation (specifically cause→effect direction). **Folksonomy signal** — near-duplicate of `causal` with a directional refinement that may or may not be load-bearing. Cluster tag missing (null). Spec 4 verifier candidate. Confidence: high.",
  },
  inference_to_best_explanation: {
    ...DEFAULT,
    notes:
      "Depends on explanation relation (E best explains O among candidate explanations). Distinct from causal — abductive structure. Confidence: high.",
  },

  // === Definition family ===
  classification: {
    ...DEFAULT,
    notes:
      "Depends on classificatory category (item I has property P → I is a member of class C). Confidence: high.",
  },
  verbal_classification: {
    ...DEFAULT,
    notes:
      "Depends on linguistic classificatory category. Walton-distinct from `classification` proper (verbal vs material). Confidence: high.",
  },
  definition_to_classification: {
    ...DEFAULT,
    notes:
      "Depends on definition relation, then classificatory category. Parent `verbal_classification` structurally compatible. Confidence: high.",
  },
  argument_from_composition: {
    ...DEFAULT,
    notes:
      "Depends on whole-part relation (parts of W have property P → W has P). Confidence: high.",
  },
  argument_from_division: {
    ...DEFAULT,
    notes:
      "Depends on whole-part relation (W has P → parts of W have P). Logical converse of composition. Confidence: high.",
  },

  // === Evidence family ===
  argument_from_lack_of_evidence: {
    ...DEFAULT,
    notes:
      "Depends on evidential-gap relation (no evidence for P after thorough search → not P). Walton's `ad ignorantiam`. Confidence: high.",
  },
  methodological_critique: {
    ...DEFAULT,
    notes:
      "Depends on methodology relation (study S used method M; M is unreliable for question Q → S's conclusion is unreliable). Confidence: high.",
  },
  statistical_generalization: {
    ...DEFAULT,
    notes:
      "Depends on sample-to-population relation. Confidence: high.",
  },

  // === Practical reasoning family ===
  practical_reasoning: {
    ...DEFAULT,
    notes:
      "Depends on goal-means relation (agent A has goal G; A doing X realises G → A should do X). Walton's master practical-reasoning scheme. Confidence: high.",
  },
  positive_consequences: {
    ...DEFAULT,
    notes:
      "Depends on consequence relation (doing X has consequence C; C is good → X should be done). Parent `practical_reasoning` structurally compatible. Confidence: high.",
  },
  negative_consequences: {
    ...DEFAULT,
    notes:
      "Depends on consequence relation (doing X has consequence C; C is bad → X should not be done). Parent `practical_reasoning` compatible. Confidence: high.",
  },
  good_consequences: {
    ...DEFAULT,
    notes:
      "Depends on consequence relation. **Folksonomy signal** — near-duplicate of `positive_consequences`; cluster tag missing (null). Spec 4 verifier candidate. Confidence: high.",
  },
  slippery_slope: {
    ...DEFAULT,
    notes:
      "Depends on causal chain (X → X' → … → bad outcome). Parent `negative_consequences` compatible (three-level chain: slippery_slope → negative_consequences → practical_reasoning, all non-rigid/dependent). Confidence: high.",
  },
  value_based_pr: {
    ...DEFAULT,
    notes:
      "Depends on value-promotion relation (doing X promotes value V; V is held by A → A should do X). Parent `practical_reasoning` compatible. Confidence: high.",
  },

  // === Similarity family ===
  analogy: {
    ...DEFAULT,
    notes:
      "Depends on similarity-relation (case C₁ and case C₂ are similar in respect R; C₁ has property P → C₂ has P). Confidence: high.",
  },
  argument_from_example: {
    ...DEFAULT,
    notes:
      "Depends on exemplar-relation (E is an example of P; E has feature F → P-instances have F). Confidence: high.",
  },
  scheme_test: {
    rigidity: "non-rigid",
    identity: "no-identity",
    unity: "no-unity",
    dependence: "independent",
    notes:
      "Test placeholder parented under `analogy`. **Folksonomy signal — strong**: independent placeholder under dependent substantive parent is a category-mixing pattern. Should be deleted from production catalogue or moved to a `_test_fixtures` cluster. Not a strict OntoClean violation but recorded as `violation` for surfacing. Confidence: high.",
  },

  // === Unclustered / dialogue-meta / placeholders ===
  bare_assertion: {
    rigidity: "non-rigid",
    identity: "no-identity",
    unity: "no-unity",
    dependence: "independent",
    notes:
      "Dialogue-baseline scheme — speaker simply asserts P with no inferential structure. Independent (no extrinsic relation required). Not really a Walton scheme; functions as a substrate-internal dialogue placeholder. Cluster tag missing. Confidence: high.",
  },
  claim_clarity: {
    rigidity: "non-rigid",
    identity: "no-identity",
    unity: "no-unity",
    dependence: "independent",
    notes:
      "Dialogue-meta scheme (meta-question about a claim's clarity, not an argument-inference pattern). Independent. **Folksonomy signal** — category-mixing: meta-CQ-style entries live in the `ArgumentScheme` table alongside Walton schemes. Confidence: high.",
  },
  claim_relevance: {
    rigidity: "non-rigid",
    identity: "no-identity",
    unity: "no-unity",
    dependence: "independent",
    notes:
      "Dialogue-meta — meta-question about relevance. Same category-mixing signal as `claim_clarity`. Confidence: high.",
  },
  claim_truth: {
    rigidity: "non-rigid",
    identity: "no-identity",
    unity: "no-unity",
    dependence: "independent",
    notes:
      "Dialogue-meta — meta-question about truth. Same category-mixing signal. Confidence: high.",
  },
  sign: {
    ...DEFAULT,
    notes:
      "Depends on sign-relation (X is a sign of Y; X observed → Y). Walton's classical sign scheme. Cluster tag missing — should be `evidence_family` or its own `sign_family`. Confidence: high.",
  },
  test_scheme: {
    rigidity: "non-rigid",
    identity: "no-identity",
    unity: "no-unity",
    dependence: "independent",
    notes:
      "Test placeholder. **Folksonomy signal** — production catalogue contains a row literally named `test_scheme`. Should be deleted or moved to a `_test_fixtures` cluster. Confidence: high.",
  },
};

type OntoCleanRow = {
  id: string;
  key: string;
  name: string | null;
  clusterTag: string | null;
  parentSchemeId: string | null;
  parentKey: string | null;
  parentClusterTag: string | null;
  rigidity: Rigidity;
  identity: Identity;
  unity: Unity;
  dependence: Dependence;
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

function classifyHierarchyViolation(
  row: OntoCleanRow,
  byId: Map<string, OntoCleanRow>,
): { violation: boolean; description: string } {
  if (!row.parentSchemeId) return { violation: false, description: "" };
  const parent = byId.get(row.parentSchemeId);
  if (!parent) return { violation: false, description: "" };

  // OntoClean rule 1: anti-rigid parent cannot subsume rigid child.
  if (parent.rigidity === "anti-rigid" && row.rigidity === "rigid") {
    return {
      violation: true,
      description: `Anti-rigid parent (\`${parent.key}\`) subsuming rigid child (\`${row.key}\`) — strict OntoClean violation.`,
    };
  }
  // Rule 2: incompatible identity criteria. Both must carry identity to even check.
  // Not applicable in this catalogue (no scheme carries identity).

  // Soft signal: dependent parent → independent child suggests category-mixing.
  if (parent.dependence === "dependent" && row.dependence === "independent") {
    return {
      violation: true,
      description: `Soft signal: independent child (\`${row.key}\`) under dependent parent (\`${parent.key}\`) — category-mixing in the hierarchy. Not a strict OntoClean violation; recorded for the Q-014 folksonomy diagnosis.`,
    };
  }
  return { violation: false, description: "" };
}

function main(): void {
  const inPath = pickInputPath();
  const raw = readFileSync(inPath, "utf8");
  const data = JSON.parse(raw) as Q018Output;

  for (const row of data.rows) {
    const c = TABLE[row.key];
    if (!c) {
      row.classifierNotes =
        "**UNCLASSIFIED** — key not in classifier table. Update scripts/audits/classify-ontoclean.ts.";
      continue;
    }
    row.rigidity = c.rigidity;
    row.identity = c.identity;
    row.unity = c.unity;
    row.dependence = c.dependence;
    row.isAntiRigid = c.rigidity === "anti-rigid";
    row.classifierNotes = c.notes;
  }

  // Hierarchy-violation pass.
  const byId = new Map(data.rows.map((r) => [r.id, r]));
  for (const row of data.rows) {
    const { violation, description } = classifyHierarchyViolation(row, byId);
    row.ontoCleanViolation = violation;
    row.violationDescription = description;
  }

  // Recompute summary counts.
  data.byRigidity = {
    rigid: 0,
    "non-rigid": 0,
    "anti-rigid": 0,
  };
  for (const r of data.rows) data.byRigidity[r.rigidity] += 1;
  data.violationsCount = data.rows.filter((r) => r.ontoCleanViolation).length;
  data.violatingClusterTags = Array.from(
    new Set(
      data.rows
        .filter((r) => r.ontoCleanViolation)
        .map((r) => r.clusterTag ?? "(none)"),
    ),
  );

  // Folksonomy signals (qualitative).
  data.folksonomySignals = {
    duplicateCandidates: [
      ["expert_opinion", "expert-opinion", "naming-convention duplicate (underscore vs hyphen)"],
      ["positive_consequences", "good_consequences", "near-synonymous; one has cluster tag, one does not"],
      ["causal", "cause_to_effect", "near-duplicate with directional refinement; one has cluster tag, one does not"],
    ],
    testPlaceholders: ["scheme_test", "test_scheme"],
    dialogueMetaInScheme: ["bare_assertion", "claim_clarity", "claim_relevance", "claim_truth"],
    missingClusterTag: data.rows
      .filter((r) => !r.clusterTag)
      .map((r) => r.key),
    clusterNamingInconsistencies: ["causal_family (used by `causal`) vs causality_family (used by `inference_to_best_explanation`)"],
  };

  data.classifiedAtIso = new Date().toISOString();

  writeFileSync(inPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`[q018:classify] wrote ${inPath}`);
  console.log(
    `[q018:classify] byRigidity: rigid=${data.byRigidity.rigid}, non-rigid=${data.byRigidity["non-rigid"]}, anti-rigid=${data.byRigidity["anti-rigid"]}`,
  );
  console.log(
    `[q018:classify] strict + soft violations: ${data.violationsCount}; duplicate-candidate clusters: ${data.folksonomySignals.duplicateCandidates.length}; test placeholders: ${data.folksonomySignals.testPlaceholders.length}`,
  );
}

main();
