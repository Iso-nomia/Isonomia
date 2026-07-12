/* tslint:disable no-console */
import { PrismaClient } from '@prisma/client';
import { TargetType } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const deliberationId = process.argv[2];
  const argumentId = process.argv[3];
  if (!deliberationId || !argumentId) {
    console.log('Usage: ts-node seed.cqstatus-demo.ts <deliberationId> <argumentId>');
    process.exit(1);
  }

  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    include: { scheme: { include: { cqs: true } } }
  });
  if (!arg?.scheme) throw new Error('Argument has no scheme');

  for (const cq of arg.scheme.cqs) {
    await prisma.cQStatus.upsert({
      where: {
        targetType_targetId_schemeKey_cqKey: {
          targetType: 'argument' as TargetType, targetId: argumentId, schemeKey: arg.scheme.key, cqKey: cq.cqKey ?? ""
        }
      },
      update: { status: 'open', satisfied: false },
      create: {
        targetType: 'argument' as TargetType,
        targetId: argumentId,
        schemeKey: arg.scheme.key,
        cqKey: cq.cqKey ?? "",
        status: 'open',
        satisfied: false,
        createdById: 'seed'
      }
    });
  }

  console.log(`CQStatus opened for ${arg.scheme.cqs.length} CQs on argument ${argumentId}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
