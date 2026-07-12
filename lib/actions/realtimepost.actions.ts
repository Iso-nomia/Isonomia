"use server";


import { Prisma, realtime_post_type } from "@prisma/client";
import { prisma } from "../prismaclient";
import { revalidatePath } from "next/cache";
import { getUserFromCookies } from "@/lib/serverutils";
import { createProductReview } from "./productreview.actions";
import { canRepost } from "@/lib/repostPolicy";


export interface CreateRealtimePostParams {
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
  path: string;
  coordinates: { x: number; y: number };
  type: realtime_post_type | "MUSIC";
  realtimeRoomId: string;
  isPublic?: boolean;
  collageLayoutStyle?: string;  // or some enum
  collageColumns?: number;
  collageGap?: number;
  pluginType?: string;
  pluginData?: Record<string, unknown>;
  roomPostContent?: Record<string, unknown>;
}

interface UpdateRealtimePostParams {
  id: string;
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;

  coordinates?: { x: number; y: number };
  path: string;
  isPublic?: boolean;
  collageLayoutStyle?: string;  // or some enum
  collageColumns?: number;
  collageGap?: number;
  content?: string;
  pluginType?: string;
  pluginData?: Record<string, unknown>;
  roomPostContent?: Record<string, unknown>;
}



export async function createRealtimePost({
  text,
  imageUrl,
  videoUrl,
  caption,
  path,
  coordinates,
  type,
  realtimeRoomId,
  isPublic = false,
   //  collage fields
   collageLayoutStyle,
   collageColumns,
   collageGap,
   pluginType,
   pluginData,
   roomPostContent,
}: CreateRealtimePostParams) {
  const user = await getUserFromCookies();
  if (!user) {
    throw new Error("User not authenticated");
  }
  try {
    const prismaType: realtime_post_type = type as realtime_post_type;

    const createdRealtimePost = await prisma.realtimePost.create({
      data: {
        ...(text && { content: text }),
        ...(imageUrl && { image_url: imageUrl }),
       ...(videoUrl && { video_url: videoUrl }),
        ...(caption && { caption }),
        author_id: user.userId!,
        x_coordinate: new Prisma.Decimal(coordinates.x),
        y_coordinate: new Prisma.Decimal(coordinates.y),
        type: prismaType,
        realtime_room_id: realtimeRoomId,
        locked: false,
        isPublic,
        ...(pluginType && { pluginType }),
        ...(pluginData && { pluginData: pluginData as Prisma.InputJsonValue }),
        ...(roomPostContent && { room_post_content: roomPostContent as Prisma.InputJsonValue }),

         // Collage fields
         ...(collageLayoutStyle && { collageLayoutStyle }),
         ...(collageColumns !== undefined && { collageColumns }),
        ...(collageGap !== undefined && { collageGap }),
      },
    });

    if (type === "PRODUCT_REVIEW" && text) {
      try {
        const parsed = JSON.parse(text);
        await createProductReview({
          realtimePostId: createdRealtimePost.id,
          authorId: user.userId!,
          productName: parsed.productName || "",
          rating: parsed.rating || 5,
          summary: parsed.summary || "",
          productLink: parsed.productLink || "",
          claims: (parsed.claims || []).filter((c: string) => c.trim() !== ""),
          images: parsed.images || [],
        });
      } catch {
        // ignore JSON parse errors
      }
    }
    const author = await prisma.user.update({
      where: {
        id: user.userId!,
      },
      data: {
        realtimeposts: {
          connect: {
            id: createdRealtimePost.id,
          },
        },
      },
    });

    revalidatePath(path);
    return {
      ...createdRealtimePost,
      type,
      author: author,
      x_coordinate: createdRealtimePost.x_coordinate.toNumber(),
      y_coordinate: createdRealtimePost.y_coordinate.toNumber(),
    };
  } catch (error: any) {
    throw new Error(`Failed to create real-time post: ${error.message}`);
  }
}

export async function updateRealtimePost({
  id,
  text,
  videoUrl,
  imageUrl,
  caption,
  coordinates,
  path,
  isPublic,
  //  <-- Add these lines
  collageLayoutStyle,
  collageColumns,
  collageGap,
  content,
  pluginType,
  pluginData,
  roomPostContent,
}: UpdateRealtimePostParams) {
  const user = await getUserFromCookies();
  try {
    const originalPost = await prisma.realtimePost.findUniqueOrThrow({
      where: {
        id: BigInt(id),
      },
    });
    const coordChanged =
      coordinates &&
      (coordinates.x !== originalPost.x_coordinate.toNumber() ||
        coordinates.y !== originalPost.y_coordinate.toNumber());

    if (!user || user.userId != originalPost.author_id) {
      if (!originalPost.isPublic) {
        return;
      }
      if (
        coordChanged ||
        isPublic !== undefined ||
        collageLayoutStyle ||
        collageColumns !== undefined ||
        collageGap !== undefined
      ) {
        return;
      }
    }
    if (originalPost.locked && coordinates) {
      return;
    }
    const updateData: Prisma.RealtimePostUpdateInput = {
      ...(text && { content: text }),
      ...(imageUrl && { image_url: imageUrl }),
      ...(videoUrl && { video_url: videoUrl }),
      ...(caption && { caption }),
      ...(content && { content }),
      ...(collageLayoutStyle && { collageLayoutStyle }),
      ...(collageColumns !== undefined && { collageColumns }),
      ...(collageGap !== undefined && { collageGap }),
      ...(isPublic !== undefined && { isPublic }),
      ...(pluginType && { pluginType }),
      ...(pluginData && { pluginData: pluginData as Prisma.InputJsonValue }),
      ...(roomPostContent && {
        room_post_content: roomPostContent as Prisma.InputJsonValue,
      }),
    };

    if (coordinates && coordChanged) {
      updateData.x_coordinate = new Prisma.Decimal(coordinates.x);
      updateData.y_coordinate = new Prisma.Decimal(coordinates.y);
    }

    await prisma.realtimePost.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    revalidatePath(path);
  } catch (error: any) {
    console.error("Failed to update real-time post:", error);
  }
}

export async function lockRealtimePost({
  id,
  lockState,
  path,
}: {
  id: string;
  lockState: boolean;
  path: string;
}) {
  const user = await getUserFromCookies();
  try {
    const originalPost = await prisma.realtimePost.findUniqueOrThrow({
      where: {
        id: BigInt(id),
      },
    });
    if (!user || user.userId != originalPost.author_id) {
      return;
    }
    await prisma.realtimePost.update({
      where: {
        id: BigInt(id),
      },
      data: {
        locked: lockState,
      },
    });

    revalidatePath(path);
  } catch (error: any) {
    console.error("Failed to update real-time post:", error);
  }
}

export async function archiveOldRealtimePosts(days = 30) {
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const now = new Date();
  const oldPosts = await prisma.realtimePost.findMany({
    where: {
      OR: [
        { created_at: { lte: threshold } },
        { expiration_date: { lte: now } },
      ],
    },
  });
  if (oldPosts.length === 0) return;
  const ids = oldPosts.map((p) => p.id);
  await prisma.$transaction([
    prisma.archivedRealtimePost.createMany({
      data: oldPosts.map((p) => ({
        original_post_id: p.id,
        created_at: p.created_at,
        content: p.content ?? undefined,
        image_url: p.image_url ?? undefined,
        video_url: p.video_url ?? undefined,
        caption: (p as any).caption ?? undefined,
        author_id: p.author_id,
        updated_at: p.updated_at ?? undefined,
        like_count: p.like_count,
        x_coordinate: p.x_coordinate,
        y_coordinate: p.y_coordinate,
        type: p.type,
        realtime_room_id: p.realtime_room_id,
        locked: p.locked,
        collageLayoutStyle: p.collageLayoutStyle ?? undefined,
        collageColumns: p.collageColumns ?? undefined,
        collageGap: p.collageGap ?? undefined,
        isPublic: p.isPublic,
        pluginType: p.pluginType ?? undefined,
        pluginData: p.pluginData ?? undefined,
        parent_id: p.parent_id ?? undefined,
        expiration_date: p.expiration_date ?? undefined,
      })),
      skipDuplicates: true,
    }),
    prisma.realtimePost.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

export async function fetchRealtimePosts({
  realtimeRoomId,
  postTypes,
  pageNumber = 1,
  pageSize = 20,
}: {
  realtimeRoomId: string;
  postTypes: realtime_post_type[];
  pageNumber?: number;
  pageSize?: number;
}) {
  await archiveOldRealtimePosts();
  const skipAmount = (pageNumber - 1) * pageSize;

  const realtimePosts = await prisma.realtimePost.findMany({
    where: {
      realtime_room_id: realtimeRoomId,
      parent_id: null,
      type: {
        in: postTypes,
      },
      OR: [
        { expiration_date: null },
        { expiration_date: { gt: new Date() } },
      ],
    },
    include: {
      author: true,
      _count: { select: { children: true } },
      productReview: { include: { claims: true } },
    },
    orderBy: {
      created_at: "desc",
    },
    skip: skipAmount,
    take: pageSize,
  });

  const totalCount = await prisma.realtimePost.count({
    where: {
      realtime_room_id: realtimeRoomId,
      parent_id: null,
      type: {
        in: postTypes,
      },
      OR: [
        { expiration_date: null },
        { expiration_date: { gt: new Date() } },
      ],
    },
  });

  const postsWithCount = realtimePosts.map((realtimePost) => ({
    ...realtimePost,
    productReview: realtimePost.productReview
      ? {
          ...realtimePost.productReview,
          claims: realtimePost.productReview.claims.map((c) => ({
            ...c,
            id: c.id.toString(),
            review_id: c.review_id.toString(),
          })),
        }
      : null,
    commentCount: realtimePost._count.children,
    x_coordinate: realtimePost.x_coordinate.toNumber(),
    y_coordinate: realtimePost.y_coordinate.toNumber(),
  }));

  const isNext = totalCount > skipAmount + realtimePosts.length;

  return { posts: postsWithCount, isNext };
}

export async function deleteRealtimePost({
  id,
  path,
}: {
  id: string;
  path?: string;
}) {
  const user = await getUserFromCookies();
  try {
    const originalPost = await prisma.realtimePost.findUniqueOrThrow({
      where: {
        id: BigInt(id),
      },
    });
    if (!user || user.userId != originalPost.author_id) {
      return;
    }
    await prisma.realtimePost.delete({
      where: {
        id: BigInt(id),
      },
    });
    if (path) revalidatePath(path);
  } catch (error: any) {
    console.error("Failed to delete real-time post:", error);
  }
}

export async function fetchRealtimePostById({ id }: { id: string }) {
  try {
    const post = await prisma.realtimePost.findUniqueOrThrow({
      where: {
        id: BigInt(id),
      },
      include: {
        author: true,
        _count: { select: { children: true } },
        children: {
          include: { author: true, _count: { select: { children: true } } },
        },
        productReview: { include: { claims: true } },
      },
    });
    return {
      ...post,
      productReview: post.productReview
        ? {
            ...post.productReview,
            claims: post.productReview.claims.map((c: any) => ({
              ...c,
              id: c.id.toString(),
              review_id: c.review_id.toString(),
            })),
          }
        : null,
      commentCount: post._count.children,
      x_coordinate: post.x_coordinate.toNumber(),
      y_coordinate: post.y_coordinate.toNumber(),
      children: post.children.map((c) => ({
        ...c,
        commentCount: c._count.children,
        x_coordinate: c.x_coordinate.toNumber(),
        y_coordinate: c.y_coordinate.toNumber(),
      })),
    };
  } catch (error: any) {
    throw new Error(`Failed to fetch real-time post: ${error.message}`);
  }
}

export async function fetchRealtimePostTreeById({ id }: { id: string }) {

  const post: any = await prisma.realtimePost.findUnique({
    where: { id: BigInt(id) },
    include: {
      author: true,
      _count: { select: { children: true } },
      productReview: { include: { claims: true } },
    },
  });
  if (!post) return null;

  const fetchChildren = async (parentId: bigint): Promise<any[]> => {
    const children: any[] = await prisma.realtimePost.findMany({
      where: { parent_id: parentId },
      include: {
        author: true,
        _count: { select: { children: true } },
        productReview: { include: { claims: true } },
      },
    });
    for (const child of children) {
      child.children = await fetchChildren(child.id);
    }
    return children.map((c) => ({
      ...c,
      productReview: c.productReview
        ? {
            ...c.productReview,
            claims: c.productReview.claims.map((cl: any) => ({
              ...cl,
              id: cl.id.toString(),
              review_id: cl.review_id.toString(),
            })),
          }
        : null,
      commentCount: c._count.children,
      x_coordinate: c.x_coordinate.toNumber(),
      y_coordinate: c.y_coordinate.toNumber(),
      children: c.children,
    }));
  };

  if (post) {
    post.children = await fetchChildren(post.id);
    return {
      ...post,
      productReview: post.productReview
        ? {
            ...post.productReview,
            claims: post.productReview.claims.map((c: any) => ({
              ...c,
              id: c.id.toString(),
              review_id: c.review_id.toString(),
            })),
          }
        : null,
      commentCount: post._count.children,
      x_coordinate: post.x_coordinate.toNumber(),
      y_coordinate: post.y_coordinate.toNumber(),
    };
  }
  return post;
}

export async function addCommentToRealtimePost({
  parentPostId,
  commentText,
  userId,
  path,
}: {
  parentPostId: bigint;
  commentText: string;
  userId: bigint;
  path: string;
}) {
  try {
    const originalPost = await prisma.realtimePost.findUnique({
      where: { id: parentPostId },
    });
    if (!originalPost) throw new Error("Post not found");
    const comment = await prisma.realtimePost.create({
      data: {
        content: commentText,
        author_id: userId,
        parent_id: parentPostId,
        realtime_room_id: originalPost.realtime_room_id,
        type: "TEXT",
        x_coordinate: originalPost.x_coordinate,
        y_coordinate: originalPost.y_coordinate,
        locked: true,
        isPublic: false,
      },
    });
    await prisma.realtimePost.update({
      where: { id: parentPostId },
      data: { children: { connect: { id: comment.id } } },
    });
    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Error adding comment to realtime post ${error.message}`);
  }
}

export async function fetchUserRealtimePosts({
  realtimeRoomId,
  userId,
  postTypes,
}: {
  realtimeRoomId: string;
  userId: bigint;
  postTypes: realtime_post_type[];
}) {
  const realtimePosts = await prisma.realtimePost.findMany({
    where: {
      realtime_room_id: realtimeRoomId,
      author_id: userId,
      type: {
        in: postTypes,
      },
    },
    include: {
      author: true,
      _count: { select: { children: true } },
      productReview: { include: { claims: true } },
    },
    orderBy: {
      created_at: "desc",
    },
  });

  return realtimePosts.map((realtimePost) => ({
    ...realtimePost,
    productReview: realtimePost.productReview
      ? {
          ...realtimePost.productReview,
          claims: realtimePost.productReview.claims.map((c) => ({
            ...c,
            id: c.id.toString(),
            review_id: c.review_id.toString(),
          })),
        }
      : null,
    commentCount: realtimePost._count.children,
    x_coordinate: realtimePost.x_coordinate.toNumber(),
    y_coordinate: realtimePost.y_coordinate.toNumber(),
  }));
}

export async function replicateRealtimePost({
  originalPostId,
  userId,
  path,
  text,
}: {
  originalPostId: string | number | bigint;
  userId: string | number | bigint;
  path: string;
  text?: string;
}) {
  try {
    const oid = BigInt(originalPostId);
    const uid = BigInt(userId);
    const original = await prisma.realtimePost.findUnique({
      where: { id: oid },
    });
    if (!original) throw new Error("Real-time post not found");
    if (!canRepost(original.type)) {
      throw new Error("Post type not allowed to be replicated");
    }
    // const payload = JSON.stringify({ id: oid.toString(), text });
    const payload = JSON.stringify({
         id: oid.toString(),
         text,
         source: "realtime",
       })
    const newPost = await prisma.realtimePost.create({
      data: {
        content: `REPLICATE:${payload}`,
        author_id: uid,
        x_coordinate: original.x_coordinate,
        y_coordinate: original.y_coordinate,
        type: "TEXT",
        realtime_room_id: original.realtime_room_id,
        locked: false,
        isPublic: original.isPublic,
      },
    });
    await prisma.user.update({
      where: { id: uid },
      data: { realtimeposts: { connect: { id: newPost.id } } },
    });
    revalidatePath(path);
    return newPost;
  } catch (error: any) {
    throw new Error(`Failed to replicate real-time post: ${error.message}`);
  }
}
