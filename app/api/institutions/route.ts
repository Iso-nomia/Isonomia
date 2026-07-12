export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import {
  apiError,
  mapServiceError,
  parseJson,
  requireAuth,
  zodError,
} from "@/lib/pathways/apiHelpers";
import { isPlatformAdmin } from "@/lib/pathways/auth";
import {
  CreateInstitutionSchema,
  ListInstitutionsQuerySchema,
} from "@/lib/pathways/schemas";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  if (!isPlatformAdmin(auth.authId)) {
    return apiError("FORBIDDEN", "Platform admin required to create institutions");
  }

  const parsed = CreateInstitutionSchema.safeParse(await parseJson(req));
  if (!parsed.success) return zodError(parsed.error);

  try {
    const institution = await prisma.institution.create({
      data: {
        slug: parsed.data.slug,
        name: parsed.data.name,
        kind: parsed.data.kind,
        jurisdiction: parsed.data.jurisdiction ?? null,
        contactJson: (parsed.data.contact ?? null) as any,
        linkedDeliberationId: parsed.data.linkedDeliberationId ?? null,
        createdById: auth.userId,
      },
    });
    return NextResponse.json({ institution }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return apiError("BAD_REQUEST", "Slug or linkedDeliberationId already in use");
    }
    return mapServiceError(err);
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = ListInstitutionsQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) return zodError(parsed.error);

  const { kind, jurisdiction, cursor, limit = 25 } = parsed.data;

  const items = await prisma.institution.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(jurisdiction ? { jurisdiction: { contains: jurisdiction } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const next = items.pop()!;
    nextCursor = next.id;
  }

  return NextResponse.json({ items, nextCursor });
}
