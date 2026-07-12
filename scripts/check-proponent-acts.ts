import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find a Proponent design from topic scoping
  const design = await prisma.ludicDesign.findFirst({
    where: {
      deliberationId: "ludics-forest-demo",
      participantId: "Proponent",
      scopeType: "topic"
    },
    orderBy: { id: "desc" },
    select: {
      id: true,
      participantId: true,
      scopeMetadata: true,
      acts: {
        take: 3,
        select: {
          id: true,
          kind: true,
          polarity: true,
          expression: true,
          metaJson: true,
          extJson: true,
        }
      }
    }
  });

  if (!design) {
    console.log("No Proponent design found");
    return;
  }

  const metadata = design.scopeMetadata as any;
  console.log("Design ID:", design.id);
  console.log("Scope:", metadata?.label || "unknown");
  console.log("Acts:", design.acts.length);
  console.log();

  design.acts.forEach((act, i) => {
    console.log(`Act ${i + 1}:`);
    console.log("  Kind:", act.kind);
    console.log("  Polarity:", act.polarity);
    console.log("  Expression:", act.expression);
    console.log("  metaJson:", JSON.stringify(act.metaJson));
    console.log("  extJson:", JSON.stringify(act.extJson));
    console.log();
  });

  // Check if we can find the move
  const meta = (design.acts[0]?.metaJson || design.acts[0]?.extJson) as any;
  if (meta?.moveId) {
    console.log("Checking move:", meta.moveId);
    const move = await prisma.dialogueMove.findUnique({
      where: { id: meta.moveId },
      select: {
        id: true,
        kind: true,
        targetType: true,
        targetId: true
      }
    });
    console.log("Move found:", move);
    
    if (move?.targetType === "argument" && move.targetId) {
      console.log("\nChecking argument:", move.targetId);
      const arg = await prisma.argument.findUnique({
        where: { id: move.targetId },
        include: {
          scheme: {
            select: { key: true, name: true }
          },
          conclusion: {
            select: { text: true }
          }
        }
      });
      console.log("Argument found:", {
        id: arg?.id,
        scheme: arg?.scheme?.name,
        conclusion: arg?.conclusion?.text?.slice(0, 50)
      });
    }
  } else {
    console.log("❌ No moveId in act metadata!");
  }
}

main().finally(() => prisma.$disconnect());
