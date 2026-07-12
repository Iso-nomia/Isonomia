"use server";

import { prisma } from "../prismaclient";
import { revalidatePath } from "next/cache";
import { getUserFromCookies } from "@/lib/serverutils";

interface CreateRealtimeEdgeParams {
  path: string;
  sourceNodeId: bigint;
  targetNodeId: bigint;
  realtimeRoomId: string;
}

interface UpdateRealtimeEdgeParams {
  id: string;
  sourceNodeId?: bigint;
  targetNodeId?: bigint;
  path: string;
}

export async function createRealtimeEdge({
  path,
  sourceNodeId,
  targetNodeId,
  realtimeRoomId,
}: CreateRealtimeEdgeParams) {
  const user = await getUserFromCookies();
  if (!user) {
    throw new Error("User not authenticated");
  }
  try {
    const createdRealtimeEdge = await prisma.realtimeEdge.create({
      data: {
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        author_id: user.userId!,
        realtime_room_id: realtimeRoomId,
      },
    });
    await prisma.user.update({
      where: {
        id: user.userId!,
      },
      data: {
        realtimeedges: {
          connect: {
            id: createdRealtimeEdge.id,
          },
        },
      },
    });
    await prisma.realtimePost.update({
      where: {
        id: sourceNodeId,
      },
      data: {
        outgoing_edges: {
          connect: {
            id: createdRealtimeEdge.id,
          },
        },
      },
    });
    await prisma.realtimePost.update({
      where: {
        id: targetNodeId,
      },
      data: {
        incoming_edges: {
          connect: {
            id: createdRealtimeEdge.id,
          },
        },
      },
    });

    revalidatePath(path);
    return createdRealtimeEdge;
  } catch (error: any) {
    throw new Error(`Failed to create real-time edge: ${error.message}`);
  }
}

export async function updateRealtimeEdge({
  id,
  sourceNodeId,
  targetNodeId,
  path,
}: UpdateRealtimeEdgeParams) {
  const user = await getUserFromCookies();
  try {
    const originalEdge = await prisma.realtimeEdge.findUniqueOrThrow({
      where: {
        id: BigInt(id),
      },
    });
    if (user!.userId != originalEdge!.author_id) {
      throw new Error(`User is not allowed to update this edge`);
    }
    await prisma.realtimeEdge.update({
      where: {
        id: BigInt(id),
      },
      data: {
        ...(sourceNodeId && { source_node_id: sourceNodeId }),
        ...(targetNodeId && { target_node_id: targetNodeId }),
      },
    });
    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to update real-time edge: ${error.message}`);
  }
}

export async function fetchRealtimeEdges({
  realtimeRoomId,
}: {
  realtimeRoomId: string;
}) {

  const realtimeEdges = await prisma.realtimeEdge.findMany({
    where: {
      realtime_room_id: realtimeRoomId,
    },
  });

  return realtimeEdges;
}

export async function deleteRealtimeEdge({ id }: { id: string }) {
  const user = await getUserFromCookies();
  const originalEdge = await prisma.realtimeEdge.findUniqueOrThrow({
    where: {
      id: BigInt(id),
    },
  });
  if (user!.userId != originalEdge!.author_id) {
    throw new Error(`User is not allowed to update this edge`);
  }
  await prisma.realtimeEdge.delete({
    where: {
      id: BigInt(id),
    },
  });
}
