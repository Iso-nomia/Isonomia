export const dynamic = "force-dynamic";

// app/api/thesis/[id]/focus/route.ts
//
// Living Thesis — Phase 6.1: focus resolver.
//
// GET /api/thesis/[id]/focus?ref=<idOrMoid>&hint=<kind?>
//
// Resolves a user-facing focus reference (?focus=… in the view URL) to the
// concrete (kind, id) tuple that the inspector understands. Accepts:
//   • a direct claim/argument/proposition/citation id (cuid-ish)
//   • a Claim.moid (preferred for stable external links)
//
// Returns 404 if nothing matches. The view page uses this on mount when a
// `?focus=` param is present, then dispatches openInspector + scrolls.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserAuthId } from "@/lib/serverutils";
import { checkThesisReadable } from "@/lib/thesis/permissions";

const NO_STORE = { headers: { "Cache-Control": "no-store" } } as const;

type Kind = "claim" | "argument" | "proposition" | "citation";
const KINDS: ReadonlySet<Kind> = new Set([
  "claim",
  "argument",
  "proposition",
  "citation",
]);

function bad(status: number, error: string) {
  return NextResponse.json({ error }, { status, ...NO_STORE });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authId = await getCurrentUserAuthId();

    // Phase 7.2: gate read access (prevents focus probing on private theses).
    const gate = await checkThesisReadable(authId, params.id);
    if (!gate.ok) return bad(gate.status, gate.message);

    const ref = req.nextUrl.searchParams.get("ref")?.trim();
    if (!ref) return bad(400, "Missing ?ref");
    const hint = req.nextUrl.searchParams.get("hint")?.trim().toLowerCase();
    const hintKind = hint && KINDS.has(hint as Kind) ? (hint as Kind) : null;

    // 1. Try moid lookup against Claim first (most common external link).
    if (!hintKind || hintKind === "claim") {
      const byMoid = await prisma.claim.findUnique({
        where: { moid: ref },
        select: { id: true },
      });
      if (byMoid) {
        return NextResponse.json(
          { kind: "claim", id: byMoid.id, matchedBy: "moid" },
          NO_STORE,
        );
      }
    }

    // 2. Try direct id lookup, optionally narrowed by hint.
    const tryClaim = !hintKind || hintKind === "claim";
    const tryArgument = !hintKind || hintKind === "argument";
    const tryProp = !hintKind || hintKind === "proposition";
    const tryCitation = !hintKind || hintKind === "citation";

    const [claim, argument, proposition, citation] = await Promise.all([
      tryClaim
        ? prisma.claim.findUnique({ where: { id: ref }, select: { id: true } })
        : Promise.resolve(null),
      tryArgument
        ? prisma.argument.findUnique({
            where: { id: ref },
            select: { id: true },
          })
        : Promise.resolve(null),
      tryProp
        ? prisma.proposition.findUnique({
            where: { id: ref },
            select: { id: true },
          })
        : Promise.resolve(null),
      tryCitation
        ? prisma.citation.findUnique({
            where: { id: ref },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (claim) return NextResponse.json({ kind: "claim", id: claim.id, matchedBy: "id" }, NO_STORE);
    if (argument)
      return NextResponse.json({ kind: "argument", id: argument.id, matchedBy: "id" }, NO_STORE);
    if (proposition)
      return NextResponse.json(
        { kind: "proposition", id: proposition.id, matchedBy: "id" },
        NO_STORE,
      );
    if (citation)
      return NextResponse.json({ kind: "citation", id: citation.id, matchedBy: "id" }, NO_STORE);

    return bad(404, "No object found for that ref");
  } catch (err) {
    console.error("[thesis/focus] error:", err);
    return bad(500, "Internal error");
  }
}
