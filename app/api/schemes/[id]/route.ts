export const dynamic = "force-dynamic";

// app/api/schemes/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { recomputeSchemeFingerprint } from "@/lib/schemes/persistence/recomputeSchemeFingerprint";
import {
  validateSchemePresentation,
  type DraftCq,
  type ParentSchemeShape,
} from "@/lib/schemes/validation/validatePresentation";
import {
  buildFingerprintPeerIndex,
  computeCatalogueHealth,
} from "@/lib/schemes/catalogueHealth";

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const scheme = await prisma.argumentScheme.findUnique({
      where: { id: params.id },
      include: {
        cqs: true, // Include related CriticalQuestion records
      },
    });

    if (!scheme) {
      return NextResponse.json(
        { error: "Scheme not found" },
        { status: 404 }
      );
    }

    // Roadmap E1: attach the derived catalogue-health projection. Collision
    // detection needs the fingerprint of every argument-pattern peer, so load a
    // lightweight (key, fingerprint) projection over the catalogue.
    const peers = await prisma.argumentScheme.findMany({
      where: { kind: "argument-scheme" } as any,
      select: { key: true, fingerprint: true } as any,
    });
    const peerIndex = buildFingerprintPeerIndex(peers as any);
    const catalogueHealth = computeCatalogueHealth(
      {
        key: scheme.key,
        kind: (scheme as any).kind,
        clusterTag: (scheme as any).clusterTag,
        fingerprint: (scheme as any).fingerprint,
      },
      peerIndex,
    );

    return NextResponse.json({ scheme: { ...scheme, catalogueHealth } });
  } catch (error) {
    console.error(`[GET /api/schemes/${params.id}] Error:`, error);
    return NextResponse.json(
      { error: "Failed to fetch scheme" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();

    // Validate fields (key cannot be changed)
    if (body.key) {
      return NextResponse.json(
        { error: "Scheme key cannot be modified" },
        { status: 400 }
      );
    }

    if (body.name && typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Scheme name must be a string" },
        { status: 400 }
      );
    }

    if (body.summary && typeof body.summary !== "string") {
      return NextResponse.json(
        { error: "Scheme summary must be a string" },
        { status: 400 }
      );
    }

    if (body.cqs && (!Array.isArray(body.cqs) || body.cqs.length === 0)) {
      return NextResponse.json(
        { error: "At least one critical question is required" },
        { status: 400 }
      );
    }

    // Check if scheme exists
    const existing = await prisma.argumentScheme.findUnique({
      where: { id: params.id },
      include: { cqs: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Scheme not found" },
        { status: 404 }
      );
    }

    // Phase 3 step 11/12: Spec 2 WF1/WF2/WF3 well-formedness validator.
    // Merge incoming body with current row for fields not being updated, then
    // validate the *resulting* draft.
    const effectiveParentId =
      body.parentSchemeId !== undefined ? body.parentSchemeId : (existing as any).parentSchemeId ?? null;
    const effectiveCqs: DraftCq[] = (
      body.cqs !== undefined
        ? (body.cqs as any[])
        : ((existing as any).cqs ?? [])
    ).map((c: any) => ({
      cqKey: c.cqKey ?? null,
      text: c.text ?? null,
      attackType: c.attackType ?? null,
      targetScope: c.targetScope ?? null,
    }));
    let parentShape: ParentSchemeShape | null = null;
    if (effectiveParentId) {
      const parentRow = await prisma.argumentScheme.findUnique({
        where: { id: effectiveParentId },
        include: { cqs: true },
      });
      if (!parentRow) {
        return NextResponse.json(
          { error: `parentSchemeId "${effectiveParentId}" does not exist` },
          { status: 400 },
        );
      }
      parentShape = {
        id: parentRow.id,
        key: parentRow.key,
        cqs: (parentRow as any).cqs.map((c: any) => ({
          cqKey: c.cqKey,
          text: c.text,
          attackType: c.attackType,
          targetScope: c.targetScope,
        })) as DraftCq[],
      };
    }
    const wfResult = validateSchemePresentation(
      {
        key: existing.key,
        parentSchemeId: effectiveParentId,
        cqs: effectiveCqs,
      },
      { parentScheme: parentShape },
    );
    if (!wfResult.ok) {
      return NextResponse.json(
        {
          error: "Edit fails well-formedness checks (WF1/WF2/WF3).",
          violations: wfResult.errors,
          warnings: wfResult.warnings,
        },
        { status: 400 },
      );
    }

    // Update scheme
    const updated = await prisma.argumentScheme.update({
      where: { id: params.id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        summary: body.summary !== undefined ? body.summary : undefined,
        description: body.description !== undefined ? body.description : undefined,
        purpose: body.purpose !== undefined ? body.purpose : undefined,
        source: body.source !== undefined ? body.source : undefined,
        materialRelation: body.materialRelation !== undefined ? body.materialRelation : undefined,
        reasoningType: body.reasoningType !== undefined ? body.reasoningType : undefined,
        ruleForm: body.ruleForm !== undefined ? body.ruleForm : undefined,
        conclusionType: body.conclusionType !== undefined ? body.conclusionType : undefined,
        premises: body.premises !== undefined ? body.premises : undefined,
        conclusion: body.conclusion !== undefined ? body.conclusion : undefined,
        cq: body.cqs !== undefined ? body.cqs : undefined,
        // Phase 6D: Clustering fields
        parentSchemeId: body.parentSchemeId !== undefined ? body.parentSchemeId : undefined,
        clusterTag: body.clusterTag !== undefined ? body.clusterTag : undefined,
        // Spec 4 phase 4b: non-redundancy override audit trail.
        nonRedundancyJustification:
          body.nonRedundancyJustification !== undefined
            ? typeof body.nonRedundancyJustification === "string" &&
              body.nonRedundancyJustification.trim().length > 0
              ? body.nonRedundancyJustification.trim()
              : null
            : undefined,
      } as any,
    });

    // NEW: Sync CriticalQuestion records if CQs were updated
    if (body.cqs !== undefined && Array.isArray(body.cqs)) {
      // Delete existing CQ records for this scheme
      await prisma.criticalQuestion.deleteMany({
        where: { schemeId: params.id },
      });

      // Create new CQ records
      if (body.cqs.length > 0) {
        await prisma.criticalQuestion.createMany({
          data: body.cqs.map((cq: any) => ({
            schemeId: params.id,
            cqKey: cq.cqKey,
            text: cq.text,
            attackKind: cq.attackType || "UNDERCUTS",
            status: "open",
            attackType: cq.attackType || "UNDERCUTS",
            targetScope: cq.targetScope || "inference",
            // Phase 4 step 15 — Carneades default (Walton 2008 §11.1).
            premiseType: cq.premiseType || "ORDINARY",
          })) as any,
          skipDuplicates: true,
        });
      }
    }

    // Phase 2 step 9: recompute behaviour fingerprint after any structural edit.
    // The partial unique index ArgumentScheme_argument_scheme_fingerprint_unique
    // throws P2002 if the edit collapses this row onto another's behaviour.
    try {
      await recomputeSchemeFingerprint(params.id);
    } catch (e: any) {
      if (e?.code === "P2002") {
        return NextResponse.json(
          {
            error: `Edit would make this scheme behaviourally identical to another argument scheme (fingerprint collision).`,
          },
          { status: 409 },
        );
      }
      throw e;
    }

    return NextResponse.json({ success: true, scheme: updated, warnings: wfResult.warnings });
  } catch (error) {
    console.error(`[PUT /api/schemes/${params.id}] Error:`, error);
    return NextResponse.json(
      { error: "Failed to update scheme" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if scheme exists
    const existing = await prisma.argumentScheme.findUnique({
      where: { id: params.id },
      include: {
        Argument: { take: 1 }, // Check if any arguments use this scheme
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Scheme not found" },
        { status: 404 }
      );
    }

    // Prevent deletion if in use
    if (existing.Argument.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete scheme: it is in use by existing arguments" },
        { status: 409 }
      );
    }

    // Delete scheme
    await prisma.argumentScheme.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[DELETE /api/schemes/${params.id}] Error:`, error);
    return NextResponse.json(
      { error: "Failed to delete scheme" },
      { status: 500 }
    );
  }
}
