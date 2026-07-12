export const dynamic = "force-dynamic";

// app/api/aspic/cq-attack/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cqToAspicAttack } from "@/lib/aspic/cqMapping";
import type { Argument, ArgumentationTheory } from "@/lib/aspic/types";
import { prisma } from "@/lib/prismaclient";

/**
 * POST /api/aspic/cq-attack
 * 
 * Translate a Critical Question into an ASPIC+ attack
 * 
 * This endpoint:
 * 1. Fetches CQ metadata from database (attackType, targetScope, aspicMapping)
 * 2. Fetches target argument structure
 * 3. Constructs attacking argument using cqToAspicAttack()
 * 4. Returns the attack relation and metadata
 * 
 * Request body:
 * {
 *   cqId: string,                    // CQ database ID
 *   targetArgumentId: string,        // Target argument ID
 *   deliberationId: string,          // Context for fetching data
 *   theory?: ArgumentationTheory     // Optional: provide theory if not in DB
 * }
 * 
 * Response:
 * {
 *   attack: {
 *     attacker: Argument,
 *     attacked: Argument,
 *     type: 'undermining' | 'rebutting' | 'undercutting',
 *     target: { premise?, subArgument?, ruleId? }
 *   },
 *   metadata: {
 *     cqKey: string,
 *     cqText: string,
 *     schemeKey: string,
 *     attackType: string,
 *     targetScope: string,
 *     aspicMapping: object
 *   },
 *   reason?: string  // If attack could not be constructed
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate input
    if (!body.cqId || typeof body.cqId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'cqId' field" },
        { status: 400 }
      );
    }

    if (!body.targetArgumentId || typeof body.targetArgumentId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'targetArgumentId' field" },
        { status: 400 }
      );
    }

    if (!body.deliberationId || typeof body.deliberationId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'deliberationId' field" },
        { status: 400 }
      );
    }

    // Fetch CQ from database
    const cqStatus = await prisma.cQStatus.findFirst({
      where: {
        id: body.cqId,
      },
    });

    if (!cqStatus) {
      return NextResponse.json(
        { error: `CQ not found: ${body.cqId}` },
        { status: 404 }
      );
    }

    // Fetch ArgumentScheme to get CQ metadata
    const scheme = await prisma.argumentScheme.findFirst({
      where: { id: cqStatus.schemeKey }, // Using id field
    });

    if (!scheme || !scheme.cq) {
      return NextResponse.json(
        { error: `Scheme not found or has no CQs: ${cqStatus.schemeKey}` },
        { status: 404 }
      );
    }

    // Find the specific CQ in the scheme
    const cqArray = scheme.cq as Array<{
      cqKey: string;
      text: string;
      attackType?: string;
      targetScope?: string;
      aspicMapping?: any;
    }>;

    const cqData = cqArray.find((cq) => cq.cqKey === cqStatus.cqKey);

    if (!cqData) {
      return NextResponse.json(
        { error: `CQ not found in scheme: ${cqStatus.cqKey}` },
        { status: 404 }
      );
    }

    // TODO: Fetch or construct target argument
    // For now, require it in the request body
    if (!body.targetArgument) {
      return NextResponse.json(
        {
          error: "Target argument must be provided in request body",
          message: "Future enhancement: fetch from argument graph database",
        },
        { status: 400 }
      );
    }

    // Reconstruct target argument
    const targetArgument: Argument = {
      id: body.targetArgument.id,
      premises: new Set(body.targetArgument.premises || []),
      conclusion: body.targetArgument.conclusion,
      defeasibleRules: new Set(body.targetArgument.defeasibleRules || []),
      topRule: body.targetArgument.topRule,
      subArguments: body.targetArgument.subArguments || [],
      structure: body.targetArgument.structure,
    };

    // Construct theory (if not provided)
    const theory: ArgumentationTheory = body.theory
      ? {
          system: {
            language: new Set(body.theory.language),
            contraries: new Map(
              Object.entries(body.theory.contraries || {}).map(([k, v]) => [
                k,
                new Set(v as string[]),
              ])
            ),
            strictRules: body.theory.strictRules || [],
            defeasibleRules: body.theory.defeasibleRules || [],
            ruleNames: new Map(
              Object.entries(body.theory.ruleNames || {})
            ),
          },
          knowledgeBase: {
            axioms: new Set(body.theory.axioms || []),
            premises: new Set(body.theory.premises || []),
            assumptions: new Set(body.theory.assumptions || []),
            premisePreferences: body.theory.premisePreferences || [],
            rulePreferences: body.theory.rulePreferences || [],
          },
        }
      : // Default minimal theory
        {
          system: {
            language: new Set([targetArgument.conclusion]),
            contraries: new Map(),
            strictRules: [],
            defeasibleRules: [],
            ruleNames: new Map(),
          },
          knowledgeBase: {
            axioms: new Set(),
            premises: new Set(targetArgument.premises),
            assumptions: new Set(),
            premisePreferences: [],
            rulePreferences: [],
          },
        };

    // Construct CQ attack
    const result = cqToAspicAttack(
      {
        cqKey: cqData.cqKey,
        text: cqData.text,
        attackType: (cqData.attackType || "UNDERMINES") as "UNDERMINES" | "UNDERCUTS" | "REBUTS",
        targetScope: (cqData.targetScope || "premise") as "premise" | "inference" | "conclusion",
        aspicMapping: cqData.aspicMapping,
      },
      targetArgument,
      theory
    );

    if (!result || !result.attack || !result.attackingArgument) {
      return NextResponse.json(
        {
          success: false,
          reason: result?.reason || "Attack could not be constructed",
          cqMetadata: {
            cqKey: cqData.cqKey,
            cqText: cqData.text,
            attackType: cqData.attackType,
            targetScope: cqData.targetScope,
          },
        },
        { status: 200 }
      );
    }

    // Serialize response
    const response = {
      success: true,
      attack: {
        attackerId: result.attackingArgument.id,
        attackedId: result.targetArgument.id,
        type: result.attack.type,
        target: result.attack.target,
        attacker: {
          id: result.attackingArgument.id,
          premises: Array.from(result.attackingArgument.premises),
          conclusion: result.attackingArgument.conclusion,
          defeasibleRules: Array.from(result.attackingArgument.defeasibleRules),
          structure: result.attackingArgument.structure,
        },
        attacked: {
          id: result.targetArgument.id,
          premises: Array.from(result.targetArgument.premises),
          conclusion: result.targetArgument.conclusion,
          defeasibleRules: Array.from(result.targetArgument.defeasibleRules),
          structure: result.targetArgument.structure,
        },
      },
      metadata: {
        cqKey: cqData.cqKey,
        cqText: cqData.text,
        schemeKey: cqStatus.schemeKey,
        attackType: cqData.attackType,
        targetScope: cqData.targetScope,
        aspicMapping: cqData.aspicMapping,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error constructing CQ attack:", error);
    return NextResponse.json(
      {
        error: "Failed to construct CQ attack",
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/aspic/cq-attack
 * 
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: "/api/aspic/cq-attack",
    method: "POST",
    description: "Translate a Critical Question into an ASPIC+ attack",
    documentation: {
      requestBody: {
        cqId: "Database ID of the CQ (from CQStatus table)",
        targetArgumentId: "ID of the argument being questioned",
        deliberationId: "Deliberation context",
        targetArgument: "Target argument structure (required for now)",
        theory: "Optional: ASPIC+ theory context",
      },
      response: {
        success: "Boolean indicating if attack was constructed",
        attack: "The constructed attack relation",
        metadata: "CQ and scheme metadata",
        reason: "Explanation if attack failed",
      },
    },
    features: [
      "Fetches CQ metadata from database",
      "Uses aspicMapping for formal attack construction",
      "Supports undermining, rebutting, and undercutting",
      "Returns attacking argument structure",
    ],
  });
}
