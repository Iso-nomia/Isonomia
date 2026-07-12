import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/sheets/by-room?room=<deliberationId>
 * Returns curated DebateSheets that contain nodes bridging to arguments/claims from this deliberation.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const deliberationId = url.searchParams.get('room') || '';
  if (!deliberationId) return NextResponse.json({ items: [] });



// model DebateNode {
//   id      String      @id @default(cuid())
//   sheetId String
//   sheet   DebateSheet @relation(fields: [sheetId], references: [id], onDelete: Cascade)

//   title   String?
//   summary String?

//   // link to internal diagram (two-level expand/collapse)
//   diagramId String?          @unique
//   diagram   ArgumentDiagram? @relation(fields: [diagramId], references: [id])

//   // optional bridges to your existing Argument/Claim
//   argumentId String?
//   claimId    String?

//   authorsJson Json?
//   createdAt   DateTime @default(now())
// }


// model Claim {
//   id          String             @id @default(cuid())
//   text        String
//   createdById String
//   moid        String             @unique
//   createdAt   DateTime           @default(now())
//   cards       DeliberationCard[]
//   warrant     ClaimWarrant? // 👈 back-relation

//   deliberationId String?
//   deliberation   Deliberation? @relation(fields: [deliberationId], references: [id], onDelete: Cascade)

//   arguments Argument[] @relation("ArgumentClaim")

//   edgesFrom ClaimEdge[]     @relation("fromClaim")
//   edgesTo   ClaimEdge[]     @relation("toClaim")
//   citations ClaimCitation[]

//   urns        Urn[]        @relation("ClaimUrns")
//   ClaimLabel  ClaimLabel?
//   claimValues ClaimValue[] // <— opposite side for ClaimValue.claim

//   @@index([deliberationId, id], name: "claim_delib_id") // NEW
//   @@index([deliberationId, createdAt]) // claims by delib, time-sorted
//   @@index([deliberationId, createdById, createdAt])
// }


// model Deliberation {
//   id            String               @id @default(cuid())
//   hostType      DeliberationHostType
//   hostId        String
//   rule          RepresentationRule   @default(utilitarian)
//   k             Int                  @default(3)
//   createdById   String
//   createdAt     DateTime             @default(now())
//   updatedAt     DateTime             @updatedAt
//   cards         DeliberationCard[]
//   title         String?
//   AgoraRoom     AgoraRoom?           @relation(fields: [agoraRoomId], references: [id], onDelete: SetNull)
//   agoraRoomId   String?
//   agoraRoomID   String?
//   roomId        String?
//   arguments     Argument[]
//   edges         ArgumentEdge[]
//   approvals     ArgumentApproval[]
//   selections    ViewpointSelection[]
//   Issue         Issue[]
//   Claim         Claim[]
//   ClaimEdge     ClaimEdge[]
//   Cluster       Cluster[]
//   TheoryWork    TheoryWork[]
//   KnowledgeEdge KnowledgeEdge[]

//   proofMode ProofMode @default(symmetric)

//   tags    String[]             @default([])
//   roles   DeliberationRole[]
//   calls   DeliberationCall[]
//   anchors DeliberationAnchor[]

//   upgradedFromDiscussionId String?     @unique
//   upgradedFromDiscussion   Discussion? @relation("DiscussionToDeliberation", fields: [upgradedFromDiscussionId], references: [id])

//   // ✅ back-relations for StackReference (two directed edges to Deliberation)
//   stackRefsFrom StackReference[] @relation("StackRefFrom")
//   stackRefsTo   StackReference[] @relation("StackRefTo")

//   // ✅ back-relations for ArgumentImport (two directed edges to Deliberation)
//   argImportsFrom ArgumentImport[] @relation("ArgImpFrom")
//   argImportsTo   ArgumentImport[] @relation("ArgImpTo")

//   // ✅ back-relations for SharedAuthorRoomEdge (two directed edges to Deliberation)
//   sharedAuthorsFrom SharedAuthorRoomEdge[] @relation("SharedAuthorFrom")
//   sharedAuthorsTo   SharedAuthorRoomEdge[] @relation("SharedAuthorTo")
//   DebateSheet       DebateSheet[]

//   @@index([agoraRoomID])
//   @@index([hostType, hostId])
//   @@index([roomId])
// }


  // Find sheetIds that contain nodes whose argument or claim belongs to this deliberation
const argumentIds = await prisma.argument.findMany({
  where: { deliberationId },
  select: { id: true },
});
const claimIds = await prisma.claim.findMany({
  where: { deliberationId },
  select: { id: true },
});

// const nodes = await prisma.debateNode.findMany({
//   where: {
//     OR: [
//       { argumentId: { in: argumentIds.map(a => a.id) } },
//       { claimId: { in: claimIds.map(c => c.id) } },
//     ],
//   },
//   select: { sheetId: true },
//   distinct: ['sheetId'],
//   take: 2000,
// });

const nodes = await prisma.debateNode.findMany({
  where: {
    OR: [
      { argument: { is: { deliberationId } } }, // optional to-one relation → use `is`
      { claim:    { is: { deliberationId } } },
    ],
  },
  select: { sheetId: true },
  distinct: ['sheetId'],
  take: 2000,
});

  const sheetIds = [...new Set(nodes.map(n => n.sheetId))];
  if (!sheetIds.length) return NextResponse.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } });

  const sheets = await prisma.debateSheet.findMany({
    where: { id: { in: sheetIds } },
    select: { id: true, title: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ items: sheets }, { headers: { 'Cache-Control': 'no-store' } });
}
