"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../prismaclient";
import { getUserFromCookies } from "../serverutils";
import { nanoid } from "nanoid";
import { generateFriendSuggestions } from "./friend-suggestions.actions";


export async function fetchRealtimeRoom({
  realtimeRoomId,
}: {
  realtimeRoomId: string;
}) {
  try {

    const realtimeRoom = await prisma.realtimeRoom.findUnique({
      where: {
        id: realtimeRoomId,
      },
      include: {
        realtimeposts: {
          include: {
            author: true,
          },
        },
        realtimeedges: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!realtimeRoom) return null;

    return {
      ...realtimeRoom,
      realtimeposts: realtimeRoom.realtimeposts.map((realtimePost) => ({
        ...realtimePost,
        x_coordinate: realtimePost.x_coordinate.toNumber(),
        y_coordinate: realtimePost.y_coordinate.toNumber(),
      })),
    };
  } catch (error: any) {
    throw new Error(`Failed to get room: ${error.message}`);
  }
}

export async function joinRoom({ roomId }: { roomId: string }) {
  try {
    const user = await getUserFromCookies();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const existingRoom = await prisma.realtimeRoom.findUnique({
      where: { id: roomId },
    });
    if (!existingRoom) {
      await prisma.realtimeRoom.create({
        data: { id: roomId, room_icon: "/assets/logo-white.svg" },
      });
    }

    await prisma.userRealtimeRoom.upsert({
      where: {
        user_id_realtime_room_id: {
          user_id: user.userId!,
          realtime_room_id: roomId,
        },
      },
      create: {
        user_id: user.userId!,
        realtime_room_id: roomId,
      },
      update: {
        user_id: user.userId!,
        realtime_room_id: roomId,
      },
    });
    await generateFriendSuggestions(user.userId!);
  } catch (error: any) {
    throw new Error(`Failed to join room: ${error.message}`);
  }
}

export async function leaveRoom({
  roomId,
  path,
}: {
  roomId: string;
  path: string;
}) {
  try {
    const user = await getUserFromCookies();
    if (!user) {
      throw new Error("User not authenticated");
    }
    await prisma.userRealtimeRoom.delete({
      where: {
        user_id_realtime_room_id: {
          user_id: user.userId!,
          realtime_room_id: roomId,
        },
      },
    });
    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to leave room: ${error.message}`);
  }
}

export async function createAndJoinRoom({
  roomName,
  roomIcon,
  path,
}: {
  roomName: string;
  roomIcon: string;
  path: string;
}) {
  try {
    const user = await getUserFromCookies();
    if (!user) {
      throw new Error("User not authenticated");
    }
  const [realtimeRoom, connection] = await prisma.$transaction([
      prisma.realtimeRoom.create({
        data: {
          id: roomName,
          room_icon: roomIcon,
        },
      }),
      prisma.userRealtimeRoom.create({
        data: {
          user_id: user.userId!,
          realtime_room_id: roomName,
        },
      }),
    ]);
    await generateFriendSuggestions(user.userId!);
    revalidatePath(path);
    return realtimeRoom;
  } catch (error: any) {
    throw new Error(`Failed to create and join room: ${error.message}`);
  }
}

export async function createAndJoinLounge({
  loungeName,
  roomIcon,
  isPublic,
  path,
}: {
  loungeName: string;
  roomIcon: string;
  isPublic: boolean;
  path: string;
}) {
  try {
    const user = await getUserFromCookies();
    if (!user) {
      throw new Error("User not authenticated");
    }
    let lounge = await prisma.realtimeRoom.findUnique({
      where: { id: loungeName },
    });

    if (!lounge) {
      lounge = await prisma.realtimeRoom.create({
        data: {
          id: loungeName,
          room_icon: roomIcon,
          isPublic,
          isLounge: true,
        },
      });
    }

    await prisma.userRealtimeRoom.upsert({
      where: {
        user_id_realtime_room_id: {
          user_id: user.userId!,
          realtime_room_id: loungeName,
        },
      },
      create: {
        user_id: user.userId!,
        realtime_room_id: loungeName,
      },
      update: {
        user_id: user.userId!,
        realtime_room_id: loungeName,
      },
    });
    await generateFriendSuggestions(user.userId!);
    revalidatePath(path);
    return lounge;
  } catch (error: any) {
    throw new Error(`Failed to create lounge: ${error.message}`);
  }
}

export async function getRoomsForUser({ userId }: { userId: bigint }) {
  try {
    const userRoomMemberships = await prisma.userRealtimeRoom.findMany({
      where: {
        user_id: userId,
      },
      include: {
        realtime_room: true,
      },
    });
    return userRoomMemberships.map((membership) => membership.realtime_room);
  } catch (error: any) {
    throw new Error(`Failed to get rooms for user: ${error.message}`);
  }
}

export interface RandomRoom {
  id: string;
  room_icon: string;
}

export async function fetchRandomRooms(count = 4): Promise<RandomRoom[]> {
  try {
    const total = await prisma.realtimeRoom.count();
    const take = Math.min(count, total);
    if (take === 0) return [];
    const skip = Math.max(
      0,
      Math.floor(Math.random() * Math.max(total - take + 1, 1))
    );
    const rooms = await prisma.realtimeRoom.findMany({
      skip,
      take,
      select: { id: true, room_icon: true },
    });
    return rooms;
  } catch (error: any) {
    throw new Error(`Failed to fetch random rooms: ${error.message}`);
  }
}

export async function findOrGenerateInviteToken({
  userId,
  roomId,
}: {
  userId: bigint;
  roomId: string;
}) {
  try {
    const existingInviteToken = await prisma.realtimeRoomInviteToken.findFirst({
      where: { inviting_user_id: userId, realtime_room_id: roomId },
    });
    if (existingInviteToken) {
      return existingInviteToken;
    }
    const inviteToken = await prisma.realtimeRoomInviteToken.create({
      data: {
        inviting_user_id: userId,
        realtime_room_id: roomId,
        token: nanoid(10),
      },
    });
    return inviteToken;
  } catch (error: any) {
    throw new Error(`Failed to generate invite link: ${error.message}`);
  }
}

export async function lookupInviteToken(inviteToken: string) {
  try {
    return await prisma.realtimeRoomInviteToken.findUnique({
      where: { token: inviteToken },
    });
  } catch (error: any) {
    throw new Error(`Failed to lookup invite token: ${error.message}`);
  }
}
