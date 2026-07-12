export const dynamic = "force-dynamic";

// app/api/objects/[kind]/[id]/backlinks/route.ts
//
// Living Thesis — Phase 6.3: "used in" backlinks for any object.
//
// GET /api/objects/[kind]/[id]/backlinks
//   kind ∈ "claim" | "argument" | "proposition" | "citation"
//
// Returns places where this object is referenced — theses (via embedded
// content + structured prongs), arguments (as conclusion or premise for
// claims), and downstream claims (for propositions). Cheap structural
// queries; intentionally not paginated in V1.

import { NextRequest, NextResponse } from "next/server";
import type { JSONContent } from "@tiptap/core";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import { collectEmbeddedObjects } from "@/lib/thesis/embedded-objects";
import { filterReadableTheses } from "@/lib/thesis/permissions";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

type Kind = "claim" | "argument" | "proposition" | "citation" | "chain";
const KINDS: ReadonlySet<Kind> = new Set([
  "claim",
  "argument",
  "proposition",
  "citation",
  "chain",
]);

interface ThesisBacklink {
  thesisId: string;
  title: string;
  slug: string;
  deliberationId: string | null;
  via: Array<
    | "thesisClaim"
    | "prongMain"
    | "prongArgument"
    | "content"
    | "chainReference"
    | "prongChainReference"
  >;
}

interface ArgumentBacklink {
  id: string;
  text: string;
  schemeId: string | null;
  role: "conclusion" | "premise";
}

interface ClaimBacklink {
  id: string;
  text: string;
  ClaimLabel: { label: string } | null;
}

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status, ...NO_STORE });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { kind: string; id: string } },
) {
  try {
    const authId = await getCurrentUserAuthId();
    if (!authId) return bad(401, "Unauthorized");

    const kind = params.kind as Kind;
    if (!KINDS.has(kind)) return bad(400, `Unknown kind: ${params.kind}`);
    const objectId = params.id;
    if (!objectId) return bad(400, "Missing object id");

    // ─────────────────────────────────────────────────────────────────────
    // 1. Theses backlinks: structured prong refs are direct; content scan
    //    requires loading candidate theses then walking their TipTap JSON.
    //    To keep this cheap we narrow content scan via a substring filter.
    // ─────────────────────────────────────────────────────────────────────
    const [thesesByThesisClaim, thesesByProngMain, thesesByProngArgument, thesesByChainRef, thesesByProngChainRef] =
      await Promise.all([
        kind === "claim"
          ? prisma.thesis.findMany({
              where: { thesisClaimId: objectId },
              select: { id: true, title: true, slug: true, deliberationId: true, authorId: true, status: true },
            })
          : Promise.resolve([] as any[]),
        kind === "claim"
          ? prisma.thesis.findMany({
              where: { prongs: { some: { mainClaimId: objectId } } },
              select: { id: true, title: true, slug: true, deliberationId: true, authorId: true, status: true },
            })
          : Promise.resolve([] as any[]),
        kind === "argument"
          ? prisma.thesis.findMany({
              where: {
                prongs: {
                  some: { arguments: { some: { argumentId: objectId } } },
                },
              },
              select: { id: true, title: true, slug: true, deliberationId: true, authorId: true, status: true },
            })
          : Promise.resolve([] as any[]),
        // D4 Week 4: structured chain references at the thesis level (sectionId or content).
        kind === "chain"
          ? prisma.thesis.findMany({
              where: {
                chainReferences: { some: { chainId: objectId, prongId: null } },
              },
              select: { id: true, title: true, slug: true, deliberationId: true, authorId: true, status: true },
            })
          : Promise.resolve([] as any[]),
        // D4 Week 4: structured chain references scoped to a prong.
        kind === "chain"
          ? prisma.thesis.findMany({
              where: {
                chainReferences: { some: { chainId: objectId, prongId: { not: null } } },
              },
              select: { id: true, title: true, slug: true, deliberationId: true, authorId: true, status: true },
            })
          : Promise.resolve([] as any[]),
      ]);

    // Content scan: only theses whose TipTap JSON serialization contains the
    // id substring. This is a coarse filter; we then verify with the proper
    // walker before counting it.
    const contentCandidates = await prisma.thesis.findMany({
      where: { content: { string_contains: objectId } as any },
      select: { id: true, title: true, slug: true, deliberationId: true, authorId: true, status: true, content: true },
      take: 200,
    });
    const thesesByContent = contentCandidates.filter((t) => {
      const inv = collectEmbeddedObjects(
        (t.content ?? null) as JSONContent | null,
      );
      switch (kind) {
        case "claim":
          return inv.claimIds.includes(objectId);
        case "argument":
          return inv.argumentIds.includes(objectId);
        case "proposition":
          return inv.propositionIds.includes(objectId);
        case "citation":
          return inv.citationIds.includes(objectId);
        case "chain":
          return inv.chainIds.includes(objectId);
      }
    });

    const thesisMap = new Map<string, ThesisBacklink>();
    function addThesis(
      t: {
        id: string;
        title: string;
        slug: string;
        deliberationId: string | null;
        authorId?: string | null;
        status?: string | null;
      },
      via: ThesisBacklink["via"][number],
    ) {
      const existing = thesisMap.get(t.id);
      if (existing) {
        if (!existing.via.includes(via)) existing.via.push(via);
      } else {
        thesisMap.set(t.id, {
          thesisId: t.id,
          title: t.title,
          slug: t.slug,
          deliberationId: t.deliberationId,
          via: [via],
          // stash visibility metadata for filtering below
          ...({
            __authorId: t.authorId ?? null,
            __status: t.status ?? null,
          } as any),
        });
      }
    }
    for (const t of thesesByThesisClaim as any[]) addThesis(t, "thesisClaim");
    for (const t of thesesByProngMain as any[]) addThesis(t, "prongMain");
    for (const t of thesesByProngArgument as any[]) addThesis(t, "prongArgument");
    for (const t of thesesByChainRef as any[]) addThesis(t, "chainReference");
    for (const t of thesesByProngChainRef as any[]) addThesis(t, "prongChainReference");
    for (const t of thesesByContent) addThesis(t, "content");

    // Phase 7.2: redact theses the caller cannot read (drafts by other
    // authors in deliberations they are not part of).
    const visibleEntries = await filterReadableTheses(
      authId,
      Array.from(thesisMap.values()).map((entry: any) => ({
        id: entry.thesisId,
        authorId: entry.__authorId ?? null,
        status: entry.__status ?? null,
        deliberationId: entry.deliberationId ?? null,
        __ref: entry,
      })),
    );
    const theses = visibleEntries.map((v: any) => {
      const { __authorId, __status, ...clean } = v.__ref;
      return clean as ThesisBacklink;
    });

    // ─────────────────────────────────────────────────────────────────────
    // 2. Argument backlinks (claim or proposition only).
    // ─────────────────────────────────────────────────────────────────────
    const argumentBacklinks: ArgumentBacklink[] = [];
    if (kind === "claim") {
      const [asConclusion, asPremise] = await Promise.all([
        prisma.argument.findMany({
          where: { conclusionClaimId: objectId },
          select: { id: true, text: true, schemeId: true },
          take: 50,
        }),
        prisma.argument.findMany({
          where: { premises: { some: { claimId: objectId } } },
          select: { id: true, text: true, schemeId: true },
          take: 50,
        }),
      ]);
      for (const a of asConclusion) {
        argumentBacklinks.push({ ...a, role: "conclusion" });
      }
      for (const a of asPremise) {
        // Avoid duplicate when an argument both concludes and uses the claim.
        if (!argumentBacklinks.some((x) => x.id === a.id)) {
          argumentBacklinks.push({ ...a, role: "premise" });
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3. Claim backlinks (proposition → promoted claims).
    // ─────────────────────────────────────────────────────────────────────
    const claimBacklinks: ClaimBacklink[] = [];
    if (kind === "proposition") {
      // Proposition owns the FK (Proposition.promotedClaimId).
      const prop = await prisma.proposition.findUnique({
        where: { id: objectId },
        select: {
          promotedClaim: {
            select: {
              id: true,
              text: true,
              ClaimLabel: { select: { label: true } },
            },
          },
        },
      });
      if (prop?.promotedClaim) {
        claimBacklinks.push({
          id: prop.promotedClaim.id,
          text: prop.promotedClaim.text,
          ClaimLabel: (prop.promotedClaim as any).ClaimLabel ?? null,
        });
      }
    }

    return NextResponse.json(
      {
        kind,
        id: objectId,
        theses,
        arguments: argumentBacklinks,
        claims: claimBacklinks,
        counts: {
          theses: theses.length,
          arguments: argumentBacklinks.length,
          claims: claimBacklinks.length,
        },
      },
      NO_STORE,
    );
  } catch (err) {
    console.error("[objects/backlinks] error:", err);
    return bad(500, "Internal error");
  }
}
