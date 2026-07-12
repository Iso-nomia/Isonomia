// workers/computeSharedAuthorEdges.ts
import { prisma } from "@/lib/prismaclient";

/**
 * Daily worker job to compute SharedAuthorRoomEdge records.
 * 
 * For each pair of public deliberations, finds authors who have contributed
 * arguments to both deliberations and creates/updates SharedAuthorRoomEdge
 * with strength = count of shared authors.
 * 
 * This enables the "shared_author" edge type in the Plexus network visualization.
 */

async function computeSharedAuthorEdges() {
  console.log("[computeSharedAuthorEdges] Starting...");
  const startTime = Date.now();
  
  try {
    // 1. Get all public deliberations
    const deliberations = await prisma.deliberation.findMany({
      // Remove or update the visibility filter to match your schema
      where: {},
      select: { id: true },
      orderBy: { createdAt: "desc" },
      take: 200, // Limit to prevent timeout on large datasets
    });
    
    const deliberationIds = deliberations.map(d => d.id);
    console.log(`[computeSharedAuthorEdges] Processing ${deliberationIds.length} deliberations`);
    
    let created = 0, updated = 0, skipped = 0;
    
    // 2. Build author sets for all deliberations (batch query for efficiency)
    const authorsByDeliberation = new Map<string, Set<string>>();
    
    for (const delibId of deliberationIds) {
      const authors = await prisma.argument.findMany({
        where: { deliberationId: delibId },
        select: { authorId: true },
        distinct: ["authorId"],
      });
      
      authorsByDeliberation.set(
        delibId, 
        new Set(authors.map(a => a.authorId).filter(id => id !== "system"))
      );
    }
    
    // 3. For each pair of deliberations, compute shared authors
    for (let i = 0; i < deliberationIds.length; i++) {
      for (let j = i + 1; j < deliberationIds.length; j++) {
        const fromId = deliberationIds[i];
        const toId = deliberationIds[j];
        
        const fromAuthors = authorsByDeliberation.get(fromId);
        const toAuthors = authorsByDeliberation.get(toId);
        
        if (!fromAuthors || !toAuthors) continue;
        
        // Compute intersection
        const intersection = [...fromAuthors].filter(id => toAuthors.has(id));
        
        if (intersection.length > 0) {
          // Upsert edge with strength = count of shared authors
          try {
            const existing = await prisma.sharedAuthorRoomEdge.findUnique({
              where: { 
                fromId_toId: { fromId, toId } as any
              },
            });
            
            if (existing) {
              await prisma.sharedAuthorRoomEdge.update({
                where: { id: existing.id },
                data: { strength: intersection.length },
              });
              updated++;
            } else {
              await prisma.sharedAuthorRoomEdge.create({
                data: { 
                  fromId, 
                  toId, 
                  strength: intersection.length 
                },
              });
              created++;
            }
          } catch (error) {
            console.error(`[computeSharedAuthorEdges] Error upserting edge ${fromId} -> ${toId}:`, error);
          }
        } else {
          skipped++;
        }
      }
      
      // Log progress every 10 deliberations
      if ((i + 1) % 10 === 0) {
        console.log(
          `[computeSharedAuthorEdges] Progress: ${i + 1}/${deliberationIds.length} deliberations processed`
        );
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(
      `[computeSharedAuthorEdges] Complete! Created ${created}, updated ${updated}, skipped ${skipped} pairs. Duration: ${duration}ms`
    );
  } catch (error) {
    console.error("[computeSharedAuthorEdges] Error:", error);
  }
}

// Run daily at 3 AM (adjust as needed)
const DAILY_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// Run immediately on startup
computeSharedAuthorEdges().catch((e) =>
  console.error("[computeSharedAuthorEdges] Initial run failed:", e)
);

// Then run every 24 hours
setInterval(() => {
  computeSharedAuthorEdges().catch((e) =>
    console.error("[computeSharedAuthorEdges] Scheduled run failed:", e)
  );
}, DAILY_INTERVAL);

console.log("[computeSharedAuthorEdges] Worker initialized - running daily");
