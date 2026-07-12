// scripts/backfillRooms.ts
import { prisma } from '@/lib/prismaclient';
import slugify from 'slugify';

async function main() {
  const delibs = await prisma.deliberation.findMany({
    select: { id: true, agoraRoomId: true },
  });

  let created = 0, linked = 0;

  for (const d of delibs) {
    if (d.agoraRoomId) { linked++; continue; }

    const slug = slugify(d.id.slice(0, 8), { lower: true, strict: true });
    const room = await prisma.agoraRoom.create({
      data: {
        slug: await ensureUniqueSlug(slug),
         title: `Room ${d.id.slice(0, 6)}…`,
        summary: null,
      },
      select: { id: true },
    });

// ---------- DebateSheet substrate ----------
// model DebateSheet {
//   id          String   @id @default(cuid())
//   title       String
//   scope       String?
//   roles       String[] @default([])
//   rulesetJson Json?

//   // NEW (optional link; synthetic sheets keep working without a row)
//   deliberationId String?
//   deliberation   Deliberation? @relation(fields: [deliberationId], references: [id], onDelete: SetNull)

//   nodes      DebateNode[]
//   edges      DebateEdge[]
//   loci       LocusStatus[]
//   acceptance SheetAcceptance?
//   unresolved UnresolvedCQ[]
//   outcomes   Outcome[]

//   createdById String
//   createdAt   DateTime @default(now())
//   updatedAt   DateTime @updatedAt

//   @@index([deliberationId])
// }
    const sheet = await prisma.debateSheet.create({
      data: {
        id: `delib:${d.id}`,
        title: `Delib ${d.id.slice(0, 6)}`,
        roles: ['Proponent', 'Opponent', 'Curator'],
        deliberationId: d.id,
        createdById: 'system', // TODO: better user?
      },
      select: { id: true },
    });

     console.log({ room, sheet });            
    // console.log(`Created room ${room.slug} + sheet ${sheet.id} for deliberation ${d.id}`);

    await prisma.deliberation.update({
      where: { id: d.id },
      data: { agoraRoomId: room.id },
    });

    created++;
  }

  console.log(`Backfill complete: created ${created} rooms; ${linked} already linked.`);
}

async function ensureUniqueSlug(s: string): Promise<string> {
  let slug = s || 'room';
  let i = 1;
  while (true) {
    const exists = await prisma.agoraRoom.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${s}-${++i}`;
  }
}

main().catch(e => { console.error(e); process.exit(1); });
