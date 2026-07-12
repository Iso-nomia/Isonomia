import { prisma } from "@/lib/prismaclient";
async function main() {
  await prisma.$transaction(async (tx) => {
    const dms = await tx.conversation.findMany({
      where: { is_group: false },
      select: { id: true, user1_id: true, user2_id: true },
    });

    for (const dm of dms) {
      if (!dm.user1_id || !dm.user2_id) continue;

      await tx.conversationParticipant.createMany({
        data: [
          { conversation_id: dm.id, user_id: dm.user1_id },
          { conversation_id: dm.id, user_id: dm.user2_id },
        ],
        skipDuplicates: true,
      });
    }
  });

  console.log("Backfill complete");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
