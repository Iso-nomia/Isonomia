export const dynamic = "force-dynamic";

// app/api/aif/evaluate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { evaluateAifWithAspic } from "@/lib/aif/translation/aifToAspic";
import { toDefeatGraphFromEdgeList } from "@/lib/argumentation/labelling";
import { computeAcceptability } from "@/lib/argumentation/acceptability";
import type { AIFGraph } from "@/lib/aif/types";

/**
 * POST /api/aif/evaluate
 * 
 * End-to-end AIF evaluation pipeline:
 * 1. AIF graph → ASPIC+ theory
 * 2. Compute ASPIC+ semantics (arguments, attacks, defeats, grounded extension)
 * 3. ASPIC+ → enriched AIF graph with CA-nodes for defeats
 * 
 * Request body:
 * {
 *   graph: {
 *     nodes: Array<INode | RANode | CANode | PANode>,
 *     edges: Array<Edge>
 *   },
 *   debateId: string
 * }
 * 
 * Response:
 * {
 *   outputGraph: AIFGraph (with CA-nodes for computed defeats),
 *   semantics: {
 *     arguments: Argument[],
 *     attacks: Attack[],
 *     defeats: Defeat[],
 *     groundedExtension: string[],
 *     justificationStatus: { [argId: string]: 'in' | 'out' | 'undec' }
 *   }
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate input
    if (!body.graph || !body.graph.nodes || !body.graph.edges) {
      return NextResponse.json(
        { error: "Missing or invalid 'graph' field (must have nodes and edges)" },
        { status: 400 }
      );
    }

    if (!body.debateId || typeof body.debateId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'debateId' field (must be string)" },
        { status: 400 }
      );
    }

    const inputGraph: AIFGraph = {
      nodes: body.graph.nodes,
      edges: body.graph.edges,
    };

    // Run full evaluation pipeline
    const result = evaluateAifWithAspic(inputGraph, body.debateId);

    // Reading-C item 1 (T015): opt-in, additive stable/preferred acceptability.
    const includeAcceptability =
      req.nextUrl.searchParams.get("include") === "acceptability" ||
      body.includeAcceptability === true;
    const acceptability = includeAcceptability
      ? computeAcceptability(
          toDefeatGraphFromEdgeList(
            result.semantics.arguments.map((a) => a.id),
            result.semantics.defeats.map((d): [string, string] => [
              d.defeater.id,
              d.defeated.id,
            ])
          )
        )
      : undefined;

    // Serialize response
    const response = {
      outputGraph: {
        nodes: result.outputGraph.nodes,
        edges: result.outputGraph.edges,
      },
      semantics: {
        arguments: result.semantics.arguments.map((arg) => ({
          id: arg.id,
          premises: Array.from(arg.premises),
          conclusion: arg.conclusion,
          defeasibleRules: Array.from(arg.defeasibleRules),
          topRule: arg.topRule,
          structure: arg.structure,
        })),
        attacks: result.semantics.attacks.map((atk) => ({
          attackerId: atk.attacker.id,
          attackedId: atk.attacked.id,
          type: atk.type,
          target: atk.target,
          metadata: atk.metadata,
        })),
        defeats: result.semantics.defeats.map((def) => ({
          defeaterId: def.defeater.id,
          defeatedId: def.defeated.id,
          attackType: def.attack.type,
          preferenceApplied: def.preferenceApplied,
        })),
        groundedExtension: Array.from(result.semantics.groundedExtension),
        justificationStatus: Object.fromEntries(result.semantics.justificationStatus),
        ...(acceptability ? { acceptability } : {}),
      },
      metadata: {
        inputNodes: inputGraph.nodes.length,
        inputEdges: inputGraph.edges.length,
        outputNodes: result.outputGraph.nodes.length,
        outputEdges: result.outputGraph.edges.length,
        argumentsConstructed: result.semantics.arguments.length,
        attacksComputed: result.semantics.attacks.length,
        defeatsResolved: result.semantics.defeats.length,
        groundedExtensionSize: result.semantics.groundedExtension.size,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error evaluating AIF graph:", error);
    return NextResponse.json(
      {
        error: "Failed to evaluate AIF graph",
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/aif/evaluate
 * 
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/aif/evaluate",
    method: "POST",
    description: "End-to-end AIF evaluation using ASPIC+ semantics",
    pipeline: [
      "1. Parse AIF graph (I-nodes, RA-nodes, CA-nodes, PA-nodes)",
      "2. Extract ASPIC+ theory (language, rules, KB, contraries, preferences)",
      "3. Construct all possible arguments",
      "4. Compute attack relations (undermining, rebutting, undercutting)",
      "5. Resolve defeats using preference orderings",
      "6. Compute grounded extension (justified arguments)",
      "7. Generate enriched AIF graph with CA-nodes for defeats",
    ],
    documentation: {
      requestBody: {
        graph: {
          nodes: "Array of AIF nodes (I/RA/CA/PA types)",
          edges: "Array of AIF edges (premise, conclusion, conflicting, etc.)",
        },
        debateId: "String identifier for the debate/deliberation",
      },
      response: {
        outputGraph: "Enriched AIF graph with computed defeat CA-nodes",
        semantics: {
          arguments: "All constructed ASPIC+ arguments",
          attacks: "All attack relations",
          defeats: "Successful attacks (after preferences)",
          groundedExtension: "Justified argument IDs",
          justificationStatus: "Status for each argument",
        },
        metadata: "Statistics about the evaluation",
      },
    },
    example: {
      request: {
        graph: {
          nodes: [
            { id: "I:1", nodeType: "I", content: "p", claimText: "p", debateId: "test" },
            { id: "I:2", nodeType: "I", content: "q", claimText: "q", debateId: "test" },
            {
              id: "RA:1",
              nodeType: "RA",
              content: "r1",
              schemeType: "defeasible",
              inferenceType: "generic",
              debateId: "test",
            },
            { id: "I:3", nodeType: "I", content: "r", claimText: "r", debateId: "test" },
          ],
          edges: [
            { id: "E:1", sourceId: "I:1", targetId: "RA:1", edgeType: "premise", debateId: "test" },
            { id: "E:2", sourceId: "I:2", targetId: "RA:1", edgeType: "premise", debateId: "test" },
            { id: "E:3", sourceId: "RA:1", targetId: "I:3", edgeType: "conclusion", debateId: "test" },
          ],
        },
        debateId: "test",
      },
      response: {
        outputGraph: "{ nodes: [...], edges: [...] }",
        semantics: "{ arguments: [...], attacks: [...], ... }",
        metadata: {
          inputNodes: 4,
          inputEdges: 3,
          outputNodes: "varies",
          outputEdges: "varies",
          argumentsConstructed: 3,
          attacksComputed: 0,
          defeatsResolved: 0,
          groundedExtensionSize: 3,
        },
      },
    },
  });
}
