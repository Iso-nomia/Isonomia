/**
 * Seed script for creating a deliberation with proper branching structure
 * that generates multiple Ludics views.
 * 
 * Run with: npx tsx scripts/seed-branching-dialogue.ts
 */

import { prisma } from "@/lib/prismaclient";
import { compileFromMoves } from "@/packages/ludics-engine/compileFromMoves";
import crypto from "crypto";

const DELIB_ID = "ludics-views-test-" + Date.now().toString(36);

function sig(s: string) { 
  return crypto.createHash("sha1").update(s, "utf8").digest("hex"); 
}

async function main() {
  console.log("=".repeat(70));
  console.log("🌳 Creating Deliberation with Branching Structure");
  console.log("=".repeat(70));
  console.log(`\nDeliberation ID: ${DELIB_ID}\n`);

  // 1. Create deliberation (requires hostType, hostId, createdById per schema)
  const delib = await prisma.deliberation.upsert({
    where: { id: DELIB_ID },
    update: {},
    create: {
      id: DELIB_ID,
      title: "Ludics Views Test - Branching Dialogue",
      hostType: "article",  // Using article as a simple host type
      hostId: "test-article-" + DELIB_ID,
      createdById: "system-seed",
    },
  });
  console.log("✅ Created deliberation:", delib.id);

  // 2. Create dialogue moves with proper structure
  // The key is that WHY moves target the SAME targetId as the ASSERT they're challenging
  
  const moves = [
    // Top-level claim 1
    {
      targetType: "claim" as const,
      targetId: "main-thesis",
      kind: "ASSERT" as const,
      actorId: "Proponent",
      payload: { text: "We should implement carbon taxes" },
    },
    
    // WHY challenge to claim 1 (should create 0.1.1)
    {
      targetType: "claim" as const,
      targetId: "main-thesis",  // SAME targetId!
      kind: "WHY" as const,
      actorId: "Opponent",
      payload: { note: "What evidence supports this?" },
    },
    
    // GROUNDS response to WHY (should create 0.1.1.1)
    {
      targetType: "claim" as const,
      targetId: "main-thesis",  // SAME targetId!
      kind: "GROUNDS" as const,
      actorId: "Proponent",
      payload: { text: "Studies show 30% emission reductions" },
    },
    
    // Second WHY challenge to same claim (should create 0.1.2)
    {
      targetType: "claim" as const,
      targetId: "main-thesis",
      kind: "WHY" as const,
      actorId: "Opponent",
      payload: { note: "What about economic impacts?" },
    },
    
    // Top-level claim 2 (creates new branch)
    {
      targetType: "claim" as const,
      targetId: "supporting-claim",
      kind: "ASSERT" as const,
      actorId: "Proponent",
      payload: { text: "Carbon taxes are economically efficient" },
    },
    
    // WHY to claim 2
    {
      targetType: "claim" as const,
      targetId: "supporting-claim",
      kind: "WHY" as const,
      actorId: "Opponent",
      payload: { note: "Is this really efficient?" },
    },
    
    // GROUNDS to claim 2 WHY
    {
      targetType: "claim" as const,
      targetId: "supporting-claim",
      kind: "GROUNDS" as const,
      actorId: "Proponent",
      payload: { text: "Market mechanisms find lowest-cost abatement" },
    },
    
    // Another WHY to claim 2
    {
      targetType: "claim" as const,
      targetId: "supporting-claim",
      kind: "WHY" as const,
      actorId: "Opponent",
      payload: { note: "But what about competitiveness?" },
    },
    
    // Third top-level claim
    {
      targetType: "claim" as const,
      targetId: "equity-claim",
      kind: "ASSERT" as const,
      actorId: "Proponent",
      payload: { text: "Revenue recycling makes carbon taxes progressive" },
    },
    
    // Deep nesting: WHY → GROUNDS → WHY → GROUNDS
    {
      targetType: "claim" as const,
      targetId: "equity-claim",
      kind: "WHY" as const,
      actorId: "Opponent",
      payload: { note: "How does recycling work?" },
    },
    {
      targetType: "claim" as const,
      targetId: "equity-claim",
      kind: "GROUNDS" as const,
      actorId: "Proponent",
      payload: { text: "Direct dividends to households" },
    },
    {
      targetType: "claim" as const,
      targetId: "equity-claim",
      kind: "WHY" as const,
      actorId: "Opponent",
      payload: { note: "But won't low-income still pay more proportionally?" },
    },
    {
      targetType: "claim" as const,
      targetId: "equity-claim",
      kind: "GROUNDS" as const,
      actorId: "Proponent",
      payload: { text: "Dividends exceed costs for bottom 60%" },
    },
  ];

  console.log(`\n📝 Creating ${moves.length} dialogue moves with proper targeting...\n`);

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    const signature = sig(`${DELIB_ID}:${m.kind}:${m.targetType}:${m.targetId}:${i}`);
    
    await prisma.dialogueMove.create({
      data: {
        deliberationId: DELIB_ID,
        targetType: m.targetType,
        targetId: m.targetId,
        kind: m.kind,
        actorId: m.actorId,
        payload: m.payload,
        signature,
        polarity: m.kind === "WHY" ? "O" : "P",
      },
    });
    
    console.log(`  ${i + 1}. ${m.kind.padEnd(8)} → ${m.targetId.padEnd(18)} (${m.actorId})`);
  }

  // 3. Compile to Ludics designs
  console.log("\n🔄 Compiling dialogue moves to Ludics designs...");
  
  const compileResult = await compileFromMoves(DELIB_ID, {
    scopingStrategy: "legacy",
    forceRecompile: true,
  });
  
  console.log("✅ Compilation result:", compileResult);

  // 4. Check resulting structure
  console.log("\n📊 Checking resulting Ludics structure...");
  
  const designs = await prisma.ludicDesign.findMany({
    where: { deliberationId: DELIB_ID },
    include: {
      acts: {
        include: { locus: true },
        orderBy: { orderInDesign: "asc" },
      },
    },
  });

  for (const design of designs) {
    console.log(`\n${design.participantId} Design (${design.id.slice(0, 8)}...):`);
    console.log("  Acts:");
    
    for (const act of design.acts) {
      const locusPath = act.locus?.path || "(no locus)";
      const expr = (act.expression || "").slice(0, 50);
      const depth = locusPath.split(".").length - 1;
      const indent = "    " + "  ".repeat(depth);
      console.log(`${indent}${locusPath.padEnd(10)} ${act.polarity} ${act.kind.padEnd(8)} "${expr}"`);
    }
  }

  // 5. Show expected view count
  const uniquePaths = new Set<string>();
  for (const design of designs) {
    for (const act of design.acts) {
      if (act.locus?.path) {
        // Count unique path prefixes (each prefix = potential view)
        const parts = act.locus.path.split(".");
        for (let i = 1; i <= parts.length; i++) {
          uniquePaths.add(parts.slice(0, i).join("."));
        }
      }
    }
  }

  console.log(`\n🎯 Expected View Count Estimate: ~${uniquePaths.size} unique path prefixes`);
  console.log("   (Actual views depend on player perspective and play extraction)");

  console.log("\n" + "=".repeat(70));
  console.log("✅ Done! Open deliberation in UI to see Ludics Analysis Panel.");
  console.log(`   Deliberation ID: ${DELIB_ID}`);
  console.log("=".repeat(70));

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error:", e);
  prisma.$disconnect();
  process.exit(1);
});
