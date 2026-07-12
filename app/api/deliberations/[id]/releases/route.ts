export const dynamic = "force-dynamic";

/**
 * API Route: Deliberation Releases
 * 
 * Phase 2.1: Debate Releases & Versioned Memory
 * 
 * POST /api/deliberations/[id]/releases - Create a new release
 * GET  /api/deliberations/[id]/releases - List all releases
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { z } from "zod";
import { createRelease, listReleases } from "@/lib/releases";

// ─────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────

const CreateReleaseSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  versionType: z.enum(["major", "minor", "patch"]).optional().default("patch"),
});

// ─────────────────────────────────────────────────────────
// POST - Create a new release
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

    const deliberationId = params.id;

    // 2. Parse body
    const body = await req.json();
    const parsed = CreateReleaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, versionType } = parsed.data;

    // 3. Create release
    const release = await createRelease({
      deliberationId,
      title,
      description,
      versionType,
      createdById: (session!.user as any).id,
    });

    return NextResponse.json(
      {
        id: release.id,
        version: release.version,
        title: release.title,
        description: release.description,
        citationUri: release.citationUri,
        bibtex: release.bibtex,
        stats: {
          claims: release.claimSnapshot.stats,
          arguments: release.argumentSnapshot.stats,
        },
        changelog: release.changelog
          ? {
              summary: release.changelog.summary,
              text: release.changelogText,
            }
          : null,
        createdAt: release.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/deliberations/[id]/releases] Error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to create release" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// GET - List all releases
// ─────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deliberationId = params.id;

    const releases = await listReleases(deliberationId);

    return NextResponse.json({
      releases,
      total: releases.length,
    });
  } catch (error) {
    console.error("[GET /api/deliberations/[id]/releases] Error:", error);
    return NextResponse.json(
      { error: "Failed to list releases" },
      { status: 500 }
    );
  }
}
