/**
 * scripts/test-cq-generation.ts
 * 
 * Test suite for Phase 3: Automatic CQ Generation
 * 
 * Run with: npx tsx scripts/test-cq-generation.ts
 */

import {
  generateCQsFromTaxonomy,
  prioritizeCQs,
  generateCompleteCQSet,
  suggestCQUpdates,
  type TaxonomyFields,
  type CriticalQuestion,
} from "../lib/argumentation/cqGeneration";

type TestCase = {
  name: string;
  taxonomy: TaxonomyFields;
  schemeKey: string;
  expectedMinCQs: number;
  expectedMaxCQs: number;
  mustContain?: string[]; // CQ keys that must be present
};

const TEST_CASES: TestCase[] = [
  {
    name: "Expert Opinion Scheme",
    taxonomy: {
      materialRelation: "authority",
      source: "external",
      reasoningType: "abductive",
      conclusionType: "is",
    },
    schemeKey: "expert_opinion",
    expectedMinCQs: 8,
    expectedMaxCQs: 15,
    mustContain: [
      "expertopinion_expert_qualified",
      "expertopinion_expert_credible",
      "expertopinion_expert_consensus",
      "expertopinion_source_reliable",
    ],
  },
  {
    name: "Causal Argument Scheme",
    taxonomy: {
      materialRelation: "cause",
      source: "internal",
      reasoningType: "inductive",
      conclusionType: "is",
    },
    schemeKey: "causal_argument",
    expectedMinCQs: 7,
    expectedMaxCQs: 12,
    mustContain: [
      "causalargument_causal_link",
      "causalargument_confounders",
      "causalargument_necessary_sufficient",
    ],
  },
  {
    name: "Practical Reasoning Scheme",
    taxonomy: {
      materialRelation: "practical",
      reasoningType: "practical",
      purpose: "action",
      conclusionType: "ought",
    },
    schemeKey: "practical_reasoning",
    expectedMinCQs: 10,
    expectedMaxCQs: 16,
    mustContain: [
      "practicalreasoning_feasible",
      "practicalreasoning_side_effects",
      "practicalreasoning_alternative_means",
      "practicalreasoning_goal_desirable",
      "practicalreasoning_means_effective",
      "practicalreasoning_action_timing",
      "practicalreasoning_normative_basis",
    ],
  },
  {
    name: "Analogy Scheme",
    taxonomy: {
      materialRelation: "analogy",
      reasoningType: "inductive",
      conclusionType: "is",
    },
    schemeKey: "analogy",
    expectedMinCQs: 6,
    expectedMaxCQs: 10,
    mustContain: [
      "analogy_relevant_similarities",
      "analogy_critical_differences",
      "analogy_other_analogies",
    ],
  },
  {
    name: "Definition/Classification Scheme",
    taxonomy: {
      materialRelation: "definition",
      reasoningType: "deductive",
      conclusionType: "is",
    },
    schemeKey: "classification",
    expectedMinCQs: 6,
    expectedMaxCQs: 10,
    mustContain: [
      "classification_definition_accepted",
      "classification_borderline_case",
      "classification_necessary_properties",
      "classification_premises_true",
      "classification_logically_valid",
    ],
  },
  {
    name: "Sign/Correlation Scheme",
    taxonomy: {
      materialRelation: "correlation",
      reasoningType: "abductive",
      conclusionType: "is",
    },
    schemeKey: "sign_argument",
    expectedMinCQs: 6,
    expectedMaxCQs: 10,
    mustContain: [
      "signargument_correlation_spurious",
      "signargument_correlation_strength",
      "signargument_other_indicators",
    ],
  },
  {
    name: "Minimal Taxonomy (universal CQs only)",
    taxonomy: {},
    schemeKey: "generic_claim",
    expectedMinCQs: 2,
    expectedMaxCQs: 3,
    mustContain: ["genericclaim_relevance", "genericclaim_sufficient_grounds"],
  },
];

function runTests() {
  console.log("🧪 Testing CQ Generation (Phase 3)\n");
  console.log("=" .repeat(80));

  let passed = 0;
  let failed = 0;

  for (const test of TEST_CASES) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   Taxonomy: ${JSON.stringify(test.taxonomy, null, 2).replace(/\n/g, "\n   ")}`);

    try {
      const cqs = generateCQsFromTaxonomy(test.taxonomy, test.schemeKey);

      console.log(`   Generated ${cqs.length} CQs`);

      // Check count range
      if (cqs.length < test.expectedMinCQs) {
        throw new Error(
          `Too few CQs: expected at least ${test.expectedMinCQs}, got ${cqs.length}`
        );
      }
      if (cqs.length > test.expectedMaxCQs) {
        throw new Error(
          `Too many CQs: expected at most ${test.expectedMaxCQs}, got ${cqs.length}`
        );
      }

      // Check required CQs
      if (test.mustContain) {
        const cqKeys = new Set(cqs.map((cq) => cq.cqKey));
        const missing = test.mustContain.filter((key) => !cqKeys.has(key));
        if (missing.length > 0) {
          throw new Error(`Missing required CQs: ${missing.join(", ")}`);
        }
      }

      // Verify attack types
      const invalidAttacks = cqs.filter(
        (cq) => !["REBUTS", "UNDERCUTS", "UNDERMINES"].includes(cq.attackType)
      );
      if (invalidAttacks.length > 0) {
        throw new Error(
          `Invalid attack types: ${invalidAttacks.map((cq) => cq.cqKey).join(", ")}`
        );
      }

      // Verify target scopes
      const invalidScopes = cqs.filter(
        (cq) => !["conclusion", "inference", "premise"].includes(cq.targetScope)
        );
      if (invalidScopes.length > 0) {
        throw new Error(
          `Invalid target scopes: ${invalidScopes.map((cq) => cq.cqKey).join(", ")}`
        );
      }

      console.log(`   ✅ PASS`);
      console.log(`   CQs generated:`);
      cqs.slice(0, 5).forEach((cq) => {
        console.log(`     - ${cq.cqKey}: "${cq.text}"`);
        console.log(`       ${cq.attackType} → ${cq.targetScope}`);
      });
      if (cqs.length > 5) {
        console.log(`     ... and ${cqs.length - 5} more`);
      }
      passed++;
    } catch (error) {
      console.log(`   ❌ FAIL: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\n📊 Test Results:`);
  console.log(`  Total: ${TEST_CASES.length}`);
  console.log(`  ✓ Passed: ${passed} (${((passed / TEST_CASES.length) * 100).toFixed(1)}%)`);
  console.log(`  ✗ Failed: ${failed} (${((failed / TEST_CASES.length) * 100).toFixed(1)}%)`);
  console.log("\n" + "=".repeat(80));

  // Test prioritization
  console.log("\n🔄 Testing CQ Prioritization...\n");
  const testCQs: CriticalQuestion[] = [
    {
      cqKey: "test_rebuts",
      text: "Rebuts test",
      attackType: "REBUTS",
      targetScope: "conclusion",
    },
    {
      cqKey: "test_undercuts",
      text: "Undercuts test",
      attackType: "UNDERCUTS",
      targetScope: "inference",
    },
    {
      cqKey: "test_undermines",
      text: "Undermines test",
      attackType: "UNDERMINES",
      targetScope: "premise",
    },
  ];

  const prioritized = prioritizeCQs(testCQs, 10);
  console.log("Prioritized order (UNDERMINES > UNDERCUTS > REBUTS):");
  prioritized.forEach((cq, i) => {
    console.log(`  ${i + 1}. ${cq.cqKey} (${cq.attackType})`);
  });

  if (
    prioritized[0].attackType === "UNDERMINES" &&
    prioritized[1].attackType === "UNDERCUTS" &&
    prioritized[2].attackType === "REBUTS"
  ) {
    console.log("✅ Prioritization PASS\n");
  } else {
    console.log("❌ Prioritization FAIL\n");
    failed++;
  }

  // Test complete CQ set generation
  console.log("🔄 Testing Complete CQ Set Generation...\n");
  const manualCQs: CriticalQuestion[] = [
    {
      cqKey: "manual_cq",
      text: "Manual CQ",
      attackType: "REBUTS",
      targetScope: "conclusion",
    },
  ];

  const complete = generateCompleteCQSet(
    { materialRelation: "authority" },
    "test_scheme",
    manualCQs,
    5
  );

  console.log(`Generated ${complete.length} CQs (max 5)`);
  console.log("First CQ:", complete[0].cqKey);

  if (complete[0].cqKey === "manual_cq") {
    console.log("✅ Manual CQs have precedence: PASS\n");
  } else {
    console.log("❌ Manual CQs should come first: FAIL\n");
    failed++;
  }

  // Test CQ update suggestions
  console.log("🔄 Testing CQ Update Suggestions...\n");
  const oldTaxonomy: TaxonomyFields = { materialRelation: "cause" };
  const newTaxonomy: TaxonomyFields = {
    materialRelation: "cause",
    reasoningType: "abductive",
  };

  const suggestions = suggestCQUpdates(oldTaxonomy, newTaxonomy, "test_scheme");
  console.log(`Suggested ${suggestions.length} new CQs after taxonomy change`);

  if (suggestions.length > 0) {
    console.log("Sample suggestions:");
    suggestions.slice(0, 3).forEach((cq) => {
      console.log(`  - ${cq.cqKey}`);
    });
    console.log("✅ Suggestion generation: PASS\n");
  } else {
    console.log("❌ Expected suggestions for taxonomy change: FAIL\n");
    failed++;
  }

  console.log("=".repeat(80));

  if (failed === 0) {
    console.log("\n✅ All tests passed! CQ generation is working correctly.\n");
    process.exit(0);
  } else {
    console.log(`\n❌ ${failed} test(s) failed.\n`);
    process.exit(1);
  }
}

runTests();
