/**
 * Additive scheme seed for the polarization-1 experiment.
 *
 * Adds four schemes the global seed (`scripts/seed-comprehensive-schemes.ts`)
 * does not currently include but Phase 2 advocates need:
 *
 *   - inference_to_best_explanation   (Walton — IBE / abduction)
 *   - statistical_generalization      (Walton — sample-to-population)
 *   - argument_from_lack_of_evidence  (Walton — argument from ignorance / negative evidence)
 *   - methodological_critique         (NON-STANDARD — see EXPERIMENT_SCHEMES_TODO.md)
 *
 * Idempotent: upserts by `key`, then deletes-and-recreates the scheme's
 * CriticalQuestion rows so re-running this script picks up edits.
 *
 * Usage:
 *   npx tsx --env-file=.env experiments/polarization-1/scripts/seed-experiment-schemes.ts
 */

import { prisma } from "@/lib/prismaclient";

type CQData = {
  cqKey: string;
  text: string;
  attackType: "REBUTS" | "UNDERCUTS" | "UNDERMINES";
  targetScope: "conclusion" | "inference" | "premise";
};

type PremiseData = { id: string; type: "major" | "minor"; text: string; variables: string[] };

type SchemeData = {
  key: string;
  name: string;
  summary: string;
  description: string;
  purpose: "action" | "state_of_affairs" | null;
  source: "internal" | "external" | null;
  materialRelation: string | null;
  reasoningType: "deductive" | "inductive" | "abductive" | "practical" | null;
  ruleForm: string | null;
  conclusionType: "is" | "ought" | null;
  premises: PremiseData[];
  conclusion: { text: string; variables: string[] } | null;
  cqs: CQData[];
  clusterTag: string | null;
  inheritCQs: boolean;
};

const schemes: SchemeData[] = [
  {
    key: "inference_to_best_explanation",
    name: "Inference to the Best Explanation",
    summary:
      "Concludes that the hypothesis which best explains the observed evidence is (defeasibly) true.",
    description:
      "Standard Waltonian abductive scheme. Given a body of facts F and a set of candidate explanatory hypotheses {H1..Hn}, if H* explains F better than every alternative — typically along the dimensions of scope, simplicity, mechanistic plausibility, and consistency with background knowledge — then H* is to be (defeasibly) accepted.",
    purpose: "state_of_affairs",
    source: "internal",
    materialRelation: "cause",
    reasoningType: "abductive",
    ruleForm: "defeasible_MP",
    conclusionType: "is",
    premises: [
      { id: "P1", type: "major", text: "F is a body of observed facts requiring explanation.", variables: ["F"] },
      { id: "P2", type: "minor", text: "Hypothesis H explains F.", variables: ["H", "F"] },
      {
        id: "P3",
        type: "minor",
        text: "Of the available alternative hypotheses, no other explains F as well as H along the relevant dimensions (scope, simplicity, mechanism, consistency with background knowledge).",
        variables: ["H", "F"],
      },
    ],
    conclusion: { text: "Therefore, H is (defeasibly) the case.", variables: ["H"] },
    cqs: [
      {
        cqKey: "alternative_hypothesis?",
        text: "Is there a plausible alternative hypothesis that has not been considered or that would explain the facts at least as well?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "explains_all_facts?",
        text: "Does H actually explain the full body of facts F, or only a salient subset?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
      {
        cqKey: "explanatory_criteria?",
        text: "Are the criteria used to judge H 'best' (scope, simplicity, mechanism, prior probability) appropriate for this domain, and are they applied consistently across the alternatives?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "evidence_artifact?",
        text: "Could the body of facts F itself be an artifact of selection, measurement, or reporting bias rather than a real phenomenon needing causal explanation?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
      {
        cqKey: "conjunction_of_causes?",
        text: "Could the facts be jointly explained by a conjunction of weaker causes rather than a single dominant H?",
        attackType: "REBUTS",
        targetScope: "conclusion",
      },
    ],
    clusterTag: "causality_family",
    inheritCQs: true,
  },

  {
    key: "statistical_generalization",
    name: "Argument from Sample to Population (Statistical Generalization)",
    summary:
      "Generalizes from a measured sample to the broader population from which it was drawn.",
    description:
      "Standard Walton inductive scheme. From the observation that property F holds in proportion p (with margin m) of a sample S drawn from population P, infer that F holds in approximately proportion p of P. The inferential force is conditional on the sample's size, representativeness, measurement validity, and the absence of selection effects.",
    purpose: "state_of_affairs",
    source: "internal",
    materialRelation: "definition",
    reasoningType: "inductive",
    ruleForm: "defeasible_MP",
    conclusionType: "is",
    premises: [
      {
        id: "P1",
        type: "major",
        text: "Sample S was drawn from population P, and property F was measured to hold in proportion p of S (with margin m).",
        variables: ["S", "P", "F", "p", "m"],
      },
      {
        id: "P2",
        type: "minor",
        text: "S is representative of P with respect to F (or sufficiently large and randomly drawn that representativeness can be assumed).",
        variables: ["S", "P", "F"],
      },
    ],
    conclusion: {
      text: "Therefore, F holds in approximately proportion p of P (within margin m).",
      variables: ["P", "F", "p", "m"],
    },
    cqs: [
      {
        cqKey: "sample_size?",
        text: "Is the sample large enough to support the precision (margin m) being claimed?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "representativeness?",
        text: "Is the sample actually representative of the target population on the dimensions that matter for F (demographics, behavior, time period, platform mix)?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
      {
        cqKey: "selection_effect?",
        text: "Was the sample drawn or recruited in a way that systematically biases the proportion of F (e.g., volunteer bias, opt-in panels, attrition)?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
      {
        cqKey: "measurement_validity?",
        text: "Does the operational measure of F in the sample actually capture F as it is meant in the population-level claim?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
      {
        cqKey: "scope_of_generalization?",
        text: "Does the conclusion stay within the population P from which S was drawn, or does it overreach (different country, different time period, different platform)?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
    ],
    clusterTag: "evidence_family",
    inheritCQs: true,
  },

  {
    key: "argument_from_lack_of_evidence",
    name: "Argument from Lack of Evidence (Negative Evidence)",
    summary:
      "Concludes that a proposition is (defeasibly) false because, if it were true, evidence for it should by now have been found.",
    description:
      "Standard Walton scheme, sometimes called argument from ignorance or argument from negative evidence. Its inferential force depends on the proposition being one for which a serious search for evidence would have produced findings if true (the 'epistemic closure' premise). Vulnerable to underpowered-search and absence-of-search counters.",
    purpose: "state_of_affairs",
    source: "internal",
    materialRelation: "definition",
    reasoningType: "inductive",
    ruleForm: "defeasible_MP",
    conclusionType: "is",
    premises: [
      {
        id: "P1",
        type: "major",
        text: "If proposition A were true, then evidence E supporting A would (with high probability) have been found by now under the existing investigative regime.",
        variables: ["A", "E"],
      },
      {
        id: "P2",
        type: "minor",
        text: "Despite that investigative regime, no such evidence E has been found.",
        variables: ["E"],
      },
    ],
    conclusion: { text: "Therefore, A is (defeasibly) false.", variables: ["A"] },
    cqs: [
      {
        cqKey: "search_adequate?",
        text: "Has the investigative regime actually been adequate (well-funded, well-powered, well-designed) to detect E if A were true?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
      {
        cqKey: "absence_of_search?",
        text: "Is the absence of evidence due to absence of investigation rather than to A's being false?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
      {
        cqKey: "publication_bias?",
        text: "Could disconfirming or null findings have been suppressed, unpublished, or systematically under-reported (file-drawer / publication bias)?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
      {
        cqKey: "absence_of_proof_vs_proof_of_absence?",
        text: "Is the absence of positive evidence strong enough to justify concluding ¬A, or only to justify withholding belief in A?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "weak_signal?",
        text: "Could A be true but produce only a weak signal that escapes detection at the prevailing statistical thresholds?",
        attackType: "REBUTS",
        targetScope: "conclusion",
      },
    ],
    clusterTag: "evidence_family",
    inheritCQs: true,
  },

  {
    // NON-STANDARD — see EXPERIMENT_SCHEMES_TODO.md
    key: "methodological_critique",
    name: "Methodological Critique (NON-STANDARD)",
    summary:
      "Defeasibly downgrades a conclusion drawn from a study by identifying a methodological defect that biases or invalidates that study's inference.",
    description:
      "Non-standard scheme introduced for the polarization-1 experiment. A meta-level inferential pattern: 'study S concludes H; study S has methodological defect D of kind K; defect D of kind K systematically biases studies in direction B; therefore H, as supported by S, should be downgraded by amount A (or rejected entirely).' Distinct from a flat rebuttal because it does not directly attack H — it attacks the warrant from S to H. Distinct from undercutting an argument because it operates at the level of evidence quality across studies, not at the level of a single argument's scheme. Probably folds eventually into a generalized 'evidence quality argument' family in the global catalog.",
    purpose: "state_of_affairs",
    source: "external",
    materialRelation: "definition",
    reasoningType: "inductive",
    ruleForm: "defeasible_MP",
    conclusionType: "is",
    premises: [
      { id: "P1", type: "major", text: "Study S concludes hypothesis H.", variables: ["S", "H"] },
      {
        id: "P2",
        type: "minor",
        text: "Study S has methodological defect D of recognized kind K (e.g., short observation window, non-representative sample, confounded treatment, low power, missing pre-registration).",
        variables: ["S", "D", "K"],
      },
      {
        id: "P3",
        type: "minor",
        text: "Defects of kind K are known in the relevant methodological literature to bias inferences in direction B (e.g., upward, toward null, toward Type-I error).",
        variables: ["K", "B"],
      },
    ],
    conclusion: {
      text: "Therefore, the support S provides for H should be discounted (or, if D is severe enough, S should not be counted as evidence for H).",
      variables: ["S", "H"],
    },
    cqs: [
      {
        cqKey: "defect_present?",
        text: "Does study S actually have defect D, or is the description of S inaccurate?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
      {
        cqKey: "bias_direction_known?",
        text: "Is the literature really agreed that defects of kind K bias inferences in direction B, or is the bias direction itself contested?",
        attackType: "UNDERMINES",
        targetScope: "premise",
      },
      {
        cqKey: "robustness_check?",
        text: "Has S (or a follow-up study) performed a robustness check or sensitivity analysis that addresses defect D directly?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "triangulation?",
        text: "Is H supported by independent studies that do not share defect D, such that S's defect does not undermine H itself?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
      {
        cqKey: "magnitude_of_bias?",
        text: "Is the expected magnitude of the bias from D large enough to overturn S's reported effect, or is the effect robust to plausible bias corrections?",
        attackType: "REBUTS",
        targetScope: "conclusion",
      },
      {
        cqKey: "selective_critique?",
        text: "Is this critique applied consistently — i.e., would it apply to studies on the other side of the debate that share the same defect kind K?",
        attackType: "UNDERCUTS",
        targetScope: "inference",
      },
    ],
    clusterTag: "evidence_family",
    inheritCQs: true,
  },
];

async function upsertScheme(s: SchemeData): Promise<{ id: string; key: string; created: boolean }> {
  const existing = await prisma.argumentScheme.findUnique({ where: { key: s.key }, select: { id: true } });

  const data = {
    name: s.name,
    summary: s.summary,
    description: s.description,
    purpose: s.purpose,
    source: s.source,
    materialRelation: s.materialRelation,
    reasoningType: s.reasoningType,
    ruleForm: s.ruleForm,
    conclusionType: s.conclusionType,
    premises: s.premises as any,
    conclusion: s.conclusion as any,
    cq: s.cqs as any,
    clusterTag: s.clusterTag,
    inheritCQs: s.inheritCQs,
  };

  const scheme = await prisma.argumentScheme.upsert({
    where: { key: s.key },
    create: { key: s.key, ...data },
    update: data,
    select: { id: true, key: true },
  });

  // Replace CQ rows for this scheme so the script is idempotent against edits.
  await prisma.criticalQuestion.deleteMany({ where: { schemeId: scheme.id } });
  if (s.cqs.length > 0) {
    await prisma.criticalQuestion.createMany({
      data: s.cqs.map((cq) => ({
        schemeId: scheme.id,
        cqKey: cq.cqKey,
        text: cq.text,
        attackKind: cq.attackType,
        status: "open",
        attackType: cq.attackType,
        targetScope: cq.targetScope,
      })) as any,
      skipDuplicates: false,
    });
  }

  return { id: scheme.id, key: scheme.key, created: !existing };
}

async function main() {
  console.log("🌱 Seeding polarization-1 experiment schemes (additive, idempotent)…\n");

  for (const s of schemes) {
    try {
      const r = await upsertScheme(s);
      const tag = r.created ? "✅ created" : "🔄 updated";
      console.log(`  ${tag}  ${r.key.padEnd(34)} (${s.cqs.length} CQs)`);
    } catch (err) {
      console.error(`  ❌ failed   ${s.key}:`, err);
      process.exitCode = 1;
    }
  }

  const total = await prisma.argumentScheme.count();
  console.log(`\n📈 Catalog now contains ${total} schemes total.`);
  console.log("   (See EXPERIMENT_SCHEMES_TODO.md for schemes that should fold back into the global Walton seed.)");
}

main()
  .catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
