/**
 * GET /api/v3/deliberations/[id]/ecc/enthymemes?argumentId=...
 * GET /api/v3/deliberations/[id]/ecc/enthymemes  (whole-deliberation scan)
 *
 * Sprint E1 — runs `detectEnthymemes()` from the algebra against an
 * argument (or every argument with a primary scheme in the deliberation)
 * and returns the per-argument list of `missingPremiseRoles` against the
 * scheme's `slotHints.premises[].role`.
 *
 * Honest-empty: an argument with no scheme assignment, or whose scheme
 * has no required roles, contributes zero nudges (a structural pass, not
 * an absence we should warn about).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { checkComposerEnthymemes } from "@/lib/argumentation/composerEnthymemeCheck";

export const dynamic = "force-dynamic";

interface ArgRow {
  id: string;
  schemeKey: string;
  requiredRoles: string[];
  rolesPresent: string[];
}

async function nudgesForArguments(rows: ArgRow[]) {
  return rows.flatMap((row) =>
    checkComposerEnthymemes({
      argumentId: row.id,
      schemeKey: row.schemeKey,
      requiredRoles: row.requiredRoles,
      rolesPresent: row.rolesPresent,
    }).map((n) => ({
      argumentId: n.argumentId,
      schemeKey: n.schemeKey,
      missingPremiseRoles: n.missingPremiseRoles,
    })),
  );
}

async function loadArgRows(deliberationId: string, argumentId?: string): Promise<ArgRow[]> {
  // Prefer ArgumentSchemeInstance.isPrimary; fall back to legacy schemeId.
  const args = await prisma.argument.findMany({
    where: argumentId
      ? { id: argumentId, deliberationId }
      : { deliberationId, OR: [{ schemeId: { not: null } }, { argumentSchemes: { some: {} } }] },
    select: {
      id: true,
      schemeId: true,
      implicitWarrant: true,
      argumentSchemes: {
        where: { isPrimary: true },
        select: { schemeId: true },
        take: 1,
      },
      premises: { select: { groupKey: true } },
    },
  });
  if (args.length === 0) return [];

  const schemeIds = Array.from(
    new Set(
      args
        .map((a) => a.argumentSchemes[0]?.schemeId ?? a.schemeId ?? null)
        .filter((x): x is string => Boolean(x)),
    ),
  );
  if (schemeIds.length === 0) return [];

  const schemes = await prisma.argumentScheme.findMany({
    where: { id: { in: schemeIds } },
    select: { id: true, key: true, slotHints: true },
  });
  const schemeById = new Map(schemes.map((s) => [s.id, s]));

  return args.flatMap((a) => {
    const sId = a.argumentSchemes[0]?.schemeId ?? a.schemeId ?? null;
    if (!sId) return [];
    const s = schemeById.get(sId);
    if (!s?.key) return [];
    const sh: any = s.slotHints;
    const requiredRoles: string[] = Array.isArray(sh?.premises)
      ? sh.premises.map((p: any) => String(p?.role ?? "")).filter(Boolean)
      : [];
    if (requiredRoles.length === 0) return [];
    const fromPremises = a.premises.map((p) => String(p.groupKey ?? "")).filter(Boolean);
    const warrant = a.implicitWarrant ? [] : ["warrant"];
    const rolesPresent = Array.from(new Set([...fromPremises, ...warrant]));
    return [{ id: a.id, schemeKey: s.key, requiredRoles, rolesPresent }];
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: deliberationId } = await ctx.params;
  const argumentId = new URL(req.url).searchParams.get("argumentId") ?? undefined;

  const rows = await loadArgRows(deliberationId, argumentId);
  const nudges = await nudgesForArguments(rows);
  return NextResponse.json({
    ok: true,
    deliberationId,
    scope: argumentId ? "argument" : "deliberation",
    argumentId: argumentId ?? null,
    inspected: rows.length,
    nudges,
  });
}
