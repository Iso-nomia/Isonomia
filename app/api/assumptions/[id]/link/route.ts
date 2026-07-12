// app/api/assumptions/[id]/link/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

const LinkSchema = z.object({
  derivationId: z.string().min(1, "derivationId is required"),
  weight: z.number().min(0).max(1).optional().default(1.0),
  inferredFrom: z.string().nullable().optional()
});

/**
 * POST /api/assumptions/[id]/link
 * 
 * Link an existing assumption to a specific derivation.
 * 
 * Request body:
 * {
 *   derivationId: string,
 *   weight?: number,           // Default 1.0 (range: 0..1)
 *   inferredFrom?: string      // Optional parent derivation ID
 * }
 * 
 * Response:
 * {
 *   ok: true,
 *   link: {
 *     id: string,              // DerivationAssumption.id
 *     derivationId: string,
 *     assumptionId: string,
 *     weight: number,
 *     inferredFrom: string | null,
 *     createdAt: string
 *   }
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const assumptionId = decodeURIComponent(String(params.id || "")).trim();
  
  if (!assumptionId) {
    return NextResponse.json(
      { error: "Missing assumption ID" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = LinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { derivationId, weight, inferredFrom } = parsed.data;

    // Validate assumption exists
    const assumption = await prisma.assumptionUse.findUnique({
      where: { id: assumptionId },
      select: { id: true, status: true }
    });

    if (!assumption) {
      return NextResponse.json(
        { error: "Assumption not found" },
        { status: 404 }
      );
    }

    // Validate derivation exists (ArgumentSupport for now)
    const derivation = await prisma.argumentSupport.findUnique({
      where: { id: derivationId },
      select: { id: true }
    });

    if (!derivation) {
      return NextResponse.json(
        { error: "Derivation not found" },
        { status: 404 }
      );
    }

    // Validate inferredFrom if provided
    if (inferredFrom) {
      const parentDeriv = await prisma.argumentSupport.findUnique({
        where: { id: inferredFrom },
        select: { id: true }
      });

      if (!parentDeriv) {
        return NextResponse.json(
          { error: "Invalid inferredFrom: derivation not found" },
          { status: 400 }
        );
      }
    }

    // Create or update link (idempotent)
    const link = await prisma.derivationAssumption.upsert({
      where: {
        derivationId_assumptionId: {
          derivationId,
          assumptionId
        }
      },
      create: {
        derivationId,
        assumptionId,
        weight: weight ?? 1.0,
        inferredFrom: inferredFrom ?? null
      },
      update: {
        weight: weight ?? 1.0,
        inferredFrom: inferredFrom ?? null
      }
    });

    return NextResponse.json(
      {
        ok: true,
        link: {
          id: link.id,
          derivationId: link.derivationId,
          assumptionId: link.assumptionId,
          weight: link.weight,
          inferredFrom: link.inferredFrom,
          createdAt: link.createdAt.toISOString()
        }
      },
      NO_STORE
    );
  } catch (error: any) {
    console.error("Error linking assumption to derivation:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
