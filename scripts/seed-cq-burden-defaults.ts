/**
 * Seed script for Phase 0.1: Apply intelligent burden of proof defaults to existing CQs
 * 
 * This script analyzes existing CriticalQuestion records and sets appropriate
 * burdenOfProof, requiresEvidence, and premiseType values based on text patterns.
 * 
 * Run with: tsx --env-file=.env scripts/seed-cq-burden-defaults.ts
 */

import { prisma } from "@/lib/prismaclient";
import { BurdenOfProof, PremiseType } from "@prisma/client";

// Text patterns that indicate burden should be on proponent
const PROPONENT_PATTERNS = [
  /how do you know/i,
  /what evidence/i,
  /can you prove/i,
  /is .*? true/i,
  /are you sure/i,
  /what makes you think/i,
  /why should we believe/i,
  /what justifies/i,
];

// Text patterns that indicate burden should be on challenger
const CHALLENGER_PATTERNS = [
  /exception/i,
  /counter.*example/i,
  /alternative explanation/i,
  /is there.*? that shows/i,
  /can you show/i,
  /do you have evidence that/i,
];

// Text patterns that indicate evidence is required (not just asking)
const EVIDENCE_REQUIRED_PATTERNS = [
  /what evidence/i,
  /provide.*?proof/i,
  /demonstrate/i,
  /show that/i,
  /cite.*?source/i,
  /what study/i,
  /what data/i,
];

// Text patterns for premise type classification
const ASSUMPTION_PATTERNS = [
  /assumption/i,
  /presuppose/i,
  /taken for granted/i,
  /implicitly assume/i,
];

const EXCEPTION_PATTERNS = [
  /exception/i,
  /special case/i,
  /doesn't apply/i,
  /rule.*?not hold/i,
];

const ORDINARY_PATTERNS = [
  /evidence/i,
  /support/i,
  /justify/i,
  /prove/i,
  /demonstrate/i,
];

/**
 * Classify burden of proof based on CQ text
 */
function classifyBurden(text: string): BurdenOfProof {
  // Check challenger patterns first (they're more specific)
  for (const pattern of CHALLENGER_PATTERNS) {
    if (pattern.test(text)) {
      return "CHALLENGER";
    }
  }
  
  // Default to proponent for most CQs
  for (const pattern of PROPONENT_PATTERNS) {
    if (pattern.test(text)) {
      return "PROPONENT";
    }
  }
  
  // Default to proponent (most CQs shift burden to argument author)
  return "PROPONENT";
}

/**
 * Determine if evidence is required
 */
function requiresEvidence(text: string): boolean {
  return EVIDENCE_REQUIRED_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Classify premise type based on CQ text
 */
function classifyPremiseType(text: string): PremiseType | null {
  // Check for exception patterns (most specific)
  for (const pattern of EXCEPTION_PATTERNS) {
    if (pattern.test(text)) {
      return "EXCEPTION";
    }
  }
  
  // Check for assumption patterns
  for (const pattern of ASSUMPTION_PATTERNS) {
    if (pattern.test(text)) {
      return "ASSUMPTION";
    }
  }
  
  // Check for ordinary premise patterns
  for (const pattern of ORDINARY_PATTERNS) {
    if (pattern.test(text)) {
      return "ORDINARY";
    }
  }
  
  // Don't set a premise type if we can't determine it
  return null;
}

/**
 * Main seed function
 */
async function seedBurdenDefaults() {
  console.log("🌱 Starting burden of proof seeding...\n");

  // Get all CriticalQuestions that need defaults
  const cqs = await prisma.criticalQuestion.findMany({
    select: {
      id: true,
      text: true,
      cqKey: true,
      schemeId: true,
      // @ts-expect-error - Phase 0.1 fields
      burdenOfProof: true,
      // @ts-expect-error - Phase 0.1 fields
      requiresEvidence: true,
      // @ts-expect-error - Phase 0.1 fields
      premiseType: true,
    },
  });

  console.log(`Found ${cqs.length} critical questions to analyze\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const cq of cqs as any[]) {
    try {
      // Analyze the CQ text
      const burden = classifyBurden(cq.text);
      const evidence = requiresEvidence(cq.text);
      const premiseType = classifyPremiseType(cq.text);

      // Log what we're doing
      console.log(`\n📝 ${cq.cqKey || cq.id}`);
      console.log(`   Text: "${cq.text.substring(0, 80)}${cq.text.length > 80 ? "..." : ""}"`);
      console.log(`   Burden: ${burden}`);
      console.log(`   Evidence Required: ${evidence}`);
      console.log(`   Premise Type: ${premiseType || "none"}`);

      // Update the record
      // @ts-expect-error - Phase 0.1 fields
      await prisma.criticalQuestion.update({
        where: { id: cq.id },
        data: {
          // @ts-expect-error - Phase 0.1 fields
          burdenOfProof: burden,
          // @ts-expect-error - Phase 0.1 fields
          requiresEvidence: evidence,
          // @ts-expect-error - Phase 0.1 fields
          premiseType: premiseType,
        },
      });

      updated++;
    } catch (error) {
      console.error(`❌ Error updating CQ ${cq.id}:`, error);
      errors++;
    }
  }

  console.log("\n\n✅ Seeding complete!");
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
}

// Run the script
seedBurdenDefaults()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
