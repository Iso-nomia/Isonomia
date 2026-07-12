/* lib/actions/like.actions.ts */
"use server";

import { like_type } from "@prisma/client";
import { prisma } from "../prismaclient";
import { generateFriendSuggestions } from "./friend-suggestions.actions";

/* ────────────────────────────────────────────────────────────
   ─── Types ─────────────────────────────────────────────────── */

interface FeedLikeParams {
  userId: string | number | bigint;
  feedPostId?: string | number | bigint;
  postId?: string | number | bigint;
}

interface RealtimeLikeParams {
  userId: string | number | bigint;
  realtimePostId: string | number | bigint;
}

/* ────────────────────────────────────────────────────────────
   ─── Helpers ──────────────────────────────────────────────── */

function toBig(n: string | number | bigint | undefined) {
  if (n === undefined) throw new Error("ID is required");
  return typeof n === "bigint" ? n : BigInt(n);
}

function feedPK(userId: bigint, postId: bigint) {
  return { feed_post_id_user_id: { feed_post_id: postId, user_id: userId } };
}

function realtimePK(userId: bigint, postId: bigint) {
  return { realtime_post_id_user_id: { realtime_post_id: postId, user_id: userId } };
}

/* ────────────────────────────────────────────────────────────
   ─── Feed‑post likes ──────────────────────────────────────── */

export async function likePost({ userId, feedPostId, postId }: FeedLikeParams) {
  const uid = toBig(userId);
  const pid = toBig(feedPostId ?? postId);

  const post = await prisma.feedPost.findUnique({ where: { id: pid } });
  if (!post) throw new Error("Feed‑post not found");

  const existing = await prisma.like.findUnique({ where: feedPK(uid, pid) });
  if (existing?.type === like_type.LIKE) return;             // already liked

  const delta = existing?.type === like_type.DISLIKE ? 2 : 1;

  await prisma.$transaction([
    prisma.like.upsert({
      where: feedPK(uid, pid),
      update: { score: 1, type: like_type.LIKE },
      create: {
        score: 1,
        type:  like_type.LIKE,
        user:  { connect: { id: uid } },
        feedPost: { connect: { id: pid } },
      },
    }),
    prisma.feedPost.update({
      where: { id: pid },
      data:  { like_count: { increment: delta } },
    }),
  ]);

  await generateFriendSuggestions(uid);
}

export async function dislikePost({ userId, feedPostId, postId }: FeedLikeParams) {
  const uid = toBig(userId);
  const pid = toBig(feedPostId ?? postId);

  const post = await prisma.feedPost.findUnique({ where: { id: pid } });
  if (!post) throw new Error("Feed‑post not found");

  const existing = await prisma.like.findUnique({ where: feedPK(uid, pid) });
  if (existing?.type === like_type.DISLIKE) return;          // already down‑voted

  const delta = existing?.type === like_type.LIKE ? -2 : -1;

  await prisma.$transaction([
    prisma.like.upsert({
      where: feedPK(uid, pid),
      update: { score: -1, type: like_type.DISLIKE },
      create: {
        score: -1,
        type:  like_type.DISLIKE,
        user:  { connect: { id: uid } },
        feedPost: { connect: { id: pid } },
      },
    }),
    prisma.feedPost.update({
      where: { id: pid },
      data:  { like_count: { increment: delta } },
    }),
  ]);
}

export async function unlikePost({ userId, feedPostId, postId }: FeedLikeParams) {
  const uid = toBig(userId);
  const pid = toBig(feedPostId ?? postId);

  const like = await prisma.like.findUnique({ where: feedPK(uid, pid) });
  if (!like) return;                                         // nothing to undo

  const delta = like.type === like_type.LIKE ? -1 : 1;

  await prisma.$transaction([
    prisma.like.delete({ where: feedPK(uid, pid) }),
    prisma.feedPost.update({
      where: { id: pid },
      data:  { like_count: { increment: delta } },
    }),
  ]);
}

/* Utility used by the feed page */
export async function fetchLikeForCurrentUser({
  userId,
  feedPostId,
  postId,
}: FeedLikeParams) {
  return prisma.like.findUnique({
    where: feedPK(toBig(userId), toBig(feedPostId ?? postId)),
  });
}

/* ────────────────────────────────────────────────────────────
   ─── Realtime‑post likes (unchanged apart from PK helpers) ── */

export async function likeRealtimePost({ userId, realtimePostId }: RealtimeLikeParams) {
  const uid = toBig(userId);
  const pid = toBig(realtimePostId);

  const post = await prisma.realtimePost.findUnique({ where: { id: pid } });
  if (!post) throw new Error("Realtime‑post not found");

  const existing = await prisma.realtimeLike.findUnique({ where: realtimePK(uid, pid) });
  if (existing?.type === like_type.LIKE) return;

  const delta = existing?.type === like_type.DISLIKE ? 2 : 1;

  await prisma.$transaction([
    prisma.realtimeLike.upsert({
      where: realtimePK(uid, pid),
      update: { score: 1, type: like_type.LIKE },
      create: {
        score: 1,
        type:  like_type.LIKE,
        user:  { connect: { id: uid } },
        realtime_post: { connect: { id: pid } },
      },
    }),
    prisma.realtimePost.update({
      where: { id: pid },
      data:  { like_count: { increment: delta } },
    }),
  ]);

  await generateFriendSuggestions(uid);
}

export async function dislikeRealtimePost({ userId, realtimePostId }: RealtimeLikeParams) {
  const uid = toBig(userId);
  const pid = toBig(realtimePostId);

  const post = await prisma.realtimePost.findUnique({ where: { id: pid } });
  if (!post) throw new Error("Realtime‑post not found");

  const existing = await prisma.realtimeLike.findUnique({ where: realtimePK(uid, pid) });
  if (existing?.type === like_type.DISLIKE) return;

  const delta = existing?.type === like_type.LIKE ? -2 : -1;

  await prisma.$transaction([
    prisma.realtimeLike.upsert({
      where: realtimePK(uid, pid),
      update: { score: -1, type: like_type.DISLIKE },
      create: {
        score: -1,
        type:  like_type.DISLIKE,
        user:  { connect: { id: uid } },
        realtime_post: { connect: { id: pid } },
      },
    }),
    prisma.realtimePost.update({
      where: { id: pid },
      data:  { like_count: { increment: delta } },
    }),
  ]);
}

export async function unlikeRealtimePost({ userId, realtimePostId }: RealtimeLikeParams) {
  const uid = toBig(userId);
  const pid = toBig(realtimePostId);

  const like = await prisma.realtimeLike.findUnique({ where: realtimePK(uid, pid) });
  if (!like) return;

  const delta = like.type === like_type.LIKE ? -1 : 1;

  await prisma.$transaction([
    prisma.realtimeLike.delete({ where: realtimePK(uid, pid) }),
    prisma.realtimePost.update({
      where: { id: pid },
      data:  { like_count: { increment: delta } },
    }),
  ]);
}

export async function fetchRealtimeLikeForCurrentUser(
  { userId, realtimePostId }: RealtimeLikeParams,
) {
  return prisma.realtimeLike.findUnique({
    where: realtimePK(toBig(userId), toBig(realtimePostId)),
  });
}
