import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CHILD_TABLES = [
  "claim", "argument", "dialogueMove", "deliberationCard", "issue",
  "claimEdge", "argumentEdge", "argumentApproval", "viewpointSelection",
  "cluster", "theoryWork", "knowledgeEdge", "deliberationRole", "deliberationCall",
] as const;

async function main() {
  // 1) find dup groups
  const dups = await prisma.$queryRaw<Array<{ hosttype: string; hostid: string; ids: string[] }>>`
    SELECT "hostType" as hosttype, "hostId" as hostid, ARRAY_AGG(id ORDER BY "createdAt") AS ids
    FROM "Deliberation"
    GROUP BY "hostType", "hostId"
    HAVING COUNT(*) > 1
  `;

  for (const g of dups) {
    const [keep, ...trash] = g.ids;
    console.log(`Dedup ${g.hosttype}:${g.hostid} keep=${keep} move=${trash.join(",")}`);

    // 2) re-point children
    for (const t of CHILD_TABLES) {
      try {
        // All these models use deliberationId as FK in your codebase
        // If a model name differs in your schema, this block will throw; that's fine—continue.
        // @ts-ignore
        const res = await prisma[t].updateMany({
          where: { deliberationId: { in: trash } },
          data: { deliberationId: keep },
        });
        if ((res as any).count) console.log(`  ${t}: moved ${(res as any).count}`);
      } catch (e) {
        console.log(`  skip ${t}: ${(e as Error).message}`);
      }
    }

    // 3) delete the duplicates
    await prisma.deliberation.deleteMany({ where: { id: { in: trash } } });
  }
}

main().then(() => prisma.$disconnect());
