import { prisma } from '../lib/prismaclient';

async function main() {
  const argumentId = 'cmhl2n8bj00fgg1a54b83enso';
  
  const arg = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      id: true,
      deliberationId: true,
      authorId: true,
      conclusionClaimId: true,
      schemeId: true,
    }
  });
  
  if (!arg) {
    console.error('Argument not found');
    process.exit(1);
  }
  
  console.log('Found argument:', arg.id);
  
  // Check if move already exists
  const existing = await prisma.dialogueMove.findFirst({
    where: {
      targetType: 'argument',
      targetId: arg.id,
    }
  });
  
  if (existing) {
    console.log('Dialogue move already exists:', existing.id);
  } else {
    // Create dialogue move
    const move = await prisma.dialogueMove.create({
      data: {
        deliberationId: arg.deliberationId,
        targetType: 'argument',
        targetId: arg.id,
        kind: 'ASSERT',
        actorId: arg.authorId,
        signature: `assert-arg-${arg.id}`, // Unique signature
        payload: {
          argumentId: arg.id,
          conclusionClaimId: arg.conclusionClaimId,
          schemeId: arg.schemeId,
        },
      }
    });
    
    console.log('✅ Created dialogue move:', move.id);
  }
  
  console.log('\nNext: Trigger recompile in the UI or via:');
  console.log('POST /api/ludics/compile');
  console.log('Body: { "deliberationId": "ludics-forest-demo", "scopingStrategy": "topic", "forceRecompile": true }');
  
  await prisma.$disconnect();
}

main().catch(console.error);
