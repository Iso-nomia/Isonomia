export const dynamic = "force-dynamic";

// app/api/deliberations/[id]/issues/[issueId]/answer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";
import { asUserIdString } from "@/lib/auth/normalize";
import { emitBus } from "@/lib/server/bus";

const AnswerBody = z.object({
  answerText: z.string().min(1).max(5000),
});

/**
 * POST /api/deliberations/[id]/issues/[issueId]/answer
 * Answer a clarification request
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; issueId: string } }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deliberationId = params.id;
  const issueId = params.issueId;
  const uid = asUserIdString(userId);

  // Validate request body
  let body;
  try {
    body = AnswerBody.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { error: "Invalid request body", details: err.errors },
      { status: 400 }
    );
  }

  // Fetch the issue
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      deliberationId: true,
      kind: true,
      state: true,
      createdById: true,
      assigneeId: true,
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  if (issue.deliberationId !== deliberationId) {
    return NextResponse.json(
      { error: "Issue does not belong to this deliberation" },
      { status: 400 }
    );
  }

  if (issue.kind !== "clarification") {
    return NextResponse.json(
      { error: "This endpoint is only for clarification requests" },
      { status: 400 }
    );
  }

  // Check authorization: only assignee (author) can answer
  if (issue.assigneeId && issue.assigneeId.toString() !== uid) {
    return NextResponse.json(
      { error: "Only the assigned author can answer this clarification" },
      { status: 403 }
    );
  }

  // Update the issue with the answer
  const updatedIssue = await prisma.issue.update({
    where: { id: issueId },
    data: {
      answerText: body.answerText,
      answeredById: BigInt(uid),
      answeredAt: new Date(),
      state: "closed",
      closedById: uid,
      closedAt: new Date(),
    },
  });

  // Emit bus event for notifications
  try {
    emitBus("issues:changed", { deliberationId });
  } catch (err) {
    console.error("Failed to emit bus events:", err);
  }

  return NextResponse.json(
    JSON.parse(
      JSON.stringify(
        { ok: true, issue: updatedIssue },
        (_, v) => (typeof v === "bigint" ? v.toString() : v)
      )
    )
  );
}
