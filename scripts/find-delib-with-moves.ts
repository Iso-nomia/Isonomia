import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const move = await prisma.dialogueMove.findFirst({
    select: { deliberationId: true }
  });
  
  if (!move) {
    console.log("None");
    await prisma.$disconnect();
    return;
  }
  
  const count = await prisma.dialogueMove.count({
    where: { deliberationId: move.deliberationId }
  });
  
  console.log(`${move.deliberationId} (${count} moves)`);
  await prisma.$disconnect();
}

main();
