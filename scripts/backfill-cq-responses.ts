// scripts/backfill-cq-responses.ts
// Backfill script to migrate existing CQStatus.groundsText to CQResponse records

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function backfillCQResponses() {
  console.log("🔄 Starting CQ response backfill...\n");

  // Find all CQStatus records that have groundsText (using raw query for backward compat)
  const statusesWithGrounds = await prisma.$queryRaw<Array<{
    id: string;
    groundsText: string;
    satisfied: boolean;
    createdById: string;
    createdAt: Date;
    targetType: string;
    targetId: string;
    schemeKey: string;
    cqKey: string;
  }>>`
    SELECT id, "groundsText", satisfied, "createdById", "createdAt", 
           "targetType", "targetId", "schemeKey", "cqKey"
    FROM "CQStatus"
    WHERE "groundsText" IS NOT NULL
  `;

  console.log(`Found ${statusesWithGrounds.length} CQ statuses with groundsText to migrate\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const status of statusesWithGrounds) {
    try {
      // Check if we already created a response for this (idempotent)
      const existingResponse = await prisma.cQResponse.findFirst({
        where: {
          cqStatusId: status.id,
          responseStatus: "CANONICAL",
        },
      });

      if (existingResponse) {
        console.log(`⏭️  Skipping ${status.id} (already has canonical response)`);
        skippedCount++;
        continue;
      }

      // Create a CQResponse from the groundsText
      const response = await prisma.cQResponse.create({
        data: {
          cqStatusId: status.id,
          groundsText: status.groundsText,
          evidenceClaimIds: [], // No evidence was tracked in old system
          sourceUrls: [], // No sources were tracked
          responseStatus: status.satisfied ? "CANONICAL" : "APPROVED",
          contributorId: status.createdById, // Original author
          reviewedAt: status.createdAt, // Use creation time as review time
          reviewedBy: status.createdById, // Self-approved
          reviewNotes: "Migrated from legacy groundsText field",
          upvotes: 0,
          downvotes: 0,
          createdAt: status.createdAt,
          updatedAt: status.createdAt,
        },
      });

      // If this was marked satisfied, set it as canonical and update status
      if (status.satisfied) {
        await prisma.cQStatus.update({
          where: { id: status.id },
          data: {
            canonicalResponseId: response.id,
            statusEnum: "SATISFIED",
            lastReviewedAt: status.createdAt,
            lastReviewedBy: status.createdById,
          },
        });

        // Log the canonical selection
        await prisma.cQActivityLog.create({
          data: {
            cqStatusId: status.id,
            action: "CANONICAL_SELECTED",
            actorId: status.createdById,
            responseId: response.id,
            metadata: {
              migratedFrom: "legacy_groundsText",
              originalSatisfied: true,
            },
          },
        });
      } else {
        // Just update statusEnum to reflect it has an approved response
        await prisma.cQStatus.update({
          where: { id: status.id },
          data: {
            statusEnum: "PARTIALLY_SATISFIED",
            lastReviewedAt: status.createdAt,
            lastReviewedBy: status.createdById,
          },
        });
      }

      // Log the response submission
      await prisma.cQActivityLog.create({
        data: {
          cqStatusId: status.id,
          action: "RESPONSE_SUBMITTED",
          actorId: status.createdById,
          responseId: response.id,
          metadata: {
            migratedFrom: "legacy_groundsText",
          },
        },
      });

      migratedCount++;
      if (migratedCount % 10 === 0) {
        console.log(`✅ Migrated ${migratedCount} responses...`);
      }
    } catch (error: any) {
      console.error(`❌ Error migrating status ${status.id}:`, error.message);
      errorCount++;
    }
  }

  // Update any CQStatus records without groundsText to OPEN
  const openStatuses = await prisma.cQStatus.updateMany({
    where: {
      statusEnum: "OPEN", // Only update if still default
    },
    data: {
      statusEnum: "OPEN",
    },
  });

  console.log(`\n📊 Backfill Summary:`);
  console.log(`   ✅ Migrated: ${migratedCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   🔓 Confirmed OPEN: ${openStatuses.count}`);
  console.log(`\n✨ Backfill complete!`);
}

backfillCQResponses()
  .catch((error) => {
    console.error("Fatal error during backfill:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
