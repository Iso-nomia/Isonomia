// scripts/seed-aspic-mappings.ts
// Add ASPIC+ mappings to existing ArgumentScheme and CriticalQuestion records

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * ASPIC+ Mapping Structure:
 * 
 * For ArgumentScheme:
 * - ruleType: "strict" | "defeasible" (how this scheme maps to ASPIC+ rules)
 * - ruleId: identifier for the rule (used in undercutting attacks)
 * - preferenceLevel: 1-10 (higher = stronger, used in defeat resolution)
 * 
 * For CriticalQuestion:
 * - ruleId: which rule this CQ attacks (for UNDERCUTS)
 * - premiseIndex: which premise this CQ attacks (for UNDERMINES)
 * - defeasibleRuleRequired: whether attack only works on defeasible arguments
 */

const schemeMappings = [
  {
    key: "expert_opinion",
    aspicMapping: {
      ruleType: "defeasible",
      ruleId: "expert_opinion",
      preferenceLevel: 7, // Strong but fallible
    },
    cqs: {
      domain_fit: { ruleId: "expert_opinion", defeasibleRuleRequired: true },
      consensus: { ruleId: "expert_opinion", defeasibleRuleRequired: true },
      bias: { ruleId: "expert_opinion", defeasibleRuleRequired: true },
      basis: { premiseIndex: 0 }, // Undermines expert's assertion premise
    },
  },
  {
    key: "practical_reasoning",
    aspicMapping: {
      ruleType: "defeasible",
      ruleId: "practical_reasoning",
      preferenceLevel: 6,
    },
    cqs: {
      alternatives: { ruleId: "practical_reasoning", defeasibleRuleRequired: true },
      feasible: { ruleId: "practical_reasoning", defeasibleRuleRequired: true },
      side_effects: { ruleId: "practical_reasoning", defeasibleRuleRequired: true },
    },
  },
  {
    key: "positive_consequences",
    aspicMapping: {
      ruleType: "defeasible",
      ruleId: "positive_consequences",
      preferenceLevel: 5,
    },
    cqs: {
      tradeoffs: { ruleId: "positive_consequences", defeasibleRuleRequired: true },
      uncertain: { ruleId: "positive_consequences", defeasibleRuleRequired: true },
    },
  },
  {
    key: "negative_consequences",
    aspicMapping: {
      ruleType: "defeasible",
      ruleId: "negative_consequences",
      preferenceLevel: 5,
    },
    cqs: {
      mitigate: { ruleId: "negative_consequences", defeasibleRuleRequired: true },
      exaggerated: { ruleId: "negative_consequences", defeasibleRuleRequired: true },
    },
  },
  {
    key: "analogy",
    aspicMapping: {
      ruleType: "defeasible",
      ruleId: "analogy",
      preferenceLevel: 4, // Weaker inference
    },
    cqs: {
      relevant_sims: { ruleId: "analogy", defeasibleRuleRequired: true },
      critical_diffs: { ruleId: "analogy", defeasibleRuleRequired: true },
    },
  },
  {
    key: "causal",
    aspicMapping: {
      ruleType: "defeasible",
      ruleId: "causal",
      preferenceLevel: 6,
    },
    cqs: {
      alt_causes: { ruleId: "causal", defeasibleRuleRequired: true },
      post_hoc: { ruleId: "causal", defeasibleRuleRequired: true },
    },
  },
  {
    key: "classification",
    aspicMapping: {
      ruleType: "strict", // Deductive reasoning
      ruleId: "classification",
      preferenceLevel: 9, // Very strong
    },
    cqs: {
      category_fit: { ruleId: "classification", defeasibleRuleRequired: false },
    },
  },
];

async function main() {
  console.log("🔧 Updating ArgumentScheme and CriticalQuestion records with ASPIC+ mappings...\n");

  for (const mapping of schemeMappings) {
    // Update scheme
    const scheme = await prisma.argumentScheme.findUnique({
      where: { key: mapping.key },
      include: { cqs: true },
    });

    if (!scheme) {
      console.log(`⚠️  Scheme '${mapping.key}' not found, skipping...`);
      continue;
    }

    await prisma.argumentScheme.update({
      where: { id: scheme.id },
      data: { aspicMapping: mapping.aspicMapping },
    });

    console.log(`✅ Updated scheme '${mapping.key}' with ASPIC+ mapping`);
    console.log(`   ruleType: ${mapping.aspicMapping.ruleType}`);
    console.log(`   ruleId: ${mapping.aspicMapping.ruleId}`);
    console.log(`   preferenceLevel: ${mapping.aspicMapping.preferenceLevel}`);

    // Update CQs
    for (const [cqKey, cqMapping] of Object.entries(mapping.cqs)) {
      const cq = scheme.cqs.find((c) => c.cqKey === cqKey);
      if (!cq) {
        console.log(`   ⚠️  CQ '${cqKey}' not found in scheme '${mapping.key}'`);
        continue;
      }

      await prisma.criticalQuestion.update({
        where: { id: cq.id },
        data: { aspicMapping: cqMapping },
      });

      console.log(`   ✅ Updated CQ '${cqKey}' with ASPIC+ mapping:`, cqMapping);
    }

    console.log("");
  }

  console.log("✨ ASPIC+ mappings seeded successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error seeding ASPIC+ mappings:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
