export const dynamic = "force-dynamic";

/**
 * Academic Claims Creation API
 * 
 * Phase 1.1: Paper-to-Claim Pipeline
 * 
 * Creates claims from AI extraction results or manual entry,
 * supporting batch creation and linking to sources.
 * 
 * @route POST /api/claims/academic - Create academic claims (single or batch)
 * @route PATCH /api/claims/academic - Verify/edit an AI-extracted claim
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { prisma } from "@/lib/prismaclient";
import { mintClaimMoid } from "@/lib/ids/mintMoid";
import { mintUrn } from "@/lib/ids/urn";
import { AcademicClaimType } from "@prisma/client";
import { z } from "zod";
import type { EntityCode } from "@/lib/ids/urn";

// ─────────────────────────────────────────────────────────
// Request Schemas
// ─────────────────────────────────────────────────────────

const CreateAcademicClaimSchema = z.object({
  text: z.string().min(10).max(2000),
  sourceId: z.string(),
  academicClaimType: z.nativeEnum(AcademicClaimType).optional(),
  pageNumber: z.number().int().positive().optional(),
  sectionName: z.string().optional(),
  paragraphIndex: z.number().int().positive().optional(),
  supportingQuote: z.string().optional(),
  quoteLocator: z.string().optional(),
  
  // AI extraction metadata
  extractedByAI: z.boolean().default(false),
  aiConfidence: z.number().min(0).max(1).optional(),
  
  // Optional deliberation link
  deliberationId: z.string().optional(),
});

const BatchCreateClaimsSchema = z.object({
  sourceId: z.string(),
  claims: z.array(CreateAcademicClaimSchema.omit({ sourceId: true })),
  deliberationId: z.string().optional(),
});

const VerifyClaimSchema = z.object({
  claimId: z.string(),
  verified: z.boolean().default(true),
  editedText: z.string().optional(),
  editedType: z.nativeEnum(AcademicClaimType).optional(),
});

// ─────────────────────────────────────────────────────────
// POST Handler - Create Claims
// ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    
    // Check if batch or single creation
    if (body.claims && Array.isArray(body.claims)) {
      return handleBatchCreation(body, userId.toString());
    } else {
      return handleSingleCreation(body, userId.toString());
    }
  } catch (error) {
    console.error("[claims/academic] Creation error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Handle single claim creation
 */
async function handleSingleCreation(body: unknown, userId: string) {
  const input = CreateAcademicClaimSchema.parse(body);
  
  // Verify source exists
  const source = await prisma.source.findUnique({
    where: { id: input.sourceId },
    select: { id: true, title: true },
  });
  
  if (!source) {
    return NextResponse.json(
      { error: "Source not found" },
      { status: 404 }
    );
  }
  
  // Generate moid for deduplication
  const moid = mintClaimMoid(input.text);
  
  // Check for existing claim with same moid
  const existing = await prisma.claim.findUnique({
    where: { moid },
    include: { source: true },
  });
  
  if (existing) {
    // If it exists but isn't linked to a source, link it
    if (!existing.sourceId && input.sourceId) {
      const updated = await prisma.claim.update({
        where: { id: existing.id },
        data: {
          sourceId: input.sourceId,
          academicClaimType: input.academicClaimType,
          pageNumber: input.pageNumber,
          sectionName: input.sectionName,
          supportingQuote: input.supportingQuote,
          quoteLocator: input.quoteLocator,
        },
        include: { source: true },
      });
      return NextResponse.json({
        success: true,
        claim: updated,
        created: false,
        message: "Existing claim updated with source link",
      });
    }
    
    return NextResponse.json({
      success: true,
      claim: existing,
      created: false,
      message: "Claim already exists",
    });
  }
  
  // Create URN
  const urnValue = mintUrn("claim" as EntityCode, moid);
  
  // Create the claim
  const claim = await prisma.claim.create({
    data: {
      text: input.text,
      createdById: userId,
      moid,
      sourceId: input.sourceId,
      academicClaimType: input.academicClaimType,
      pageNumber: input.pageNumber,
      sectionName: input.sectionName,
      paragraphIndex: input.paragraphIndex,
      supportingQuote: input.supportingQuote,
      quoteLocator: input.quoteLocator,
      extractedByAI: input.extractedByAI,
      aiConfidence: input.aiConfidence,
      humanVerified: !input.extractedByAI, // Manual entries are auto-verified
      ...(input.deliberationId 
        ? { deliberationId: input.deliberationId } 
        : {}),
      urns: {
        create: {
          entityType: "claim",
          urn: urnValue,
        },
      },
    },
    include: {
      source: {
        select: {
          id: true,
          title: true,
          doi: true,
        },
      },
    },
  });
  
  return NextResponse.json(
    {
      success: true,
      claim,
      created: true,
      message: "Claim created successfully",
    },
    { status: 201 }
  );
}

/**
 * Handle batch claim creation from AI extraction
 */
async function handleBatchCreation(body: unknown, userId: string) {
  const input = BatchCreateClaimsSchema.parse(body);
  
  // Verify source exists
  const source = await prisma.source.findUnique({
    where: { id: input.sourceId },
    select: { id: true, title: true },
  });
  
  if (!source) {
    return NextResponse.json(
      { error: "Source not found" },
      { status: 404 }
    );
  }
  
  const createdClaims: any[] = [];
  const skippedClaims: { text: string; reason: string }[] = [];
  
  // Process each claim
  for (const claimData of input.claims) {
    const moid = mintClaimMoid(claimData.text);
    
    // Check for existing
    const existing = await prisma.claim.findUnique({
      where: { moid },
    });
    
    if (existing) {
      skippedClaims.push({
        text: claimData.text.slice(0, 50) + "...",
        reason: "Already exists",
      });
      continue;
    }
    
    const urnValue = mintUrn("claim" as EntityCode, moid);
    
    const claim = await prisma.claim.create({
      data: {
        text: claimData.text,
        createdById: userId,
        moid,
        sourceId: input.sourceId,
        academicClaimType: claimData.academicClaimType,
        pageNumber: claimData.pageNumber,
        sectionName: claimData.sectionName,
        paragraphIndex: claimData.paragraphIndex,
        supportingQuote: claimData.supportingQuote,
        quoteLocator: claimData.quoteLocator,
        extractedByAI: claimData.extractedByAI ?? true,
        aiConfidence: claimData.aiConfidence,
        humanVerified: false,
        ...(input.deliberationId 
          ? { deliberationId: input.deliberationId } 
          : {}),
        urns: {
          create: {
            entityType: "claim",
            urn: urnValue,
          },
        },
      },
    });
    
    createdClaims.push(claim);
  }
  
  return NextResponse.json(
    {
      success: true,
      claims: createdClaims,
      created: createdClaims.length,
      skipped: skippedClaims,
      message: `Created ${createdClaims.length} claims, skipped ${skippedClaims.length}`,
    },
    { status: 201 }
  );
}

// ─────────────────────────────────────────────────────────
// PATCH Handler - Verify Claims
// ─────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const input = VerifyClaimSchema.parse(body);
    
    // Find the claim
    const claim = await prisma.claim.findUnique({
      where: { id: input.claimId },
    });
    
    if (!claim) {
      return NextResponse.json(
        { error: "Claim not found" },
        { status: 404 }
      );
    }
    
    // Update the claim
    const updatedClaim = await prisma.claim.update({
      where: { id: input.claimId },
      data: {
        ...(input.editedText ? { text: input.editedText } : {}),
        ...(input.editedType ? { academicClaimType: input.editedType } : {}),
        humanVerified: input.verified,
        verifiedById: input.verified ? userId.toString() : null,
        verifiedAt: input.verified ? new Date() : null,
      },
      include: {
        source: {
          select: {
            id: true,
            title: true,
            doi: true,
          },
        },
      },
    });
    
    return NextResponse.json({
      success: true,
      claim: updatedClaim,
      message: input.verified ? "Claim verified" : "Claim updated",
    });
  } catch (error) {
    console.error("[claims/academic] Verification error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
