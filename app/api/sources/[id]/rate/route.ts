// app/api/sources/[id]/rate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaclient";
import { getCurrentUserId } from "@/lib/serverutils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/sources/[id]/rate
 * 
 * Allows users to rate a source's quality on a 1-10 scale.
 * Updates existing rating if user has already rated this source.
 * 
 * Body: { rating: number } (1-10)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sourceId = decodeURIComponent(params.id);
    const body = await req.json();
    const { rating } = body;

    // Validate rating
    if (typeof rating !== "number" || rating < 1 || rating > 10) {
      return NextResponse.json(
        { error: "Rating must be a number between 1 and 10" },
        { status: 400 }
      );
    }

    // Verify source exists
    const source = await prisma.source.findUnique({
      where: { id: sourceId },
      select: { id: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // Upsert rating (create or update)
    const sourceRating = await prisma.sourceRating.upsert({
      where: {
        sourceId_userId: {
          sourceId,
          userId,
        },
      },
      create: {
        sourceId,
        userId,
        rating,
      },
      update: {
        rating,
        updatedAt: new Date(),
      },
    });

    // Calculate new average rating
    const allRatings = await prisma.sourceRating.findMany({
      where: { sourceId },
      select: { rating: true },
    });

    const averageRating =
      allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

    return NextResponse.json(
      {
        ok: true,
        rating: {
          ...sourceRating,
          userId: sourceRating.userId.toString(), // Convert BigInt to string
        },
        averageRating: Math.round(averageRating * 10) / 10,
        ratingCount: allRatings.length,
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Error submitting source rating:", error);
    return NextResponse.json(
      { error: "Failed to submit rating" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sources/[id]/rate
 * 
 * Returns current user's rating for this source (if any) and aggregate stats.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId();
    const sourceId = decodeURIComponent(params.id);

    // Get all ratings for this source
    const allRatings = await prisma.sourceRating.findMany({
      where: { sourceId },
      select: { rating: true, userId: true },
    });

    if (allRatings.length === 0) {
      return NextResponse.json({
        ok: true,
        userRating: null,
        averageRating: null,
        ratingCount: 0,
      });
    }

    const averageRating =
      allRatings.reduce((sum: number, r: any) => sum + r.rating, 0) / allRatings.length;

    const userRating = userId
      ? allRatings.find((r) => r.userId === userId)?.rating || null
      : null;

    return NextResponse.json({
      ok: true,
      userRating,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingCount: allRatings.length,
    });
  } catch (error) {
    console.error("Error fetching source rating:", error);
    return NextResponse.json(
      { error: "Failed to fetch rating" },
      { status: 500 }
    );
  }
}
