/**
 * Test script for the essay generator
 * Run with: npx tsx scripts/test-essay-generator.ts
 */

import { PrismaClient } from "@prisma/client";
import { generateEssay } from "../lib/chains/essayGenerator";

const prisma = new PrismaClient();

async function test() {
  // Find the test chain we created (the one with nodes)
  const chain = await prisma.argumentChain.findFirst({
    where: { 
      name: "AI Governance Policy Chain",
      nodes: { some: {} }  // Must have at least one node
    },
    include: {
      creator: { select: { id: true, name: true, image: true } },
      deliberation: { select: { id: true, title: true } },
      nodes: {
        include: {
          argument: {
            include: {
              conclusion: { select: { id: true, text: true } },
              premises: {
                include: {
                  claim: { select: { id: true, text: true } },
                },
              },
              argumentSchemes: {
                include: {
                  scheme: {
                    select: {
                      id: true, key: true, name: true, description: true, summary: true,
                      cq: true, premises: true, conclusion: true,
                      purpose: true, source: true, materialRelation: true,
                      reasoningType: true, ruleForm: true, conclusionType: true,
                      whenToUse: true, examples: true, clusterTag: true, parentSchemeId: true, tags: true,
                    },
                  },
                },
              },
              schemeNet: {
                include: {
                  steps: {
                    include: { scheme: true },
                    orderBy: { stepOrder: "asc" },
                  },
                },
              },
            },
          },
          contributor: { select: { id: true, name: true, image: true } },
        },
        orderBy: { nodeOrder: "asc" },
      },
      edges: {
        include: {
          sourceNode: {
            include: {
              argument: {
                select: {
                  id: true, text: true,
                  conclusion: { select: { id: true, text: true } },
                },
              },
            },
          },
          targetNode: {
            include: {
              argument: {
                select: {
                  id: true, text: true,
                  conclusion: { select: { id: true, text: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  
  if (!chain) {
    console.log("No test chain found - run seed-test-chain.ts first");
    await prisma.$disconnect();
    return;
  }
  
  console.log("Found chain:", chain.name);
  console.log("Nodes:", chain.nodes.length);
  console.log("Edges:", chain.edges.length);
  console.log("");
  
  const essay = generateEssay(chain as any, {
    tone: "deliberative",
    includeSchemeReferences: true,
    includeCriticalQuestions: true,
    includePremiseStructure: true,
    includeDialectic: true,
  });
  
  console.log("=".repeat(80));
  console.log(essay.fullText);
  console.log("=".repeat(80));
  console.log("");
  console.log("Word count:", essay.wordCount);
  console.log("Schemes used:", essay.metadata.schemeCount);
  console.log("Dialectical moves:", essay.metadata.dialecticalMoves);
  
  await prisma.$disconnect();
}

test().catch(console.error);
