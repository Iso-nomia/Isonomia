// scripts/seed-identification-conditions.ts
/**
 * Phase 0.5: Seed Identification Conditions
 * 
 * Adds Walton's identification conditions to existing argumentation schemes
 * Based on "Argumentation Schemes" by Walton, Reed & Macagno (2008)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const IDENTIFICATION_CONDITIONS: Record<
  string,
  { conditions: string[]; whenToUse: string }
> = {
  // Expert Opinion / Authority schemes
  "expert-opinion": {
    conditions: [
      "source has expertise in domain",
      "claim is within source's field",
      "source is credible and unbiased",
      "experts in field generally agree",
    ],
    whenToUse:
      "Use when arguing based on expert testimony or authority credentials. Applies when you have a qualified expert making a claim within their domain of expertise.",
  },
  "position-to-know": {
    conditions: [
      "source was in position to observe",
      "source has direct knowledge",
      "source is reliable witness",
      "no reason to doubt testimony",
    ],
    whenToUse:
      "Use when arguing from eyewitness testimony or direct observation. Applies when someone was present to observe events firsthand.",
  },

  // Causal schemes
  "cause-to-effect": {
    conditions: [
      "causal relationship exists",
      "cause produces effect",
      "temporal ordering (cause before effect)",
      "mechanism linking cause to effect",
    ],
    whenToUse:
      "Use when arguing that one event causes another. Applies when you want to show that A leads to B through a causal mechanism.",
  },
  "correlation-to-cause": {
    conditions: [
      "correlation observed between variables",
      "statistical relationship exists",
      "alternative explanations ruled out",
      "plausible causal mechanism",
    ],
    whenToUse:
      "Use when inferring causation from correlation. Applies when you observe two things happening together and want to argue one causes the other.",
  },

  // Analogical schemes
  "analogy": {
    conditions: [
      "similarity between cases",
      "relevant features match",
      "differences not significant",
      "principle transfers across cases",
    ],
    whenToUse:
      "Use when arguing from a similar case or precedent. Applies when you want to say 'this situation is like that one, so the same conclusion follows.'",
  },
  "practical-reasoning": {
    conditions: [
      "agent has goal",
      "action leads to goal",
      "no better alternative exists",
      "action is feasible",
    ],
    whenToUse:
      "Use when arguing for a course of action. Applies when recommending what someone should do to achieve their goals.",
  },

  // Consequentialist schemes
  "consequences": {
    conditions: [
      "action has predictable outcome",
      "outcome is desirable/undesirable",
      "consequence is significant",
      "causal link established",
    ],
    whenToUse:
      "Use when arguing based on predicted outcomes. Applies when you want to support or oppose an action based on what it will lead to.",
  },
  "fear-appeal": {
    conditions: [
      "negative consequence predicted",
      "consequence is serious",
      "action can prevent consequence",
      "urgency exists",
    ],
    whenToUse:
      "Use when warning about dangers or risks. Applies when you want to discourage action by highlighting negative consequences.",
  },

  // Sign and Symptom schemes
  "sign": {
    conditions: [
      "observable indicator present",
      "indicator reliably signals state",
      "relationship is established",
      "no alternative explanation",
    ],
    whenToUse:
      "Use when arguing from symptoms or indicators. Applies when you observe signs that point to an underlying condition or state.",
  },
  "abductive": {
    conditions: [
      "phenomenon needs explanation",
      "hypothesis explains phenomenon",
      "best available explanation",
      "alternative explanations weaker",
    ],
    whenToUse:
      "Use when inferring the best explanation. Applies when you observe something and want to argue for the most likely cause or reason.",
  },

  // Classification schemes
  "verbal-classification": {
    conditions: [
      "entity has defining properties",
      "properties match category",
      "classification scheme is clear",
      "borderline cases resolved",
    ],
    whenToUse:
      "Use when arguing something belongs to a category. Applies when you want to classify or categorize an entity based on its properties.",
  },
  "definition-to-verbal": {
    conditions: [
      "term has established definition",
      "definition is accepted",
      "case fits definition",
      "definition applies to context",
    ],
    whenToUse:
      "Use when applying a definition. Applies when you want to determine if something meets the criteria specified in a definition.",
  },

  // Value-based schemes
  "values": {
    conditions: [
      "value principle invoked",
      "value is relevant to decision",
      "value outweighs competing values",
      "application is appropriate",
    ],
    whenToUse:
      "Use when arguing from moral or ethical principles. Applies when you want to support a position based on what is good, right, or valuable.",
  },
  "commitment": {
    conditions: [
      "agent previously committed",
      "commitment is relevant",
      "commitment still applies",
      "consistency matters",
    ],
    whenToUse:
      "Use when holding someone to their prior statements. Applies when you want to argue someone should act consistently with what they said before.",
  },

  // Popular opinion schemes
  "popular-opinion": {
    conditions: [
      "majority holds belief",
      "opinion is relevant",
      "crowd has knowledge/interest",
      "bandwagon effect appropriate",
    ],
    whenToUse:
      "Use when arguing from common belief or practice. Applies when you want to cite what most people think or do as support.",
  },
  "popular-practice": {
    conditions: [
      "practice is widespread",
      "practice is established",
      "practice has reasons",
      "tradition is relevant",
    ],
    whenToUse:
      "Use when citing established practices or traditions. Applies when you want to argue that something should be done because it's commonly done.",
  },

  // Negative schemes
  "ad-hominem-circumstantial": {
    conditions: [
      "inconsistency between words and actions",
      "bias due to circumstances",
      "credibility undermined",
      "inconsistency is relevant",
    ],
    whenToUse:
      "Use when pointing out inconsistency or bias. Applies when someone's circumstances make their argument suspect (but be careful - this can be fallacious).",
  },
  "slippery-slope": {
    conditions: [
      "chain of consequences predicted",
      "each step leads to next",
      "final outcome is undesirable",
      "chain is plausible",
    ],
    whenToUse:
      "Use when arguing an action starts a dangerous chain of events. Applies when you want to show that one thing will inevitably lead to worse things.",
  },
};

async function main() {
  console.log("🌱 Seeding identification conditions...");

  let updated = 0;
  let notFound = 0;

  for (const [schemeKey, data] of Object.entries(IDENTIFICATION_CONDITIONS)) {
    try {
      // Find scheme by key (case-insensitive)
      const scheme = await prisma.argumentScheme.findFirst({
        where: {
          OR: [
            { key: schemeKey },
            { key: schemeKey.toUpperCase() },
            { key: schemeKey.toLowerCase() },
            { key: schemeKey.replace(/-/g, "_") },
            { key: schemeKey.replace(/-/g, "_").toUpperCase() },
          ],
        },
      });

      if (!scheme) {
        console.log(`⚠️  Scheme not found: ${schemeKey}`);
        notFound++;
        continue;
      }

      // Update with identification conditions
      await prisma.argumentScheme.update({
        where: { id: scheme.id },
        data: {
          identificationConditions: data.conditions,
          whenToUse: data.whenToUse,
        },
      });

      console.log(`✅ Updated: ${scheme.name} (${schemeKey})`);
      updated++;
    } catch (error) {
      console.error(`❌ Error updating ${schemeKey}:`, error);
    }
  }

  console.log("\n📊 Summary:");
  console.log(`   ✅ Updated: ${updated} schemes`);
  console.log(`   ⚠️  Not found: ${notFound} schemes`);
  console.log(`   📝 Total definitions: ${Object.keys(IDENTIFICATION_CONDITIONS).length}`);
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
