#!/usr/bin/env tsx

/**
 * Seed script for Dichotomic Tree Wizard
 * Populates purpose and source fields for existing argument schemes
 * 
 * Run with: npx tsx scripts/seed-dichotomic-tree-metadata.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Scheme classifications based on Walton's Macagno taxonomy
 * and common argument scheme characteristics
 */
const schemeClassifications: Record<string, { purpose: string; source: string }> = {
  // EXPERT OPINION / AUTHORITY (Action-guiding, External)
  "argument_from_expert_opinion": { purpose: "action", source: "external" },
  "argument_from_position_to_know": { purpose: "action", source: "external" },
  "argument_from_witness_testimony": { purpose: "state_of_affairs", source: "external" },
  "argument_from_popular_opinion": { purpose: "action", source: "external" },
  "argument_from_popular_practice": { purpose: "action", source: "external" },
  
  // CONSEQUENCES (Action-guiding, Internal)
  "argument_from_consequences": { purpose: "action", source: "internal" },
  "argument_from_negative_consequences": { purpose: "action", source: "internal" },
  "argument_from_positive_consequences": { purpose: "action", source: "internal" },
  "practical_reasoning": { purpose: "action", source: "internal" },
  "argument_from_waste": { purpose: "action", source: "internal" },
  
  // CAUSATION (State of Affairs, Internal)
  "argument_from_cause_to_effect": { purpose: "state_of_affairs", source: "internal" },
  "argument_from_effect_to_cause": { purpose: "state_of_affairs", source: "internal" },
  "argument_from_correlation_to_cause": { purpose: "state_of_affairs", source: "internal" },
  "causal_slippery_slope": { purpose: "state_of_affairs", source: "internal" },
  
  // SIGN / EVIDENCE (State of Affairs, External)
  "argument_from_sign": { purpose: "state_of_affairs", source: "external" },
  "argument_from_evidence_to_hypothesis": { purpose: "state_of_affairs", source: "external" },
  "abductive_reasoning": { purpose: "state_of_affairs", source: "internal" },
  
  // ANALOGY (Both purposes, Internal)
  "argument_from_analogy": { purpose: "action", source: "internal" },
  "argument_from_precedent": { purpose: "action", source: "internal" },
  "argument_from_example": { purpose: "action", source: "external" },
  "a_fortiori_argument": { purpose: "action", source: "internal" },
  
  // CLASSIFICATION / DEFINITION (State of Affairs, Internal)
  "argument_from_definition": { purpose: "state_of_affairs", source: "internal" },
  "argument_from_verbal_classification": { purpose: "state_of_affairs", source: "internal" },
  "argument_from_classification": { purpose: "state_of_affairs", source: "internal" },
  "definitional_argument": { purpose: "state_of_affairs", source: "internal" },
  
  // RULES / LAWS (Action-guiding, External)
  "argument_from_rule": { purpose: "action", source: "external" },
  "argument_from_law": { purpose: "action", source: "external" },
  "argument_from_established_rule": { purpose: "action", source: "external" },
  
  // VALUES / ETHICS (Action-guiding, Internal)
  "argument_from_values": { purpose: "action", source: "internal" },
  "ethical_practical_reasoning": { purpose: "action", source: "internal" },
  "argument_from_fairness": { purpose: "action", source: "internal" },
  "argument_from_justice": { purpose: "action", source: "internal" },
  
  // COMMITMENT / CONSISTENCY (Action-guiding, Internal)
  "argument_from_commitment": { purpose: "action", source: "internal" },
  "argument_from_inconsistent_commitment": { purpose: "action", source: "internal" },
  "tu_quoque": { purpose: "action", source: "internal" },
  
  // GRADUALISM (Action-guiding, Internal)
  "argument_from_gradualism": { purpose: "action", source: "internal" },
  "argument_from_slippery_slope": { purpose: "action", source: "internal" },
  "sorites_argument": { purpose: "state_of_affairs", source: "internal" },
  
  // ALTERNATIVES / DILEMMA (Action-guiding, Internal)
  "argument_from_alternatives": { purpose: "action", source: "internal" },
  "dilemmatic_argument": { purpose: "action", source: "internal" },
  "argument_from_dilemma": { purpose: "action", source: "internal" },
  
  // FEAR / THREAT (Action-guiding, Internal)
  "argument_from_fear_appeal": { purpose: "action", source: "internal" },
  "argument_from_threat": { purpose: "action", source: "internal" },
  "argument_from_danger": { purpose: "action", source: "internal" },
  
  // PRAGMATIC / PRACTICAL (Action-guiding, Internal)
  "argument_from_sunk_costs": { purpose: "action", source: "internal" },
  "argument_from_necessary_condition": { purpose: "state_of_affairs", source: "internal" },
  "argument_from_sufficient_condition": { purpose: "state_of_affairs", source: "internal" },
  
  // OPPOSITION / INCOMPATIBILITY (State of Affairs, Internal)
  "argument_from_opposition": { purpose: "state_of_affairs", source: "internal" },
  "argument_from_incompatibility": { purpose: "state_of_affairs", source: "internal" },
  
  // ADDITIONAL SCHEMES
  "good_consequences": { purpose: "action", source: "internal" },
  "bare_assertion": { purpose: "state_of_affairs", source: "external" },
  "claim_relevance": { purpose: "state_of_affairs", source: "internal" },
  "claim_clarity": { purpose: "state_of_affairs", source: "internal" },
  "claim_truth": { purpose: "state_of_affairs", source: "external" },
};

async function main() {
  console.log("🌳 Seeding Dichotomic Tree metadata for ArgumentScheme...\n");

  // Get all schemes
  const allSchemes = await prisma.argumentScheme.findMany({
    select: { id: true, key: true, name: true, purpose: true, source: true },
  });

  console.log(`Found ${allSchemes.length} total schemes in database\n`);

  let updatedCount = 0;
  let alreadySetCount = 0;
  let notClassifiedCount = 0;

  for (const scheme of allSchemes) {
    // Skip if already has both purpose and source
    if (scheme.purpose && scheme.source) {
      alreadySetCount++;
      continue;
    }

    // Check if we have a classification for this scheme
    const classification = schemeClassifications[scheme.key];

    if (classification) {
      await prisma.argumentScheme.update({
        where: { id: scheme.id },
        data: {
          purpose: classification.purpose,
          source: classification.source,
        },
      });

      console.log(`✓ ${scheme.key}`);
      console.log(`  → purpose: ${classification.purpose}, source: ${classification.source}`);
      updatedCount++;
    } else {
      console.log(`⚠ ${scheme.key} - No classification defined`);
      notClassifiedCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  console.log(`  ✓ Updated: ${updatedCount} schemes`);
  console.log(`  → Already set: ${alreadySetCount} schemes`);
  console.log(`  ⚠ Not classified: ${notClassifiedCount} schemes`);
  console.log(`  Total: ${allSchemes.length} schemes`);
  console.log("=".repeat(60));

  if (notClassifiedCount > 0) {
    console.log("\n💡 Tip: Add classifications for remaining schemes in schemeClassifications object");
    console.log("   Keys of unclassified schemes:");
    const unclassified = allSchemes.filter(
      s => !s.purpose && !s.source && !schemeClassifications[s.key]
    );
    unclassified.slice(0, 10).forEach(s => console.log(`   - ${s.key}`));
    if (unclassified.length > 10) {
      console.log(`   ... and ${unclassified.length - 10} more`);
    }
  }

  console.log("\n✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding dichotomic tree metadata:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
