/**
 * Seed script for Phase 0.2: Apply intelligent epistemic mode defaults to existing schemes
 * 
 * This script analyzes existing ArgumentScheme records and sets appropriate
 * epistemicMode values based on scheme names, descriptions, and patterns.
 * 
 * Run with: tsx --env-file=.env scripts/seed-scheme-epistemic-modes.ts
 */

import { prisma } from "@/lib/prismaclient";
import { EpistemicMode } from "@prisma/client";

// Text patterns that indicate hypothetical reasoning
const HYPOTHETICAL_PATTERNS = [
  /hypothetical/i,
  /future/i,
  /will.*happen/i,
  /prediction/i,
  /forecast/i,
  /scenario/i,
  /possible/i,
  /potential/i,
  /would.*result/i,
  /consequences/i,
  /if.*then/i,
  /policy.*outcome/i,
];

// Text patterns that indicate counterfactual reasoning
const COUNTERFACTUAL_PATTERNS = [
  /counterfactual/i,
  /what if/i,
  /had.*happened/i,
  /would have/i,
  /alternative.*history/i,
  /contrary.*fact/i,
  /suppose.*not/i,
  /if.*had/i,
];

// Text patterns that indicate factual reasoning
const FACTUAL_PATTERNS = [
  /factual/i,
  /evidence/i,
  /empirical/i,
  /observation/i,
  /testimony/i,
  /witness/i,
  /actual/i,
  /real.*event/i,
  /historical/i,
  /documented/i,
];

/**
 * Classify epistemic mode based on scheme text
 */
function classifyEpistemicMode(name: string, description: string | null, key: string): EpistemicMode {
  const text = `${name} ${description || ""} ${key}`.toLowerCase();
  
  // Check counterfactual patterns first (most specific)
  for (const pattern of COUNTERFACTUAL_PATTERNS) {
    if (pattern.test(text)) {
      return "COUNTERFACTUAL";
    }
  }
  
  // Check hypothetical patterns
  for (const pattern of HYPOTHETICAL_PATTERNS) {
    if (pattern.test(text)) {
      return "HYPOTHETICAL";
    }
  }
  
  // Check factual patterns
  for (const pattern of FACTUAL_PATTERNS) {
    if (pattern.test(text)) {
      return "FACTUAL";
    }
  }
  
  // Default to FACTUAL (most schemes are about real events/states)
  return "FACTUAL";
}

/**
 * Main seed function
 */
async function seedEpistemicModes() {
  console.log("🌱 Starting epistemic mode seeding...\n");

  // Get all ArgumentSchemes
  const schemes = await prisma.argumentScheme.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      // @ts-expect-error - Phase 0.2 field
      epistemicMode: true,
    },
  });

  console.log(`Found ${schemes.length} argumentation schemes to analyze\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const scheme of schemes as any[]) {
    try {
      // Skip if already has a non-FACTUAL mode (user set it manually)
      if (scheme.epistemicMode && scheme.epistemicMode !== "FACTUAL") {
        console.log(`⏭️  ${scheme.key} - Already has mode: ${scheme.epistemicMode}`);
        skipped++;
        continue;
      }

      // Analyze the scheme
      const mode = classifyEpistemicMode(
        scheme.name || "",
        scheme.description,
        scheme.key
      );

      // Only update if we're changing something
      if (scheme.epistemicMode === mode) {
        skipped++;
        continue;
      }

      // Log what we're doing
      console.log(`\n📝 ${scheme.key}`);
      console.log(`   Name: "${scheme.name}"`);
      if (scheme.description) {
        console.log(`   Description: "${scheme.description.substring(0, 100)}${scheme.description.length > 100 ? "..." : ""}"`);
      }
      console.log(`   Mode: ${mode}`);

      // Update the record
      // @ts-expect-error - Phase 0.2 field
      await prisma.argumentScheme.update({
        where: { id: scheme.id },
        data: {
          // @ts-expect-error - Phase 0.2 field
          epistemicMode: mode,
        },
      });

      updated++;
    } catch (error) {
      console.error(`❌ Error updating scheme ${scheme.id}:`, error);
      errors++;
    }
  }

  console.log("\n\n✅ Seeding complete!");
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);

  // Show distribution
  console.log("\n📊 Epistemic Mode Distribution:");
  // @ts-expect-error - Phase 0.2 field
  const distribution = await prisma.argumentScheme.groupBy({
    // @ts-expect-error - Phase 0.2 field
    by: ["epistemicMode"],
    _count: true,
  });

  distribution.forEach((d: any) => {
    console.log(`   ${d.epistemicMode}: ${d._count} schemes`);
  });
}

// Run the script
seedEpistemicModes()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
