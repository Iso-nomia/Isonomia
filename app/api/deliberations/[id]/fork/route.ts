export const dynamic = "force-dynamic";

/**
 * API Route: Deliberation Forks
 * 
 * Phase 2.2: Fork/Branch/Merge for Deliberations
 * 
 * POST /api/deliberations/[id]/fork - Create a fork
 * GET  /api/deliberations/[id]/fork - List all forks
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { z } from "zod";
import { createFork, listForks, getForkTree } from "@/lib/forks";

// ─────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────

const ForkTypeEnum = z.enum([
  "ASSUMPTION_VARIANT",
  "METHODOLOGICAL",
  "SCOPE_EXTENSION",
  "ADVERSARIAL",
  "EDUCATIONAL",
  "ARCHIVAL",
]);

const CreateForkSchema = z.object({
  title: z.string().min(1).max(200),
  forkReason: z.string().min(1).max(1000),
  forkType: ForkTypeEnum,
  description: z.string().max(2000).optional(),
  importAllClaims: z.boolean().optional().default(true),
  claimIdsToImport: z.array(z.string()).optional(),
  importAllArguments: z.boolean().optional().default(true),
  argumentIdsToImport: z.array(z.string()).optional(),
  fromReleaseId: z.string().optional(),
});

// ─────────────────────────────────────────────────────────
// POST - Create a fork
// ─────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parentDeliberationId = params.id;

    // 2. Parse body
    const body = await req.json();
    const parsed = CreateForkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Create fork
    const fork = await createFork(
      {
        parentDeliberationId,
        ...parsed.data,
      },
      (session!.user as any).id
    );

    return NextResponse.json(fork, { status: 201 });
  } catch (error) {
    console.error("[POST /api/deliberations/[id]/fork] Error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to create fork" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// GET - List forks or get fork tree
// ─────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;
    const url = new URL(req.url);
    const includeTree = url.searchParams.get("tree") === "true";

    if (includeTree) {
      // Return full fork tree
      const tree = await getForkTree(deliberationId);
      return NextResponse.json({ tree });
    } else {
      // Return list of direct forks
      const forks = await listForks(deliberationId);
      return NextResponse.json({
        forks,
        total: forks.length,
      });
    }
  } catch (error) {
    console.error("[GET /api/deliberations/[id]/fork] Error:", error);
    return NextResponse.json(
      { error: "Failed to list forks" },
      { status: 500 }
    );
  }
}
