import { PrismaClient } from '@prisma/client';
import { mintClaimMoid } from '@/lib/ids/mintMoid'; // if you already have this helper
import { LogEntryType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slug = `demo-brief-${Date.now()}`;

  // 1. Create a dummy Brief
  const brief = await prisma.brief.create({
    data: {
      roomId: 'room-123',
      title: 'Demo Brief',
      slug,
      createdById: 'user-abc',
      visibility: 'public',
      status: 'draft',
    },
  });
  console.log('Created Brief:', brief);
  const delib = await prisma.deliberation.upsert({
    where: { id: "demo-delib-1" },
    update: {},
    create: {
      id: "demo-delib-1",
      hostType: "room_thread",
      hostId: "thread-123",
      roomId: "room-123",
      createdById: "user-abc",
      rule: "utilitarian",
    },
  });
  
  const moid = mintClaimMoid("All citizens should have equal voting rights" + Date.now());
  
  console.log('Created demo deliberation:', delib.id);
  
  const c1 = await prisma.claim.upsert({
    where: { moid: mintClaimMoid("All citizens should have equal voting rights") },
    update: {}, // no change if already exists
    create: {
      text: "All citizens should have equal voting rights",
      createdById: "user-abc",
      moid: mintClaimMoid("All citizens should have equal voting rights"),
      deliberation: { connect: { id: delib.id } },
      urns: {
        create: { entityType: "claim", urn: "urn:mesh:clm:demo1" },
      },
    },
  });
  
  const c2 = await prisma.claim.upsert({
    where: { moid: mintClaimMoid("Voting should be restricted to informed citizens") },
    update: {},
    create: {
      text: "Voting should be restricted to informed citizens",
      createdById: "user-abc",
      moid: mintClaimMoid("Voting should be restricted to informed citizens"),
      deliberation: { connect: { id: delib.id } },
      urns: {
        create: { entityType: "claim", urn: "urn:mesh:clm:demo2" },
      },
    },
  });
  
  console.log('Created demo claims:', c1.id, c2.id);

  // Add a support edge between them
  await prisma.claimEdge.create({
    data: { fromClaimId: c1.id, toClaimId: c2.id, type: 'rebuts' },
  });

  // Add a citation to c1
  await prisma.claimCitation.create({
    data: {
      claimId: c1.id,
      uri: 'https://example.com/source1',
      excerptHash: 'abc123',
      note: 'Primary dataset',
    },
  });

  // 3. Create Version 1
  const version1 = await prisma.briefVersion.create({
    data: {
      briefId: brief.id,
      number: 1,
      sectionsJson: {
        overview: 'This is version 1 of the demo brief. It introduces the topic.',
        positions: 'Two main positions from the discussion.',
        evidence: 'Cites some sources (see links).',
      },
      citations: [
        { uri: 'https://example.com/source1', note: 'Primary dataset' } as any,
      ],
      createdById: 'user-abc',
    },
  });

  // Link v1 to a card + claim
  await prisma.briefLink.createMany({
    data: [
      { briefVersionId: version1.id, sourceType: 'card', sourceId: 'demo-card-1' },
      { briefVersionId: version1.id, sourceType: 'claim', sourceId: c1.id },
    ],
  });
  console.log('Added Version 1');

  // 4. Create Version 2
  const version2 = await prisma.briefVersion.create({
    data: {
      briefId: brief.id,
      number: 2,
      sectionsJson: {
        overview: 'Version 2 refines the arguments and clarifies open questions.',
        positions: 'Adds a third position raised later.',
        evidence: 'Expanded evidence base with new studies.',
        openQuestions: 'What trade-offs remain unresolved?',
        decision: 'Consensus leaning toward Position B with conditions.',
      },
      citations: [
        { uri: 'https://example.com/source2', note: 'Secondary report' } as any,
      ],
      createdById: 'user-abc',
    },
  });

  await prisma.briefLink.createMany({
    data: [
      { briefVersionId: version2.id, sourceType: 'argument', sourceId: 'demo-arg-1' },
      { briefVersionId: version2.id, sourceType: 'post', sourceId: 'demo-post-42' },
      { briefVersionId: version2.id, sourceType: 'claim', sourceId: c2.id },
    ],
  });
  console.log('Added Version 2 with links');

  // 5. Update current version pointer
  const updatedBrief = await prisma.brief.update({
    where: { id: brief.id },
    data: { currentVersionId: version2.id, status: 'published' },
    include: { currentVersion: true, versions: { include: { links: true } } },
  });
  console.dir(updatedBrief, { depth: null });

  // 6. Seed a governance status + logbook entry for completeness
  await prisma.contentStatus.upsert({
    where: { roomId_targetType_targetId: { roomId: 'room-123', targetType: 'brief', targetId: brief.id } },
    update: { currentStatus: 'WORKSHOP', reason: 'Needs more sources' },
    create: {
      roomId: 'room-123',
      targetType: 'brief',
      targetId: brief.id,
      currentStatus: 'WORKSHOP',
      reason: 'Needs more sources',
    },
  });
  await prisma.roomLogbook.create({
    data: {
      roomId: 'room-123',
      entryType: LogEntryType.STATUS_CHANGE, // ✅ type-safe
      summary: 'Brief moved to WORKSHOP',
      payload: { targetId: brief.id }, // ✅ correct
    },
  });

  console.log('Seed complete with governance + provenance extras!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
