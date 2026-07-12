import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const argId = "cmhl2n8bj00fgg1a54b83enso";
  
  const arg = await prisma.argument.findUnique({
    where: { id: argId },
    select: { id: true, conclusionClaimId: true, text: true }
  });
  
  if (!arg) {
    console.log("Argument not found");
    return;
  }
  
  console.log("Argument:", argId.slice(-8));
  console.log("Conclusion claim:", arg.conclusionClaimId?.slice(-8));
  
  const moves = await prisma.dialogueMove.findMany({
    where: {
      OR: [
        { targetId: argId },
        { targetId: arg.conclusionClaimId! }
      ]
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, kind: true, targetType: true, targetId: true }
  });
  
  console.log(`\nMoves on argument OR its conclusion (${moves.length} total):`);
  moves.forEach(m => {
    const target = m.targetId === argId ? "argument" : "conclusion";
    console.log(`  ${m.kind} on ${target}`);
  });
  
  // Now check the designs
  const designs = await prisma.ludicDesign.findMany({
    where: { 
      deliberationId: "ludics-forest-demo",
      scopeType: "topic"
    },
    orderBy: { id: "desc" },
    select: {
      id: true,
      participantId: true,
      scopeMetadata: true,
      _count: { select: { acts: true } }
    }
  });
  
  console.log(`\n\nTopic-scoped designs:`);
  designs.forEach(d => {
    const metadata = d.scopeMetadata as any;
    const label = metadata?.label || "unknown";
    const moveCount = metadata?.moveCount || 0;
    console.log(`  ${label} (${d.participantId}): ${d._count.acts} acts, ${moveCount} moves`);
  });
}

main().finally(() => prisma.$disconnect());
