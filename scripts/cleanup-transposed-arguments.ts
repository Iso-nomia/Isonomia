// scripts/cleanup-transposed-arguments.ts
// Run with: npx tsx scripts/cleanup-transposed-arguments.ts ludics-forest-demo [--execute]

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deliberationId = process.argv[2];
  const execute = process.argv.includes("--execute");

  if (!deliberationId) {
    console.error("Usage: npx tsx scripts/cleanup-transposed-arguments.ts <deliberationId> [--execute]");
    console.error("  --execute: Actually delete (default is dry run)");
    process.exit(1);
  }

  console.log(`\n🔍 Analyzing transposed arguments for: ${deliberationId}`);
  console.log(`Mode: ${execute ? "🔴 EXECUTE (will delete)" : "🟢 DRY RUN (preview only)"}\n`);

  // Fetch all transposed arguments
  const transposedArgs = await prisma.argument.findMany({
    where: {
      deliberationId,
      text: { contains: "Transposed from argument" },
    },
    include: {
      conclusion: true,
      premises: {
        include: { claim: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${transposedArgs.length} transposed arguments\n`);

  if (transposedArgs.length === 0) {
    console.log("✅ No transposed arguments to clean up");
    return;
  }

  // Group by signature (sorted premises + conclusion)
  const bySignature = new Map<string, typeof transposedArgs>();

  for (const arg of transposedArgs) {
    const premiseTexts = arg.premises
      .map((p) => p.claim?.text || "")
      .filter(Boolean)
      .sort();
    const conclusionText = arg.conclusion?.text || "";
    const signature = `${premiseTexts.join(" + ")} → ${conclusionText}`;

    if (!bySignature.has(signature)) {
      bySignature.set(signature, []);
    }
    bySignature.get(signature)!.push(arg);
  }

  // Find duplicates
  const toDelete: string[] = [];
  let uniqueCount = 0;

  console.log("📊 Signature Analysis:\n");
  for (const [signature, args] of bySignature) {
    uniqueCount++;
    if (args.length > 1) {
      const shortSig = signature.length > 80 ? signature.slice(0, 80) + "..." : signature;
      console.log(`  [${args.length}x] ${shortSig}`);
      // Keep first (oldest), mark rest for deletion
      for (let i = 1; i < args.length; i++) {
        toDelete.push(args[i].id);
      }
    }
  }

  console.log(`\n📈 Summary:`);
  console.log(`  Total transposed: ${transposedArgs.length}`);
  console.log(`  Unique signatures: ${uniqueCount}`);
  console.log(`  Duplicates to remove: ${toDelete.length}`);
  console.log(`  Will keep: ${transposedArgs.length - toDelete.length}`);

  if (toDelete.length === 0) {
    console.log("\n✅ No duplicates found!");
    return;
  }

  if (!execute) {
    console.log("\n⚠️  DRY RUN - No changes made");
    console.log("   Run with --execute to delete duplicates\n");
    return;
  }

  // Actually delete
  console.log("\n🗑️  Deleting duplicates...");

  // Delete related records first
  const schemeResult = await prisma.argumentSchemeInstance.deleteMany({
    where: { argumentId: { in: toDelete } },
  });
  console.log(`  Deleted ${schemeResult.count} ArgumentSchemeInstance records`);

  const premiseResult = await prisma.argumentPremise.deleteMany({
    where: { argumentId: { in: toDelete } },
  });
  console.log(`  Deleted ${premiseResult.count} ArgumentPremise records`);

  const argResult = await prisma.argument.deleteMany({
    where: { id: { in: toDelete } },
  });
  console.log(`  Deleted ${argResult.count} Argument records`);

  console.log(`\n✅ Cleanup complete! Removed ${argResult.count} duplicate transposed arguments\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
