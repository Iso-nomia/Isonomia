import { prisma } from "../lib/prisma-cli";

async function cleanup() {
  const designId = "cm7qg6np20000lbq0l41tlkfc";
  
  // Delete strategies and plays
  const strategies = await prisma.ludicStrategy.findMany({
    where: { designId },
    select: { id: true }
  });
  
  console.log("Found strategies:", strategies.length);
  
  for (const strat of strategies) {
    await prisma.ludicPlay.deleteMany({ where: { strategyId: strat.id } });
  }
  await prisma.ludicStrategy.deleteMany({ where: { designId } });
  console.log("Deleted strategies");
  
  // Delete disputes
  const disputes = await prisma.ludicDispute.findMany({
    where: { posDesignId: designId },
    select: { id: true }
  });
  
  console.log("Found disputes:", disputes.length);
  
  for (const disp of disputes) {
    await prisma.ludicDisputeActionPair.deleteMany({ where: { disputeId: disp.id } });
  }
  const deleted = await prisma.ludicDispute.deleteMany({ where: { posDesignId: designId } });
  
  console.log("Cleanup complete - disputes deleted:", deleted.count);
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
