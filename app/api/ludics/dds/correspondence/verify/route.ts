export const dynamic = "force-dynamic";

/**
 * Isomorphism Verification API Endpoint
 * 
 * Check all four isomorphisms for Design ↔ Strategy correspondence
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkAllIsomorphisms,
  allIsomorphismsHold,
  checkPlaysViewsIsomorphism,
  checkViewsPlaysIsomorphism,
  checkDispChIsomorphism,
  checkChDispIsomorphism,
} from "@/packages/ludics-core/dds/correspondence";
import type { Strategy } from "@/packages/ludics-core/dds/strategy";
import type { DesignForCorrespondence } from "@/packages/ludics-core/dds/correspondence";
import type { View } from "@/packages/ludics-core/dds";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      design, 
      strategy, 
      counterDesigns = [],
      views,
      checkType = "all" 
    } = body as {
      design?: DesignForCorrespondence;
      strategy?: Strategy;
      counterDesigns?: DesignForCorrespondence[];
      views?: View[];
      checkType?: "all" | "plays-views" | "views-plays" | "disp-ch" | "ch-disp";
    };

    // Handle specific isomorphism checks
    if (checkType === "plays-views") {
      if (!strategy) {
        return NextResponse.json(
          { ok: false, error: "strategy is required for plays-views check" },
          { status: 400 }
        );
      }

      const result = checkPlaysViewsIsomorphism(strategy);

      return NextResponse.json({
        ok: true,
        checkType: "plays-views",
        result,
        holds: result.holds,
      });
    }

    if (checkType === "views-plays") {
      if (!views) {
        return NextResponse.json(
          { ok: false, error: "views is required for views-plays check" },
          { status: 400 }
        );
      }

      const result = checkViewsPlaysIsomorphism(views);

      return NextResponse.json({
        ok: true,
        checkType: "views-plays",
        result,
        holds: result.holds,
      });
    }

    if (checkType === "disp-ch") {
      if (!strategy) {
        return NextResponse.json(
          { ok: false, error: "strategy is required for disp-ch check" },
          { status: 400 }
        );
      }

      const result = checkDispChIsomorphism(strategy, counterDesigns);

      return NextResponse.json({
        ok: true,
        checkType: "disp-ch",
        result,
        holds: result.holds,
      });
    }

    if (checkType === "ch-disp") {
      if (!design) {
        return NextResponse.json(
          { ok: false, error: "design is required for ch-disp check" },
          { status: 400 }
        );
      }

      const result = checkChDispIsomorphism(design, counterDesigns);

      return NextResponse.json({
        ok: true,
        checkType: "ch-disp",
        result,
        holds: result.holds,
      });
    }

    // Check all isomorphisms
    if (!design || !strategy) {
      return NextResponse.json(
        { ok: false, error: "Both design and strategy are required for full verification" },
        { status: 400 }
      );
    }

    const isomorphisms = checkAllIsomorphisms(design, strategy, counterDesigns);
    const allHold = allIsomorphismsHold(isomorphisms);

    return NextResponse.json({
      ok: true,
      checkType: "all",
      isomorphisms,
      allHold,
      summary: {
        playsViews: isomorphisms.playsViews.holds,
        viewsPlays: isomorphisms.viewsPlays.holds,
        dispCh: isomorphisms.dispCh.holds,
        chDisp: isomorphisms.chDisp.holds,
      },
    });
  } catch (error: any) {
    console.error("Error verifying isomorphisms:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to verify isomorphisms" },
      { status: 500 }
    );
  }
}
