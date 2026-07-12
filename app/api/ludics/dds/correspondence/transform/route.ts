export const dynamic = "force-dynamic";

/**
 * Transformation API Endpoint
 * 
 * Bidirectional Design ↔ Strategy transformations
 */

import { NextRequest, NextResponse } from "next/server";
import {
  designToStrategy,
  strategyToDesign,
  roundTripDesign,
  roundTripStrategy,
  verifyCorrespondence,
  getTransformationSummary,
} from "@/packages/ludics-core/dds/correspondence";
import type { Strategy } from "@/packages/ludics-core/dds/strategy";
import type { DesignForCorrespondence } from "@/packages/ludics-core/dds/correspondence";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sourceType,
      design,
      strategy,
      counterDesigns = [],
      operation = "transform",
    } = body as {
      sourceType: "design" | "strategy";
      design?: DesignForCorrespondence;
      strategy?: Strategy;
      counterDesigns?: DesignForCorrespondence[];
      operation?: "transform" | "round-trip" | "verify";
    };

    // Design → Strategy transformation
    if (sourceType === "design") {
      if (!design) {
        return NextResponse.json(
          { ok: false, error: "design is required for design transformation" },
          { status: 400 }
        );
      }

      if (operation === "round-trip") {
        const result = roundTripDesign(design, counterDesigns);

        return NextResponse.json({
          ok: true,
          operation: "round-trip",
          sourceType: "design",
          preserved: result.preserved,
          originalDesign: result.originalDesign,
          strategy: result.strategy,
          reconstructedDesign: result.reconstructedDesign,
        });
      }

      const { strategy: newStrategy, transform } = designToStrategy(design, counterDesigns);

      if (operation === "verify") {
        const correspondence = verifyCorrespondence(design, newStrategy, counterDesigns);

        return NextResponse.json({
          ok: true,
          operation: "verify",
          sourceType: "design",
          strategy: newStrategy,
          transform,
          correspondence,
          summary: getTransformationSummary(transform),
        });
      }

      return NextResponse.json({
        ok: true,
        operation: "transform",
        sourceType: "design",
        strategy: newStrategy,
        transform,
        summary: getTransformationSummary(transform),
      });
    }

    // Strategy → Design transformation
    if (sourceType === "strategy") {
      if (!strategy) {
        return NextResponse.json(
          { ok: false, error: "strategy is required for strategy transformation" },
          { status: 400 }
        );
      }

      if (operation === "round-trip") {
        const result = roundTripStrategy(strategy, counterDesigns);

        return NextResponse.json({
          ok: true,
          operation: "round-trip",
          sourceType: "strategy",
          preserved: result.preserved,
          originalStrategy: result.originalStrategy,
          design: result.design,
          reconstructedStrategy: result.reconstructedStrategy,
        });
      }

      const { design: newDesign, transform } = strategyToDesign(strategy);

      if (operation === "verify") {
        const correspondence = verifyCorrespondence(newDesign, strategy, counterDesigns);

        return NextResponse.json({
          ok: true,
          operation: "verify",
          sourceType: "strategy",
          design: newDesign,
          transform,
          correspondence,
          summary: getTransformationSummary(transform),
        });
      }

      return NextResponse.json({
        ok: true,
        operation: "transform",
        sourceType: "strategy",
        design: newDesign,
        transform,
        summary: getTransformationSummary(transform),
      });
    }

    return NextResponse.json(
      { ok: false, error: "Invalid sourceType. Must be 'design' or 'strategy'" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error in transformation:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to perform transformation" },
      { status: 500 }
    );
  }
}
