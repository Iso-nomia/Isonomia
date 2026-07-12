"use server";

import { prisma } from "../prismaclient";

export async function voteClaim({
  claimId,
  userId,
  type,
}: {
  claimId: string | number | bigint;
  userId: string | number | bigint;
  type: "HELPFUL" | "UNHELPFUL";
}) {
  const cid = BigInt(claimId);
  const uid = BigInt(userId);

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.productReviewVote.findUnique({
      where: { claim_id_user_id: { claim_id: cid, user_id: uid } },
    });

    let incHelpful = 0;
    let incUnhelpful = 0;

    if (existing) {
      if (existing.type === type) {
        // No change
        return;
      }
      if (existing.type === "HELPFUL") {
        incHelpful -= 1;
      } else if (existing.type === "UNHELPFUL") {
        incUnhelpful -= 1;
      }
      await tx.productReviewVote.update({
        where: { claim_id_user_id: { claim_id: cid, user_id: uid } },
        data: { type },
      });
    } else {
      await tx.productReviewVote.create({
        data: {
          claim_id: cid,
          user_id: uid,
          type,
        },
      });
    }

    if (type === "HELPFUL") {
      incHelpful += 1;
    } else {
      incUnhelpful += 1;
    }

    await tx.productReviewClaim.update({
      where: { id: cid },
      data: {
        helpful_count: { increment: incHelpful },
        unhelpful_count: { increment: incUnhelpful },
      },
    });
  });
}

export async function vouchClaim({
  claimId,
  userId,
  amount,
}: {
  claimId: string | number | bigint;
  userId: string | number | bigint;
  amount: number;
}) {
  const cid = BigInt(claimId);
  const uid = BigInt(userId);

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.productReviewVouch.findUnique({
      where: { claim_id_user_id: { claim_id: cid, user_id: uid } },
    });

    if (existing) {
      const diff = amount - existing.amount;
      if (diff === 0) return;
      await tx.productReviewVouch.update({
        where: { claim_id_user_id: { claim_id: cid, user_id: uid } },
        data: { amount },
      });
      await tx.productReviewClaim.update({
        where: { id: cid },
        data: { vouch_total: { increment: diff } },
      });
    } else {
      await tx.productReviewVouch.create({
        data: { claim_id: cid, user_id: uid, amount },
      });
      await tx.productReviewClaim.update({
        where: { id: cid },
        data: { vouch_total: { increment: amount } },
      });
    }
  });
}

export async function fetchClaimStats(claimId: string | number | bigint) {
  const cid = BigInt(claimId);
  return await prisma.productReviewClaim.findUnique({
    where: { id: cid },
    select: {
      helpful_count: true,
      unhelpful_count: true,
      vouch_total: true,
    },
  });
}

export async function createProductReview({
  realtimePostId,
  authorId,
  productName,
  rating,
  summary,
  productLink,
  claims,
  images,
}: {
  realtimePostId: string | number | bigint;
  authorId: string | number | bigint;
  productName: string;
  rating: number;
  summary?: string;
  productLink?: string;
  claims: string[];
  images: string[];
}) {
  const pid = BigInt(realtimePostId);
  const uid = BigInt(authorId);

  return await prisma.$transaction(async (tx) => {
    const review = await tx.productReview.create({
      data: {
        realtime_post_id: pid,
        author_id: uid,
        product_name: productName,
        rating,
        ...(summary && { summary }),
        ...(productLink && { product_link: productLink }),
        image_urls: images,
        claims: {
          create: claims.map((text) => ({ text })),
        },
      },
      include: { claims: true },
    });
    return review;
  });
}

export async function fetchProductReviewByPostId(
  realtimePostId: string | number | bigint
) {
  const pid = BigInt(realtimePostId);
  return await prisma.productReview.findUnique({
    where: { realtime_post_id: pid },
    include: { claims: true },
  });
}
