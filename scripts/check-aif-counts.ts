#!/usr/bin/env tsx
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkCounts() {
  try {
    const nodeCount = await prisma.$queryRaw<any[]>`SELECT COUNT(*) FROM "AifNode"`;
    console.log("AifNode count:", nodeCount[0].count);
    
    const edgeCount = await prisma.$queryRaw<any[]>`SELECT COUNT(*) FROM "AifEdge"`;
    console.log("AifEdge count:", edgeCount[0].count);
    
    const dmNodes = await prisma.$queryRaw<any[]>`SELECT COUNT(*) FROM "AifNode" WHERE "nodeKind" = 'DM'`;
    console.log("DM-node count:", dmNodes[0].count);
    
    const moveCount = await prisma.$queryRaw<any[]>`SELECT COUNT(*) FROM "DialogueMove" WHERE "aifRepresentation" IS NOT NULL`;
    console.log("DialogueMoves with aifRepresentation:", moveCount[0].count);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCounts();
