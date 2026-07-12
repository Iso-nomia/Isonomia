export const dynamic = "force-dynamic";

// app/api/claims/[id]/evidence/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { z } from "zod";
import { getCurrentUserId } from "@/lib/serverutils";

const ResourceRef = z.union([
  z.object({ kind: z.literal("uri"), url: z.string().url() }),
  z.object({ kind: z.literal("work"), id: z.string().min(3) }),
  z.object({ kind: z.literal("stack:item"), stackId: z.string().optional(), itemId: z.string().min(3) }),
]);

// Accept either modern {ref} or legacy flat { kind,url,id,itemId } shapes.
const ModernBody = z.object({
  ref: ResourceRef,
  role: z.enum(["primary", "secondary", "dataset", "code"]).default("secondary"),
  locator: z.string().optional(),
  quote: z.string().max(280).optional(),
  note: z.string().max(500).optional(),
});

const LegacyBody = z.object({
  kind: z.enum(["uri", "work", "stack:item"]),
  url: z.string().optional(),
  id: z.string().optional(),          // for 'work'
  itemId: z.string().optional(),      // for 'stack:item'
  role: z.enum(["primary", "secondary", "dataset", "code"]).default("secondary"),
  locator: z.string().optional(),
  quote: z.string().max(280).optional(),
  note: z.string().max(500).optional(),
});

type NormalizedInput = {
  ref: z.infer<typeof ResourceRef>;
  role: "primary" | "secondary" | "dataset" | "code";
  locator?: string;
  quote?: string;
  note?: string;
};

function normalize(body: any): NormalizedInput | null {
  const m = ModernBody.safeParse(body);
  if (m.success) return m.data;

  const l = LegacyBody.safeParse(body);
  if (l.success) {
    const { kind, url, id, itemId, role, locator, quote, note } = l.data;
    const ref: z.infer<typeof ResourceRef> =
      kind === "uri"
        ? { kind: "uri", url: url! }
        : kind === "work"
        ? { kind: "work", id: id! }
        : { kind: "stack:item", itemId: itemId! };
    return { ref, role, locator, quote, note };
  }
  return null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const claimId = params.id;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const input = normalize(raw);
  if (!input) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const { ref, role, locator, quote, note } = input;

  // 1) Resolve Source via resolver
  const resolverPayload =
    ref.kind === "uri"
      ? { ref: { kind: "uri", url: ref.url } }
      : ref.kind === "work"
      ? { ref: { kind: "work", id: ref.id } }
      : { ref: { kind: "stack:item", itemId: ref.itemId } };

  const resolveRes = await fetch(new URL("/api/citations/resolve", req.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(resolverPayload),
  });
  const resolved = await resolveRes.json().catch(() => ({} as any));
  if (!resolveRes.ok || !resolved?.source?.id) {
    return NextResponse.json({ error: resolved?.error || "resolve failed" }, { status: 400 });
  }
  const sourceId: string = resolved.source.id;

  // 2) Attach Citation via /api/citations/attach (so createdById = viewer)
  const attachRes = await fetch(new URL("/api/citations/attach", req.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      targetType: "claim",
      targetId: claimId,
      sourceId,
      locator: locator || undefined,
      quote: quote || undefined,
      note: note || undefined,
    }),
  });
  const attach = await attachRes.json().catch(() => ({} as any));
  if (!attachRes.ok || attach?.error) {
    return NextResponse.json({ error: attach?.error || "attach failed" }, { status: 400 });
  }

  // 3) Optional EvidenceLink for counts/back-compat
  const uriForCount = ref.kind === "uri" ? ref.url : resolved?.source?.url ?? "";
  await prisma.evidenceLink
    .create({ data: { targetKind: "claim", targetId: claimId, note: role, uri: uriForCount } })
    .catch(() => null);

  // Quick counts
  const [evidenceCount, citationCount] = await Promise.all([
    prisma.evidenceLink.count({ where: { targetKind: "claim", targetId: claimId } }),
    prisma.citation.count({ where: { targetType: "claim", targetId: claimId } }),
  ]);

  return NextResponse.json({
    ok: true,
    counts: { evidence: evidenceCount, citations: citationCount },
    citationId: attach?.citation?.id ?? null,
  });
}
