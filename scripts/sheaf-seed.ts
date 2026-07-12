import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Users (minimal required fields)
  const alice = await prisma.user.upsert({
    where: { auth_id: 'seed-alice' },
    update: {},
    create: { auth_id: 'seed-alice', username: 'alice', name: 'Alice' },
  });
  const bob = await prisma.user.upsert({
    where: { auth_id: 'seed-bob' },
    update: {},
    create: { auth_id: 'seed-bob', username: 'bob', name: 'Bob' },
  });
  const cara = await prisma.user.upsert({
    where: { auth_id: 'seed-cara' },
    update: {},
    create: { auth_id: 'seed-cara', username: 'cara', name: 'Cara' },
  });

  // Conversation (Alice ↔ Bob)
  const conv = await prisma.conversation.upsert({
    where: { user1_id_user2_id: { user1_id: alice.id, user2_id: bob.id } },
    update: {},
    create: { user1_id: alice.id, user2_id: bob.id, title: 'Seed DM' },
  });

  // Audience list: core_team (Alice + Bob)
  const coreTeam = await prisma.sheafAudienceList.upsert({
    where: { id: 'core_team' }, // human-readable id
    update: { memberIds: [alice.id.toString(), bob.id.toString()], version: { increment: 1 } },
    create: {
      id: 'core_team',
      ownerId: alice.id,
      name: 'Core team',
      memberIds: [alice.id.toString(), bob.id.toString()],
      version: 1,
    },
  });

  // Message from Alice
  const msg = await prisma.message.create({
    data: {
      conversation_id: conv.id,
      sender_id: alice.id,
      text: null,
    },
  });

  // Facet A: EVERYONE
  const fPub = await prisma.sheafFacet.create({
    data: {
      messageId: msg.id,
      audienceKind: 'EVERYONE',
      audienceMode: 'DYNAMIC',
      sharePolicy: 'ALLOW',
      body: { text: 'Public hello 👋' },
      priorityRank: 400,
    },
  });

  // Facet B: LIST SNAPSHOT (core_team), REDACT
  const fCore = await prisma.sheafFacet.create({
    data: {
      messageId: msg.id,
      audienceKind: 'LIST',
      audienceMode: 'SNAPSHOT',
      audienceListId: coreTeam.id,
      snapshotMemberIds: coreTeam.memberIds,
      listVersionAtSend: coreTeam.version,
      sharePolicy: 'REDACT',
      body: { text: 'Core-only context 🔒' },
      priorityRank: 200,
    },
  });

  // Default facet → core
  await prisma.sheafMessageMeta.upsert({
    where: { messageId: msg.id },
    update: { defaultFacetId: fCore.id },
    create: { messageId: msg.id, defaultFacetId: fCore.id },
  });

  console.log('Seeded users:', { alice: alice.id.toString(), bob: bob.id.toString(), cara: cara.id.toString() });
  console.log('Conversation:', conv.id.toString());
  console.log('Message:', msg.id.toString(), 'facets:', fPub.id.toString(), fCore.id.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
