export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
// TODO: Uncomment when ArgumentNet and NetCQAnswer models are added to Prisma schema
// import { prisma } from "@/lib/prismaclient";
// import { getCurrentUser } from "@/app/server/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Implement when database schema is ready
    // const user = await getCurrentUser();
    // if (!user) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const body = await request.json();
    const {
      questionId,
      answerText,
      targetSchemeId,
      targetDependencyId,
      relatedSchemeIds,
      questionType,
      questionCategory,
      priority,
    } = body;

    // TODO: Create answer in database
    // const answer = await prisma.netCQAnswer.create({
    //   data: {
    //     netId: params.id,
    //     questionId,
    //     userId: user.id,
    //     answerText,
    //     targetSchemeId,
    //     targetDependencyId,
    //     relatedSchemeIds: relatedSchemeIds || [],
    //     questionType,
    //     questionCategory,
    //     priority,
    //   },
    // });

    // Mock response for now
    const answer = {
      id: `answer-${Date.now()}`,
      netId: params.id,
      questionId,
      answerText,
      targetSchemeId,
      targetDependencyId,
      relatedSchemeIds: relatedSchemeIds || [],
      questionType,
      questionCategory,
      priority,
      createdAt: new Date().toISOString(),
      helpful: 0,
      notHelpful: 0,
    };

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("CQ answer error:", error);
    return NextResponse.json(
      { error: "Failed to save answer" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = request.nextUrl;
    const targetSchemeId = searchParams.get("targetSchemeId");
    const questionId = searchParams.get("questionId");

    // TODO: Fetch answers from database
    // const where: any = { netId: params.id };
    // if (targetSchemeId) {
    //   where.targetSchemeId = targetSchemeId;
    // }
    // if (questionId) {
    //   where.questionId = questionId;
    // }

    // const answers = await prisma.netCQAnswer.findMany({
    //   where,
    //   include: {
    //     user: {
    //       select: {
    //         id: true,
    //         name: true,
    //         image: true,
    //       },
    //     },
    //   },
    //   orderBy: { createdAt: "desc" },
    // });

    // Mock response for now
    const answers: any[] = [];

    return NextResponse.json({ answers });
  } catch (error) {
    console.error("CQ answer fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch answers" },
      { status: 500 }
    );
  }
}
