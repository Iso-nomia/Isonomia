export const dynamic = "force-dynamic";

/**
 * API Endpoint: Validate Transposition Closure
 * 
 * POST /api/aspic/validate-transposition
 * 
 * Validates whether a set of strict rules satisfies transposition closure
 * and returns missing transposed rules if any.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateTranspositionClosure } from "@/lib/aspic/transposition";
import { Rule } from "@/lib/aspic/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rules } = body as { rules: Rule[] };
    
    // Validation
    if (!rules || !Array.isArray(rules)) {
      return NextResponse.json(
        { error: "Missing or invalid 'rules' field. Expected array of Rule objects." },
        { status: 400 }
      );
    }
    
    // Filter to only strict rules
    const strictRules = rules.filter(r => r.type === "strict");
    
    if (strictRules.length === 0) {
      return NextResponse.json({
        isClosed: true,
        missingRules: [],
        totalRequired: 0,
        totalPresent: 0,
        message: "✅ No strict rules to validate",
      });
    }
    
    // Validate transposition closure
    const validation = validateTranspositionClosure(strictRules);
    
    // Log validation result
    console.log(`[validate-transposition] Validated ${strictRules.length} strict rules:`);
    console.log(`  - Closed: ${validation.isClosed}`);
    console.log(`  - Required: ${validation.totalRequired}`);
    console.log(`  - Present: ${validation.totalPresent}`);
    console.log(`  - Missing: ${validation.missingRules.length}`);
    
    return NextResponse.json({
      isClosed: validation.isClosed,
      missingRules: validation.missingRules,
      totalRequired: validation.totalRequired,
      totalPresent: validation.totalPresent,
      message: validation.message,
    });
  } catch (error) {
    console.error("[validate-transposition] Error:", error);
    
    return NextResponse.json(
      { 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
