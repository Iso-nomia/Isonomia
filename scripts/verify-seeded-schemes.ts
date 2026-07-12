/**
 * Verify seeded schemes
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Verifying seeded schemes...\n");

  const schemes = await prisma.argumentScheme.findMany({
    orderBy: { key: "asc" },
  } as any);

  console.log(`📊 Total schemes in database: ${schemes.length}\n`);

  for (const schemeRaw of schemes) {
    const scheme = schemeRaw as any;
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📝 ${scheme.name} (${scheme.key})`);
    console.log(`${"=".repeat(80)}`);
    console.log(`Summary: ${scheme.summary}`);
    
    if (scheme.description) {
      console.log(`Description: ${scheme.description.substring(0, 100)}...`);
    }

    console.log(`\n🏷️  Taxonomy:`);
    console.log(`   • Purpose: ${scheme.purpose || "not set"}`);
    console.log(`   • Source: ${scheme.source || "not set"}`);
    console.log(`   • Material Relation: ${scheme.materialRelation || "not set"}`);
    console.log(`   • Reasoning Type: ${scheme.reasoningType || "not set"}`);
    console.log(`   • Rule Form: ${scheme.ruleForm || "not set"}`);
    console.log(`   • Conclusion Type: ${scheme.conclusionType || "not set"}`);

    console.log(`\n🌳 Hierarchy:`);
    console.log(`   • Cluster Tag: ${scheme.clusterTag || "none"}`);
    console.log(`   • Inherit CQs: ${scheme.inheritCQs}`);
    if (scheme.parentSchemeId) {
      console.log(`   • Parent ID: ${scheme.parentSchemeId}`);
    } else {
      console.log(`   • Parent: none (root scheme)`);
    }

    // Parse premises and conclusion
    const premises = scheme.premises;
    const conclusion = scheme.conclusion;

    if (premises && Array.isArray(premises)) {
      console.log(`\n📐 Formal Structure:`);
      console.log(`   Premises (${premises.length}):`);
      premises.forEach((p: any) => {
        console.log(`      ${p.id} (${p.type}): ${p.text.substring(0, 60)}...`);
        if (p.variables && p.variables.length > 0) {
          console.log(`         Variables: ${p.variables.join(", ")}`);
        }
      });
    }

    if (conclusion) {
      console.log(`   Conclusion:`);
      console.log(`      ${conclusion.text.substring(0, 60)}...`);
      if (conclusion.variables && conclusion.variables.length > 0) {
        console.log(`      Variables: ${conclusion.variables.join(", ")}`);
      }
    }

    // Parse CQs
    const cqs = scheme.cq as any;
    if (cqs && Array.isArray(cqs)) {
      console.log(`\n❓ Critical Questions (${cqs.length}):`);
      cqs.forEach((cq: any, idx: number) => {
        console.log(`   ${idx + 1}. ${cq.cqKey}`);
        console.log(`      ${cq.text}`);
        console.log(`      Type: ${cq.attackType} | Target: ${cq.targetScope}`);
      });
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("✨ Verification complete!");
  console.log(`\n🎯 Next step:`);
  console.log(`   1. Visit http://localhost:3000/admin/schemes to view schemes in UI`);
  console.log(`   2. Test hierarchical scheme creation by creating a new child of one of these schemes`);
  console.log(`   3. Verify that parent's CQs are inherited when "inheritCQs" is true`);
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
