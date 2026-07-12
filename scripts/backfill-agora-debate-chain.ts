#!/usr/bin/env tsx
/**
 * scripts/backfill-agora-debate-chain.ts
 * 
 * Ensures every Deliberation has:
 * 1. An AgoraRoom (linked via Deliberation.agoraRoomId)
 * 2. A DebateSheet (linked via DebateSheet.deliberationId AND DebateSheet.roomId)
 * 
 * Phase 4 Task 0: Debate Layer Modernization
 * Run: npx tsx scripts/backfill-agora-debate-chain.ts [--dry-run]
 */

import { prisma } from '@/lib/prismaclient';
import slugify from 'slugify';

const DRY_RUN = process.argv.includes('--dry-run');

type Stats = {
  deliberationsProcessed: number;
  roomsCreated: number;
  roomsAlreadyLinked: number;
  sheetsCreated: number;
  sheetsAlreadyExist: number;
  sheetsLinkedToRoom: number;
  errors: string[];
};

async function main() {
  console.log('🔗 Starting Deliberation → AgoraRoom → DebateSheet Backfill');
  console.log(`Mode: ${DRY_RUN ? '🧪 DRY RUN (no changes)' : '✍️  WRITE MODE'}\n`);

  const stats: Stats = {
    deliberationsProcessed: 0,
    roomsCreated: 0,
    roomsAlreadyLinked: 0,
    sheetsCreated: 0,
    sheetsAlreadyExist: 0,
    sheetsLinkedToRoom: 0,
    errors: [],
  };

  // Step 1: Fetch all deliberations
  console.log('📊 Fetching deliberations...');
  const deliberations = await prisma.deliberation.findMany({
    select: {
      id: true,
      title: true,
      agoraRoomId: true,
      createdById: true,
    },
  });

  console.log(`Found ${deliberations.length} deliberations\n`);

  // Step 2: Process each deliberation
  for (const delib of deliberations) {
    stats.deliberationsProcessed++;
    
    try {
      // Step 2A: Ensure AgoraRoom exists
      let roomId = delib.agoraRoomId;
      
      if (!roomId) {
        console.log(`📍 Deliberation ${delib.id.slice(0, 8)} has no AgoraRoom`);
        
        if (!DRY_RUN) {
          // Create AgoraRoom
          const slug = await ensureUniqueSlug(
            slugify(delib.title?.slice(0, 30) || delib.id.slice(0, 8), {
              lower: true,
              strict: true,
            })
          );
          
          const room = await prisma.agoraRoom.create({
            data: {
              slug,
              title: delib.title || `Room ${delib.id.slice(0, 6)}…`,
              summary: null,
              visibility: 'public',
            },
          });
          
          // Link deliberation to room
          await prisma.deliberation.update({
            where: { id: delib.id },
            data: { agoraRoomId: room.id },
          });
          
          roomId = room.id;
          stats.roomsCreated++;
          console.log(`  ✅ Created AgoraRoom: ${room.slug} (${room.id})`);
        } else {
          console.log(`  [DRY RUN] Would create AgoraRoom for deliberation ${delib.id}`);
          stats.roomsCreated++;
        }
      } else {
        stats.roomsAlreadyLinked++;
      }

      // Step 2B: Ensure DebateSheet exists
      const syntheticSheetId = `delib:${delib.id}`;
      
      const existingSheet = await prisma.debateSheet.findUnique({
        where: { id: syntheticSheetId },
        select: { id: true, roomId: true, deliberationId: true },
      });

      if (!existingSheet) {
        console.log(`📋 Deliberation ${delib.id.slice(0, 8)} has no DebateSheet`);
        
        if (!DRY_RUN && roomId) {
          // Create DebateSheet
          const sheet = await prisma.debateSheet.create({
            data: {
              id: syntheticSheetId,
              title: delib.title || `Delib ${delib.id.slice(0, 6)}`,
              scope: 'deliberation',
              roles: ['Proponent', 'Opponent', 'Curator'],
              deliberationId: delib.id,
              roomId: roomId,  // Link to AgoraRoom
              createdById: delib.createdById || 'system',
            },
          });
          
          stats.sheetsCreated++;
          console.log(`  ✅ Created DebateSheet: ${sheet.id} (linked to room ${roomId?.slice(0, 8)})`);
        } else if (DRY_RUN) {
          console.log(`  [DRY RUN] Would create DebateSheet for deliberation ${delib.id}`);
          stats.sheetsCreated++;
        } else {
          console.log(`  ⚠️  Cannot create DebateSheet: roomId missing`);
          stats.errors.push(`Deliberation ${delib.id}: roomId missing, cannot create sheet`);
        }
      } else {
        stats.sheetsAlreadyExist++;
        
        // Step 2C: Ensure sheet is linked to room (repair if needed)
        if (existingSheet.roomId !== roomId && roomId) {
          console.log(`🔧 DebateSheet ${syntheticSheetId} not linked to room, fixing...`);
          
          if (!DRY_RUN) {
            await prisma.debateSheet.update({
              where: { id: syntheticSheetId },
              data: { roomId },
            });
            
            stats.sheetsLinkedToRoom++;
            console.log(`  ✅ Linked DebateSheet to room ${roomId.slice(0, 8)}`);
          } else {
            console.log(`  [DRY RUN] Would link sheet ${syntheticSheetId} to room ${roomId}`);
            stats.sheetsLinkedToRoom++;
          }
        }
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ Error processing deliberation ${delib.id}:`, errMsg);
      stats.errors.push(`Deliberation ${delib.id}: ${errMsg}`);
    }
  }

  // Step 3: Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Backfill Summary');
  console.log('='.repeat(60));
  console.log(`Deliberations processed:  ${stats.deliberationsProcessed}`);
  console.log(`\nAgoraRooms:`);
  console.log(`  - Created:              ${stats.roomsCreated}`);
  console.log(`  - Already linked:       ${stats.roomsAlreadyLinked}`);
  console.log(`\nDebateSheets:`);
  console.log(`  - Created:              ${stats.sheetsCreated}`);
  console.log(`  - Already exist:        ${stats.sheetsAlreadyExist}`);
  console.log(`  - Linked to room:       ${stats.sheetsLinkedToRoom}`);
  console.log(`\nErrors:                   ${stats.errors.length}`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err}`);
    });
  }
  
  console.log('='.repeat(60));
  
  if (DRY_RUN) {
    console.log('\n🧪 This was a DRY RUN - no changes were made');
    console.log('Run without --dry-run to apply changes');
  } else {
    console.log('\n✅ Backfill complete!');
  }
  
  // Step 4: Verify integrity
  if (!DRY_RUN) {
    console.log('\n🔍 Verifying integrity...');
    await verifyIntegrity();
  }
}

async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug || 'room';
  let counter = 1;
  
  while (true) {
    const exists = await prisma.agoraRoom.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${baseSlug}-${++counter}`;
  }
}

async function verifyIntegrity() {
  // Check 1: Deliberations without AgoraRoom
  const orphanedDelibs = await prisma.deliberation.count({
    where: { agoraRoomId: null },
  });
  
  // Check 2: AgoraRooms without DebateSheet
  const roomsWithSheets = await prisma.agoraRoom.findMany({
    select: {
      id: true,
      sheets: { select: { id: true } },
    },
  });
  const roomsWithoutSheets = roomsWithSheets.filter(r => r.sheets.length === 0);
  
  // Check 3: DebateSheets without roomId
  const sheetsWithoutRoom = await prisma.debateSheet.count({
    where: { roomId: null },
  });

  console.log(`  Deliberations without AgoraRoom: ${orphanedDelibs}`);
  console.log(`  AgoraRooms without DebateSheet:  ${roomsWithoutSheets.length}`);
  console.log(`  DebateSheets without roomId:     ${sheetsWithoutRoom}`);
  
  if (orphanedDelibs === 0 && roomsWithoutSheets.length === 0 && sheetsWithoutRoom === 0) {
    console.log('  ✅ Chain integrity verified: All links are intact!');
  } else {
    console.log('  ⚠️  Some issues found (may be expected for non-synthetic sheets)');
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
