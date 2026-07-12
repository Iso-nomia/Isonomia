/**
 * POST /api/v3/arguments/ai-draft
 *
 * Track AI-EPI Pt. 3 §5 — AI-authored draft submission.
 *
 * Token-gated. Body shape mirrors `AiDraftRequest`. Caller is responsible
 * for the model call; this route persists the resulting draft as a non-
 * public Argument row and returns the new id. Editor approval (which
 * mints the permalink and makes the draft publicly retrievable) goes
 * through `POST /api/v3/arguments/ai-draft/[id]/approve`.
 *
 * Standing-state invariant: AI drafts always enter at "untested-default".
 * Enforced structurally in `lib/argument/aiAuthoring.ts` — see the policy
 * note in `docs/AI_AUTHORING_POLICY.md`.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAiDraft } from "@/lib/argument/aiAuthoring";
import { getCurrentUserId } from "@/lib/serverutils";

export const dynamic = "force-dynamic";

const SourceSchema = z.object({
  url: z.string().url(),
  title: z.string().max(500).optional(),
  quote: z.string().max(2000).optional(),
});

const PremiseSchema = z.object({
  text: z.string().min(1).max(2000),
  isImplicit: z.boolean().optional(),
});

const BodySchema = z.object({
  deliberationId: z.string().min(1),
  topicId: z.string().optional(),
  hint: z.string().max(2000).optional(),
  schemeKey: z.string().min(1),
  sources: z.array(SourceSchema).max(20),
  model: z.string().min(1).max(120),
  promptHash: z.string().min(8).max(200),
  generated: z.object({
    conclusion: z.string().min(1).max(2000),
    reasoning: z.string().max(5000).optional(),
    premises: z.array(PremiseSchema).max(25),
  }),
});

export async function POST(req: NextRequest) {
  // Token-gate the endpoint. We re-use the existing session check; the
  // intent is "an authenticated editor must own this action", not "any
  // public client can post AI content".
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await createAiDraft({
      ...parsed.data,
      initiatedByAuthId: String(userId),
    });
    return NextResponse.json({ ok: true, draft: result });
  } catch (e: any) {
    console.error("[POST /api/v3/arguments/ai-draft]", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to create AI draft" },
      { status: 500 },
    );
  }
}
