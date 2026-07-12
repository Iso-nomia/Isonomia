/**
 * POST /api/v3/arguments/ai-draft/[id]/approve
 *
 * Track AI-EPI Pt. 3 §5 — editor approval for an AI draft.
 *
 * Mints an `ArgumentPermalink` for the draft, which makes it visible to
 * the public retrieval surfaces (search, MCP, attestation endpoint). The
 * standing-state classifier reads from inbound traffic, so the approved
 * row enters at "untested-default" with `authorKind: "AI"` until the
 * platform records actual dialectical engagement.
 */
import { NextRequest, NextResponse } from "next/server";
import { approveAiDraft } from "@/lib/argument/aiAuthoring";
import { getCurrentUserId } from "@/lib/serverutils";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await approveAiDraft({
      argumentId: params.id,
      approvingEditorAuthId: String(userId),
    });
    return NextResponse.json({ ok: true, approved: result });
  } catch (e: any) {
    console.error(
      "[POST /api/v3/arguments/ai-draft/[id]/approve]",
      e,
    );
    return NextResponse.json(
      { error: e?.message ?? "Failed to approve AI draft" },
      { status: 500 },
    );
  }
}
