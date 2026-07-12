export const dynamic = "force-dynamic";

/**
 * API Route: Quote Linking
 * 
 * Phase 2.3: Quote Nodes & Argument Quality Gates
 * 
 * POST   /api/quotes/[quoteId]/link - Link quote to claim or argument
 * DELETE /api/quotes/[quoteId]/link - Unlink quote from claim or argument
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { z } from "zod";
import {
  linkQuoteToClaim,
  unlinkQuoteFromClaim,
  linkQuoteToArgument,
  unlinkQuoteFromArgument,
} from "@/lib/quotes";
import { QuoteUsageType } from "@/lib/quotes/types";

// ─────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────

const UsageTypeEnum = z.enum([
  "EVIDENCE",
  "COUNTER",
  "CONTEXT",
  "DEFINITION",
  "METHODOLOGY",
]);

const LinkToClaimSchema = z.object({
  type: z.literal("claim"),
  claimId: z.string(),
  usageType: UsageTypeEnum,
  annotation: z.string().max(2000).optional(),
});

const LinkToArgumentSchema = z.object({
  type: z.literal("argument"),
  argumentId: z.string(),
  usageType: UsageTypeEnum,
  annotation: z.string().max(2000).optional(),
});

const LinkSchema = z.union([LinkToClaimSchema, LinkToArgumentSchema]);

const UnlinkFromClaimSchema = z.object({
  type: z.literal("claim"),
  claimId: z.string(),
});

const UnlinkFromArgumentSchema = z.object({
  type: z.literal("argument"),
  argumentId: z.string(),
});

const UnlinkSchema = z.union([UnlinkFromClaimSchema, UnlinkFromArgumentSchema]);

// ─────────────────────────────────────────────────────────
// POST - Link quote to claim or argument
// ─────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { quoteId: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const parsed = LinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Link based on type
    if (parsed.data.type === "claim") {
      // linkQuoteToClaim(quoteId, claimId, usageType, usageNote, userId)
      const link = await linkQuoteToClaim(
        params.quoteId,
        parsed.data.claimId,
        parsed.data.usageType as QuoteUsageType,
        parsed.data.annotation,
        userId
      );
      return NextResponse.json(link, { status: 201 });
    } else {
      // linkQuoteToArgument(quoteId, argumentId, usageType, premiseIndex, usageNote, userId)
      const link = await linkQuoteToArgument(
        params.quoteId,
        parsed.data.argumentId,
        parsed.data.usageType as QuoteUsageType,
        undefined, // premiseIndex - not in API schema yet
        parsed.data.annotation,
        userId
      );
      return NextResponse.json(link, { status: 201 });
    }
  } catch (error) {
    console.error("[POST /api/quotes/[quoteId]/link] Error:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message.includes("already linked")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }

    return NextResponse.json(
      { error: "Failed to link quote" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// DELETE - Unlink quote from claim or argument
// ─────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { quoteId: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    if (!(session?.user as { id?: string } | undefined)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const parsed = UnlinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Unlink based on type
    if (parsed.data.type === "claim") {
      await unlinkQuoteFromClaim(params.quoteId, parsed.data.claimId);
    } else {
      await unlinkQuoteFromArgument(params.quoteId, parsed.data.argumentId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/quotes/[quoteId]/link] Error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to unlink quote" },
      { status: 500 }
    );
  }
}
