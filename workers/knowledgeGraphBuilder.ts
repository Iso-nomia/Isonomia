/**
 * Phase 3.4.1: Knowledge Graph Builder Worker
 * 
 * Builds and maintains the knowledge graph by creating nodes and edges
 * from sources, topics, deliberations, and their relationships.
 */

import { Worker, Job } from "bullmq";
import { prisma } from "@/lib/prismaclient";
import { connection } from "@/lib/queue";
import { ExplorerNodeType, ExplorerEdgeType } from "@prisma/client";

interface GraphBuildJob {
  scope: "full" | "incremental";
  entityType?: ExplorerNodeType;
  entityId?: string;
}

/**
 * Main job processor for knowledge graph building
 */
export async function processKnowledgeGraphBuild(job: Job<GraphBuildJob>) {
  const { scope, entityType, entityId } = job.data;

  console.log(`[KnowledgeGraph] Building graph (scope: ${scope})...`);

  if (scope === "full") {
    await buildFullGraph();
  } else if (entityType && entityId) {
    await updateGraphForEntity(entityType, entityId);
  }

  return { success: true, scope };
}

/**
 * Build the complete knowledge graph from scratch
 */
async function buildFullGraph() {
  console.log("[KnowledgeGraph] Starting full graph build...");

  // Clear existing graph
  await prisma.explorerEdge.deleteMany({});
  await prisma.explorerNode.deleteMany({});

  // Build nodes for each entity type
  await buildSourceNodes();
  await buildTopicNodes();
  await buildDeliberationNodes();
  await buildAuthorNodes();

  // Build edges between nodes
  await buildSourceTopicEdges();
  await buildSourceAuthorEdges();
  await buildDeliberationTopicEdges();
  await buildSourceCitationEdges();

  console.log("[KnowledgeGraph] Full graph build complete");
}

/**
 * Build nodes for all sources
 */
async function buildSourceNodes() {
  console.log("[KnowledgeGraph] Building source nodes...");

  const sources = await prisma.source.findMany({
    select: {
      id: true,
      title: true,
      abstract: true,
      topics: true,
      _count: { select: { citations: true } },
    },
  });

  let created = 0;
  for (const source of sources) {
    await prisma.explorerNode.create({
      data: {
        nodeType: "source",
        referenceId: source.id,
        label: source.title,
        description: source.abstract?.slice(0, 500),
        weight: Math.log10(source._count.citations + 1) + 1,
        connectionCount: source._count.citations,
        lastActivityAt: new Date(),
      },
    });
    created++;
  }

  console.log(`[KnowledgeGraph] Created ${created} source nodes`);
}

/**
 * Build nodes for all unique topics
 */
async function buildTopicNodes() {
  console.log("[KnowledgeGraph] Building topic nodes...");

  const sources = await prisma.source.findMany({
    select: { topics: true },
  });

  // Collect all unique topics
  const topicCounts = new Map<string, number>();
  for (const source of sources) {
    const topics = (source.topics as string[]) || [];
    for (const topic of topics) {
      const normalized = topic.trim().toLowerCase();
      if (normalized) {
        topicCounts.set(normalized, (topicCounts.get(normalized) || 0) + 1);
      }
    }
  }

  let created = 0;
  for (const [topic, count] of topicCounts) {
    await prisma.explorerNode.create({
      data: {
        nodeType: "topic",
        referenceId: topic,
        label: topic.charAt(0).toUpperCase() + topic.slice(1),
        weight: Math.log10(count + 1) + 1,
        connectionCount: count,
      },
    });
    created++;
  }

  console.log(`[KnowledgeGraph] Created ${created} topic nodes`);
}

/**
 * Build nodes for public deliberations
 */
async function buildDeliberationNodes() {
  console.log("[KnowledgeGraph] Building deliberation nodes...");

  const deliberations = await prisma.deliberation.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      title: true,
      description: true,
      _count: { select: { arguments: true, citations: true } },
    },
  });

  let created = 0;
  for (const delib of deliberations) {
    const weight = Math.log10(delib._count.arguments + delib._count.citations + 1) + 1;
    await prisma.explorerNode.create({
      data: {
        nodeType: "deliberation",
        referenceId: delib.id,
        label: delib.title,
        description: delib.description?.slice(0, 500),
        weight,
        connectionCount: delib._count.arguments,
      },
    });
    created++;
  }

  console.log(`[KnowledgeGraph] Created ${created} deliberation nodes`);
}

/**
 * Build nodes for authors
 */
async function buildAuthorNodes() {
  console.log("[KnowledgeGraph] Building author nodes...");

  const sources = await prisma.source.findMany({
    select: { authorsJson: true },
  });

  // Collect unique authors
  const authorCounts = new Map<string, number>();
  for (const source of sources) {
    const authors = (source.authorsJson as any[]) || [];
    for (const author of authors) {
      const name = typeof author === "string" ? author : author?.name || author?.given + " " + author?.family;
      if (name && name.trim()) {
        const normalized = name.trim();
        authorCounts.set(normalized, (authorCounts.get(normalized) || 0) + 1);
      }
    }
  }

  let created = 0;
  for (const [author, count] of authorCounts) {
    // Only create nodes for authors with multiple sources
    if (count >= 2) {
      await prisma.explorerNode.create({
        data: {
          nodeType: "author",
          referenceId: author.toLowerCase().replace(/\s+/g, "-"),
          label: author,
          weight: Math.log10(count + 1) + 1,
          connectionCount: count,
        },
      });
      created++;
    }
  }

  console.log(`[KnowledgeGraph] Created ${created} author nodes`);
}

/**
 * Create edges between sources and their topics
 */
async function buildSourceTopicEdges() {
  console.log("[KnowledgeGraph] Building source-topic edges...");

  const sources = await prisma.source.findMany({
    select: { id: true, topics: true },
  });

  let created = 0;
  for (const source of sources) {
    const topics = (source.topics as string[]) || [];

    for (const topic of topics) {
      const normalized = topic.trim().toLowerCase();
      if (!normalized) continue;

      const sourceNode = await prisma.explorerNode.findUnique({
        where: { nodeType_referenceId: { nodeType: "source", referenceId: source.id } },
      });
      const topicNode = await prisma.explorerNode.findUnique({
        where: { nodeType_referenceId: { nodeType: "topic", referenceId: normalized } },
      });

      if (sourceNode && topicNode) {
        await prisma.explorerEdge.create({
          data: {
            sourceNodeId: sourceNode.id,
            targetNodeId: topicNode.id,
            edgeType: "discusses",
            weight: 1,
          },
        });
        created++;
      }
    }
  }

  console.log(`[KnowledgeGraph] Created ${created} source-topic edges`);
}

/**
 * Create edges between sources and their authors
 */
async function buildSourceAuthorEdges() {
  console.log("[KnowledgeGraph] Building source-author edges...");

  const sources = await prisma.source.findMany({
    select: { id: true, authorsJson: true },
  });

  let created = 0;
  for (const source of sources) {
    const authors = (source.authorsJson as any[]) || [];

    for (const author of authors) {
      const name = typeof author === "string" ? author : author?.name || author?.given + " " + author?.family;
      if (!name || !name.trim()) continue;

      const normalized = name.trim().toLowerCase().replace(/\s+/g, "-");

      const sourceNode = await prisma.explorerNode.findUnique({
        where: { nodeType_referenceId: { nodeType: "source", referenceId: source.id } },
      });
      const authorNode = await prisma.explorerNode.findUnique({
        where: { nodeType_referenceId: { nodeType: "author", referenceId: normalized } },
      });

      if (sourceNode && authorNode) {
        await prisma.explorerEdge.create({
          data: {
            sourceNodeId: sourceNode.id,
            targetNodeId: authorNode.id,
            edgeType: "authored_by",
            weight: 1,
          },
        });
        created++;
      }
    }
  }

  console.log(`[KnowledgeGraph] Created ${created} source-author edges`);
}

/**
 * Create edges between deliberations and topics (via their cited sources)
 */
async function buildDeliberationTopicEdges() {
  console.log("[KnowledgeGraph] Building deliberation-topic edges...");

  const deliberations = await prisma.deliberation.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      citations: {
        select: {
          source: {
            select: { topics: true },
          },
        },
      },
    },
  });

  let created = 0;
  for (const delib of deliberations) {
    const topicsInDelib = new Set<string>();

    for (const citation of delib.citations) {
      const topics = (citation.source?.topics as string[]) || [];
      topics.forEach((t) => {
        const normalized = t.trim().toLowerCase();
        if (normalized) topicsInDelib.add(normalized);
      });
    }

    const delibNode = await prisma.explorerNode.findUnique({
      where: { nodeType_referenceId: { nodeType: "deliberation", referenceId: delib.id } },
    });

    if (!delibNode) continue;

    for (const topic of topicsInDelib) {
      const topicNode = await prisma.explorerNode.findUnique({
        where: { nodeType_referenceId: { nodeType: "topic", referenceId: topic } },
      });

      if (topicNode) {
        try {
          await prisma.explorerEdge.upsert({
            where: {
              sourceNodeId_targetNodeId_edgeType: {
                sourceNodeId: delibNode.id,
                targetNodeId: topicNode.id,
                edgeType: "discusses",
              },
            },
            create: {
              sourceNodeId: delibNode.id,
              targetNodeId: topicNode.id,
              edgeType: "discusses",
              weight: 1,
            },
            update: {
              weight: { increment: 1 },
            },
          });
          created++;
        } catch (e) {
          // Skip duplicates
        }
      }
    }
  }

  console.log(`[KnowledgeGraph] Created ${created} deliberation-topic edges`);
}

/**
 * Create edges between sources based on citations (supports/refutes)
 */
async function buildSourceCitationEdges() {
  console.log("[KnowledgeGraph] Building source citation edges...");

  // Get citations with their intent
  const citations = await prisma.citation.findMany({
    select: {
      sourceId: true,
      targetType: true,
      targetId: true,
      intent: true,
      deliberationId: true,
    },
  });

  let created = 0;
  for (const citation of citations) {
    // Connect source to deliberation if the citation is in a deliberation
    if (citation.deliberationId) {
      const sourceNode = await prisma.explorerNode.findUnique({
        where: { nodeType_referenceId: { nodeType: "source", referenceId: citation.sourceId } },
      });
      const delibNode = await prisma.explorerNode.findUnique({
        where: { nodeType_referenceId: { nodeType: "deliberation", referenceId: citation.deliberationId } },
      });

      if (sourceNode && delibNode) {
        const edgeType: ExplorerEdgeType = 
          citation.intent === "refutes" ? "refutes" : 
          citation.intent === "supports" ? "supports" : 
          "discusses";

        try {
          await prisma.explorerEdge.upsert({
            where: {
              sourceNodeId_targetNodeId_edgeType: {
                sourceNodeId: sourceNode.id,
                targetNodeId: delibNode.id,
                edgeType,
              },
            },
            create: {
              sourceNodeId: sourceNode.id,
              targetNodeId: delibNode.id,
              edgeType,
              weight: 1,
            },
            update: {
              weight: { increment: 1 },
            },
          });
          created++;
        } catch (e) {
          // Skip duplicates
        }
      }
    }
  }

  console.log(`[KnowledgeGraph] Created ${created} source citation edges`);
}

/**
 * Incremental update for a specific entity
 */
async function updateGraphForEntity(entityType: ExplorerNodeType, entityId: string) {
  console.log(`[KnowledgeGraph] Updating for ${entityType}:${entityId}`);

  switch (entityType) {
    case "source":
      await updateSourceNode(entityId);
      break;
    case "deliberation":
      await updateDeliberationNode(entityId);
      break;
    default:
      console.log(`[KnowledgeGraph] Incremental update for ${entityType} not implemented`);
  }
}

/**
 * Update or create a source node and its edges
 */
async function updateSourceNode(sourceId: string) {
  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      title: true,
      abstract: true,
      topics: true,
      authorsJson: true,
      _count: { select: { citations: true } },
    },
  });

  if (!source) return;

  // Upsert the source node
  const node = await prisma.explorerNode.upsert({
    where: {
      nodeType_referenceId: { nodeType: "source", referenceId: sourceId },
    },
    create: {
      nodeType: "source",
      referenceId: sourceId,
      label: source.title,
      description: source.abstract?.slice(0, 500),
      weight: Math.log10(source._count.citations + 1) + 1,
      connectionCount: source._count.citations,
      lastActivityAt: new Date(),
    },
    update: {
      label: source.title,
      description: source.abstract?.slice(0, 500),
      weight: Math.log10(source._count.citations + 1) + 1,
      connectionCount: source._count.citations,
      lastActivityAt: new Date(),
    },
  });

  // Update topic edges
  const topics = (source.topics as string[]) || [];
  for (const topic of topics) {
    const normalized = topic.trim().toLowerCase();
    if (!normalized) continue;

    // Ensure topic node exists
    const topicNode = await prisma.explorerNode.upsert({
      where: { nodeType_referenceId: { nodeType: "topic", referenceId: normalized } },
      create: {
        nodeType: "topic",
        referenceId: normalized,
        label: topic.charAt(0).toUpperCase() + topic.slice(1),
        weight: 1,
        connectionCount: 1,
      },
      update: {
        connectionCount: { increment: 1 },
      },
    });

    // Create edge
    await prisma.explorerEdge.upsert({
      where: {
        sourceNodeId_targetNodeId_edgeType: {
          sourceNodeId: node.id,
          targetNodeId: topicNode.id,
          edgeType: "discusses",
        },
      },
      create: {
        sourceNodeId: node.id,
        targetNodeId: topicNode.id,
        edgeType: "discusses",
        weight: 1,
      },
      update: {},
    });
  }
}

/**
 * Update or create a deliberation node and its edges
 */
async function updateDeliberationNode(deliberationId: string) {
  const delib = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: {
      id: true,
      title: true,
      description: true,
      isPublic: true,
      _count: { select: { arguments: true, citations: true } },
    },
  });

  if (!delib || !delib.isPublic) return;

  await prisma.explorerNode.upsert({
    where: {
      nodeType_referenceId: { nodeType: "deliberation", referenceId: deliberationId },
    },
    create: {
      nodeType: "deliberation",
      referenceId: deliberationId,
      label: delib.title,
      description: delib.description?.slice(0, 500),
      weight: Math.log10(delib._count.arguments + delib._count.citations + 1) + 1,
      connectionCount: delib._count.arguments,
    },
    update: {
      label: delib.title,
      description: delib.description?.slice(0, 500),
      weight: Math.log10(delib._count.arguments + delib._count.citations + 1) + 1,
      connectionCount: delib._count.arguments,
    },
  });
}

/**
 * Create and start the knowledge graph builder worker
 */
export function createKnowledgeGraphWorker() {
  const worker = new Worker<GraphBuildJob>(
    "knowledge-graph",
    processKnowledgeGraphBuild,
    { connection }
  );

  worker.on("completed", (job) => {
    console.log(`[KnowledgeGraph] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[KnowledgeGraph] Job ${job?.id} failed:`, err.message);
  });

  console.log("[KnowledgeGraph] Worker started");
  return worker;
}
