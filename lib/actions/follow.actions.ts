"use server";

import { prisma } from "../prismaclient";
import { createFollowNotification } from "./notification.actions";

export async function followUser({ followerId, followingId }: { followerId: bigint; followingId: bigint; }) {
  try {
    await prisma.follow.create({
      data: {
        follower_id: followerId,
        following_id: followingId,
      },
    });
    await createFollowNotification({ userId: followingId, actorId: followerId });
  } catch (error: any) {
    throw new Error(`Failed to follow user: ${error.message}`);
  }
}

export async function unfollowUser({ followerId, followingId }: { followerId: bigint; followingId: bigint; }) {
  try {
    await prisma.follow.delete({
      where: {
        follower_id_following_id: {
          follower_id: followerId,
          following_id: followingId,
        },
      },
    });
  } catch (error: any) {
    throw new Error(`Failed to unfollow user: ${error.message}`);
  }
}

export async function isFollowing({ followerId, followingId }: { followerId: bigint; followingId: bigint; }) {
  const follow = await prisma.follow.findUnique({
    where: {
      follower_id_following_id: { follower_id: followerId, following_id: followingId },
    },
  });
  return !!follow;
}

export async function areFriends({ userId, targetUserId }: { userId: bigint; targetUserId: bigint; }) {
  const [a, b] = await Promise.all([
    prisma.follow.findUnique({
      where: {
        follower_id_following_id: { follower_id: userId, following_id: targetUserId },
      },
    }),
    prisma.follow.findUnique({
      where: {
        follower_id_following_id: { follower_id: targetUserId, following_id: userId },
      },
    }),
  ]);
  return !!a && !!b;
}
export interface FriendEntry {
  id: bigint;
  name: string;
  username: string;
  image: string | null;
  status: "following" | "followed" | "friends";
}

export async function fetchFollowRelations({ userId }: { userId: bigint }) {
  const followings = await prisma.follow.findMany({
    where: { follower_id: userId },
    include: { following: true },
  });
  const followers = await prisma.follow.findMany({
    where: { following_id: userId },
    include: { follower: true },
  });
  const map = new Map<bigint, FriendEntry>();
  for (const f of followings) {
    map.set(f.following_id, {
      id: f.following_id,
      name: f.following.name!,
      username: f.following.username,
      image: f.following.image,
      status: "following",
    });
  }
  for (const f of followers) {
    if (map.has(f.follower_id)) {
      map.set(f.follower_id, { ...map.get(f.follower_id)!, status: "friends" });
    } else {
      map.set(f.follower_id, {
        id: f.follower_id,
        name: f.follower.name!,
        username: f.follower.username,
        image: f.follower.image,
        status: "followed",
      });
    }
  }
  return Array.from(map.values());
}
