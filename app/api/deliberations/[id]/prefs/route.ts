export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prismaclient';

// Default audience profiles (tune to taste)
const DEFAULTS = {
  community:   { minRelevance: 0.50, minSufficiency: 0.50, minAcceptability: 0.50 },
  policy:      { minRelevance: 0.60, minSufficiency: 0.65, minAcceptability: 0.65 },
  scientific:  { minRelevance: 0.60, minSufficiency: 0.75, minAcceptability: 0.75 },
} as const;

const ProfileEnum = z.enum(['community', 'policy', 'scientific']);
const OverrideSchema = z.object({
  minRelevance:     z.number().min(0).max(1).optional(),
  minSufficiency:   z.number().min(0).max(1).optional(),
  minAcceptability: z.number().min(0).max(1).optional(),
}).partial();

const PutBody = z.object({
  profile: ProfileEnum,
  override: OverrideSchema.optional(),
});

// ---------------- GET ----------------
// Returns current profile + thresholds; falls back to defaults if not set.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deliberationId = params.id;

    // Try to read prefs row; if missing, respond with defaults ("community")
    const row = await prisma.deliberationPref.findUnique({
      where: { deliberationId },
      select: {
        profile: true,
        minRelevance: true,
        minSufficiency: true,
        minAcceptability: true,
        updatedAt: true,
      },
    }).catch(() => null);

    if (!row) {
      const d = DEFAULTS.community;
      return NextResponse.json({
        ok: true,
        profile: 'community',
        thresholds: d,
        // When you first GET, you may want to auto-create a row. If so, uncomment below.
        // created: true,
      });
    }

    return NextResponse.json({
      ok: true,
      profile: row.profile,
      thresholds: {
        minRelevance: row.minRelevance,
        minSufficiency: row.minSufficiency,
        minAcceptability: row.minAcceptability,
      },
      updatedAt: row.updatedAt,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'PREFS_GET_FAILED' },
      { status: 500 }
    );
  }
}

// ---------------- PUT ----------------
// Upserts profile and thresholds (defaults merged with optional override).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deliberationId = params.id;
    const body = await req.json().catch(() => ({}));
    const parsed = PutBody.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { profile, override } = parsed.data;
    const base = DEFAULTS[profile];
    const merged = {
      minRelevance:     override?.minRelevance     ?? base.minRelevance,
      minSufficiency:   override?.minSufficiency   ?? base.minSufficiency,
      minAcceptability: override?.minAcceptability ?? base.minAcceptability,
    };

    const up = await prisma.deliberationPref.upsert({
      where: { deliberationId },
      update: {
        profile,
        minRelevance: merged.minRelevance,
        minSufficiency: merged.minSufficiency,
        minAcceptability: merged.minAcceptability,
      },
      create: {
        deliberationId,
        profile,
        minRelevance: merged.minRelevance,
        minSufficiency: merged.minSufficiency,
        minAcceptability: merged.minAcceptability,
      },
      select: {
        profile: true,
        minRelevance: true,
        minSufficiency: true,
        minAcceptability: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ok: true,
      profile: up.profile,
      thresholds: {
        minRelevance: up.minRelevance,
        minSufficiency: up.minSufficiency,
        minAcceptability: up.minAcceptability,
      },
      updatedAt: up.updatedAt,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? 'PREFS_PUT_FAILED' },
      { status: 500 }
    );
  }
}
