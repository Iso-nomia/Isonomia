// ts-node runnable script
import { prisma } from "@/lib/prisma-cli"; // you already use this for scripts
import { computeDialogueMoveSignature } from "@/lib/dialogue/signature";

async function main() {
  const batchSize = 200;
  let cursor: string | null = null;
  let updated = 0;

  while (true) {
    const moves = await prisma.dialogueMove.findMany({
      where: { signature: null },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (moves.length === 0) break;

    for (const m of moves) {
      const sig = computeDialogueMoveSignature({
        deliberationId: m.deliberationId,
        targetType: m.targetType,
        targetId: m.targetId,
        kind: m.kind,
        actorId: m.actorId,
        createdAt: m.createdAt,
        payload: m.payload ?? undefined,
      });

      await prisma.dialogueMove.update({
        where: { id: m.id },
        data: { signature: sig },
      });
      updated++;
    }

    cursor = moves[moves.length - 1].id;
    // Optional: log progress
    // console.log(`Updated so far: ${updated}`);
  }

  // Sanity: check for any remaining nulls
  const remaining = await prisma.dialogueMove.count({ where: { signature: null } });
  console.log(`Done. Updated ${updated}. Remaining null signatures: ${remaining}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
