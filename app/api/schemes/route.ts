export const dynamic = "force-dynamic";

// app/api/schemes/route.ts
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

export async function GET(_: NextRequest) {
  try {
    const schemes = await prisma.argumentScheme.findMany({
      // Q-018 Phase 0: exclude dialogue-meta entries from the default scheme picker.
      // They live in `DialogueMeta` and are surfaced via separate UI affordances.
      where: { kind: "argument-scheme" } as any,
      orderBy: { key: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        summary: true,
        description: true,
        purpose: true,
        source: true,
        materialRelation: true,
        reasoningType: true,
        ruleForm: true,
        conclusionType: true,
        slotHints: true,
        // Phase 0.2: Epistemic Mode
        epistemicMode: true,
        // Phase 0.3: Enhanced Metadata
        tags: true,
        examples: true,
        usageCount: true,
        difficulty: true,
        // Phase 0.5: Identification Conditions
        identificationConditions: true,
        whenToUse: true,
        premises: true,
        conclusion: true,
        cq: true, // Note: DB field is 'cq' not 'cqs'
        // Phase 6D: Clustering fields
        parentSchemeId: true,
        clusterTag: true,
        // Roadmap E1: behaviour fingerprint feeds the catalogue-health projection.
        fingerprint: true,
        // Q-018 discriminator
        kind: true,
      },
    });

    // Helper to recursively calculate total CQ count including inheritance
    const calculateTotalCQs = (schemeId: string, visited = new Set<string>()): number => {
      if (visited.has(schemeId)) return 0; // Prevent circular references
      visited.add(schemeId);

      const scheme = schemes.find((s) => s.id === schemeId);
      if (!scheme) return 0;

      const ownCQs = Array.isArray(scheme.cq) ? scheme.cq.length : 0;

      // Phase 3 step 13: inheritance is unconditional whenever a parent edge
      // exists; the `inheritCQs` opt-out has been retired.
      const schemeAny = scheme as any;
      if (schemeAny.parentSchemeId) {
        return ownCQs + calculateTotalCQs(schemeAny.parentSchemeId, visited);
      }

      return ownCQs;
    };

    // Parse and normalize to 'cqs' for API response + add calculated fields
    const peerIndex = buildFingerprintPeerIndex(
      schemes.map((s) => ({ key: s.key, fingerprint: (s as any).fingerprint })),
    );
    const items = schemes.map((s) => {
      const cqs = Array.isArray(s.cq) ? s.cq : [];
      const ownCQCount = cqs.length;
      const totalCQCount = calculateTotalCQs(s.id);

      return {
        ...s,
        cqs,
        ownCQCount,
        totalCQCount,
        catalogueHealth: computeCatalogueHealth(
          {
            key: s.key,
            kind: (s as any).kind,
            clusterTag: (s as any).clusterTag,
            fingerprint: (s as any).fingerprint,
          },
          peerIndex,
        ),
        cq: undefined, // Remove the DB field name from response
      };
    });

    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GET /api/schemes] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch schemes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.key || typeof body.key !== "string") {
      return NextResponse.json(
        { error: "Scheme key is required and must be a string" },
        { status: 400 }
      );
    }

    if (!/^[a-z_]+$/.test(body.key)) {
      return NextResponse.json(
        { error: "Scheme key must be lowercase with underscores only" },
        { status: 400 }
      );
    }

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Scheme name is required and must be a string" },
        { status: 400 }
      );
    }

    if (!body.summary || typeof body.summary !== "string") {
      return NextResponse.json(
        { error: "Scheme summary is required and must be a string" },
        { status: 400 }
      );
    }

    if (!body.cqs || !Array.isArray(body.cqs) || body.cqs.length === 0) {
      return NextResponse.json(
        { error: "At least one critical question is required" },
        { status: 400 }
      );
    }

    // Check for duplicate key
    const existing = await prisma.argumentScheme.findUnique({
      where: { key: body.key },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Scheme with key "${body.key}" already exists` },
        { status: 409 }
      );
    }

    // Phase 3 step 11/12: Spec 2 WF1/WF2/WF3 well-formedness validator.
    // See lib/schemes/validation/validatePresentation.ts and
    // Development and Ideation Documents/ARCHITECTURE/SCHEMES_IMPL_ADMIN_TIGHTENING.md §3.1.
    let parentShape: ParentSchemeShape | null = null;
    if (body.parentSchemeId) {
      const parentRow = await prisma.argumentScheme.findUnique({
        where: { id: body.parentSchemeId },
        include: { cqs: true },
      });
      if (!parentRow) {
        return NextResponse.json(
          { error: `parentSchemeId "${body.parentSchemeId}" does not exist` },
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
        key: body.key,
        parentSchemeId: body.parentSchemeId ?? null,
        cqs: (body.cqs as any[]).map((c) => ({
          cqKey: c.cqKey ?? null,
          text: c.text ?? null,
          attackType: c.attackType ?? null,
          targetScope: c.targetScope ?? null,
        })),
      },
      { parentScheme: parentShape },
    );
    if (!wfResult.ok) {
      return NextResponse.json(
        {
          error: "Scheme fails well-formedness checks (WF1/WF2/WF3).",
          violations: wfResult.errors,
          warnings: wfResult.warnings,
        },
        { status: 400 },
      );
    }

    // Create scheme
    const scheme = await prisma.argumentScheme.create({
      data: {
        key: body.key,
        name: body.name,
        summary: body.summary,
        description: body.description || null,
        purpose: body.purpose || null,
        source: body.source || null,
        materialRelation: body.materialRelation || null,
        reasoningType: body.reasoningType || null,
        ruleForm: body.ruleForm || null,
        conclusionType: body.conclusionType || null,
        // Phase 0.2: Epistemic Mode
        epistemicMode: body.epistemicMode || "FACTUAL",
        // Phase 0.3: Enhanced Metadata
        tags: body.tags || [],
        examples: body.examples || [],
        difficulty: body.difficulty || "intermediate",
        // Phase 0.5: Identification Conditions
        identificationConditions: body.identificationConditions || [],
        whenToUse: body.whenToUse || "",
        premises: body.premises || null, // Formal structure
        conclusion: body.conclusion || null, // Formal structure
        cq: body.cqs, // Store CQs in JSON field
        // Phase 6D: Clustering fields
        parentSchemeId: body.parentSchemeId || null,
        clusterTag: body.clusterTag || null,
        // Spec 4 phase 4b: non-redundancy override audit trail.
        nonRedundancyJustification:
          typeof body.nonRedundancyJustification === "string" &&
          body.nonRedundancyJustification.trim().length > 0
            ? body.nonRedundancyJustification.trim()
            : null,
      } as any,
    });

    // NEW: Create CriticalQuestion records (needed for CQ seeding in arguments)
    if (body.cqs && Array.isArray(body.cqs) && body.cqs.length > 0) {
      await prisma.criticalQuestion.createMany({
        data: body.cqs.map((cq: any) => ({
          schemeId: scheme.id,
          cqKey: cq.cqKey,
          text: cq.text,
          attackKind: cq.attackType || "UNDERCUTS",
          status: "open",
          attackType: cq.attackType || "UNDERCUTS",
          targetScope: cq.targetScope || "inference",
          // Phase 4 step 15 — Carneades default (Walton 2008 §11.1).
          // Admin may override via the dedicated form field; null is no longer accepted.
          premiseType: cq.premiseType || "ORDINARY",
        })) as any,
        skipDuplicates: true,
      });
    }

    // Phase 2 step 9: materialize behaviour fingerprint after CQs are written.
    // The partial unique index ArgumentScheme_argument_scheme_fingerprint_unique
    // will throw P2002 here if this scheme is behaviourally identical to an
    // existing one (returned to the caller as a 409 below).
    try {
      await recomputeSchemeFingerprint(scheme.id);
    } catch (e: any) {
      if (e?.code === "P2002") {
        await prisma.argumentScheme.delete({ where: { id: scheme.id } });
        return NextResponse.json(
          {
            error: `Scheme is behaviourally identical to an existing argument scheme (fingerprint collision).`,
          },
          { status: 409 },
        );
      }
      throw e;
    }

    return NextResponse.json(
      {
        success: true,
        schemeId: scheme.id,
        scheme,
        warnings: wfResult.warnings,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/schemes] Error:", error);
    return NextResponse.json(
      { error: "Failed to create scheme" },
      { status: 500 }
    );
  }
}
