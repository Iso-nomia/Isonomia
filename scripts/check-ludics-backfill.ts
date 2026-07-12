import { prisma } from "@/lib/prismaclient";

async function checkLudicsData() {
  try {
    // Check for existing LudicAct rows
    const actCount = await prisma.ludicAct.count();
    console.log(`\n📊 Existing Ludics Data:`);
    console.log(`  LudicAct rows: ${actCount}`);

    if (actCount === 0) {
      console.log(`\n✅ No backfill needed - no existing Ludics data`);
      return;
    }

    // Check for AifNode rows linked to Ludics
    const aifNodeCount = await (prisma as any).aifNode.count({
      where: { ludicActId: { not: null } },
    });
    console.log(`  AifNode rows linked to Ludics: ${aifNodeCount}`);

    // Calculate backfill need
    const needsBackfill = actCount - aifNodeCount;
    console.log(`\n${needsBackfill > 0 ? "⚠️" : "✅"} Backfill Status:`);
    
    if (needsBackfill > 0) {
      console.log(`  ${needsBackfill} LudicAct rows need syncing to AifNode`);
      console.log(`\n💡 Recommendation: Run backfill script to sync existing data`);
    } else {
      console.log(`  All LudicAct rows already synced!`);
    }

    // Check for deliberations with Ludics data
    const delibsWithLudics = await prisma.ludicDesign.groupBy({
      by: ["deliberationId"],
      _count: { id: true },
    });
    
    console.log(`\n📍 Deliberations with Ludics data: ${delibsWithLudics.length}`);
    if (delibsWithLudics.length > 0) {
      console.log(`  Sample deliberation IDs:`);
      delibsWithLudics.slice(0, 5).forEach((d: any) => {
        console.log(`    - ${d.deliberationId} (${d._count.id} designs)`);
      });
    }

  } catch (error) {
    console.error("Error checking Ludics data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLudicsData();
