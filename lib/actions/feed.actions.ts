'use server';
import { prisma } from "../prismaclient";
import { getUserFromCookies } from "@/lib/serverutils"; // server‑only util
import { revalidatePath } from "next/cache";
import { jsonSafe } from "../bigintjson";
import { canRepost } from "@/lib/repostPolicy";
import { JsonValue } from "tldraw";


export interface LibraryPayload{
     kind: "single" | "stack";
     libraryPostId: string | null;
     coverUrl: string | null;
     coverUrls: string[];
     size: number;
     stackId?: string;
     caption?: string;
}
export interface CreateFeedPostArgs {
  type:
    | "TEXT"
    | "IMAGE"
    | "VIDEO"
    | "GALLERY"
    | "PREDICTION"
    | "PRODUCT_REVIEW"
    | "MUSIC"
    | "LIVECHAT"
    | "ARTICLE"
    | "LIBRARY";
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;


  productReview?: {
    productName: string;
    rating: number;
    summary: string;
    productLink?: string;
    images?: string[];
    claims?: string[];
  };

  text?: string;
  template?: string;
  heroImageKey?: string;
  title?: string;
    slug?: string;
    status?: string;
    astJson?: JsonValue;
    analytics?: JsonValue;
  path: string;
  coordinates: { x: number; y: number };
  realtimeRoomId: string;
  isPublic?: boolean;
  articleId?: string;
  stackId?: string;         // 👈 NEW
  libraryPostId?: string;   // 👈 NEW
library?: LibraryPayload;
  pluginType?: string;
  pluginData?: Record<string, unknown>;
  roomPostContent?: Record<string, unknown>;
}

export async function createFeedPost(
  args: CreateFeedPostArgs
): Promise<{ postId: bigint }> {
  const user = await getUserFromCookies(); // ← **server** side
  if (!user) throw new Error("Not authenticated");

  // const user = await getUserFromCookies();


    /* 1️⃣ Create the canonical post row */
    // const master = await prisma.feedPost.create({
    //   data: {
    //     author_id: user.userId!,
    //     type,
    //     isPublic,
    //     content: rest.content ?? null,
    //     image_url: rest.imageUrl ?? null,
    //     video_url: rest.videoUrl ?? null,
    //     caption:  rest.caption  ?? null,
    //   },
    // });


  // /* 2️⃣ Create the feed row that points at it */
  // const feed = await prisma.feedPost.create({
  //   data: {
  //     post_id:   master.id,        // 🔑 FK
  //     author_id: user.userId!,
  //     type,
  //     isPublic,
  //     ...(rest.content && { content: rest.content }),
  //     ...(rest.imageUrl && { image_url: rest.imageUrl }),
  //     ...(rest.videoUrl && { video_url: rest.videoUrl }),
  //     ...(rest.caption && { caption: rest.caption }),
  //   },
  // });

  const { type, isPublic = true, ...rest } = args;
  const post = await prisma.feedPost.create({
    data: {
      author_id: BigInt(user.userId!),
       type,
      isPublic,
      ...(rest.content && { content: rest.content }),
      ...(rest.imageUrl && { image_url: rest.imageUrl }),
      ...(rest.videoUrl && { video_url: rest.videoUrl }),
      ...(rest.caption && { caption: rest.caption }),
      ...(rest.libraryPostId && { library_post_id: rest.libraryPostId }),
      ...(rest.stackId && { stack_id: rest.stackId }),
      ...(rest.articleId && { articleId: rest.articleId }),
      ...(rest.productReview && {
        productReview: {
          create: {
            author_id: BigInt(user.userId!),
            product_name: rest.productReview.productName,
            rating: rest.productReview.rating,
            ...(rest.productReview.summary && {
              summary: rest.productReview.summary,
            }),
            ...(rest.productReview.productLink && {
              product_link: rest.productReview.productLink,
            }),
            image_urls: rest.productReview.images ?? [],
            claims: {
              create: (rest.productReview.claims ?? []).map((text) => ({
                text,
              })),
            },
          },
        },
      }),
    },
  });

  return jsonSafe({ postId: post.id });
}

// export async function archiveExpiredFeedPosts() {
//   const now = new Date();
//   const expired = await prisma.feedPost.findMany({
//     where: { expiration_date: { lte: now } },
//   });
//   if (expired.length === 0) return;
//   const ids = expired.map((p) => p.id);
//   await prisma.feedPost.deleteMany({ where: { id: { in: ids } } });
// }
// export async function archiveExpiredFeedPosts() {
//   const now = new Date();

//   const expired = await prisma.feedPost.findMany({
//     where: { expiration_date: { lte: now } },      // ➜ error #1
//   });
//   if (expired.length === 0) return;

//   const ids = expired.map((p) => p.id);

//   await prisma.$transaction([
//     prisma.predictionMarket.deleteMany({ where: { postId: { in: ids } } }),
//     prisma.feedPost.deleteMany({ where: { id: { in: ids } } }),
//   ]);
// }
// export async function archiveExpiredFeedPosts() {
//   const now = new Date();                        // 1️⃣ declare

//   // 2️⃣ find every expired post (snake-case field)
//   const expired = await prisma.feedPost.findMany({
//     where: {
//       expiration_date: { lte: now },
//     },
//     select: { id: true },
//   });
//   if (expired.length === 0) return;

//   const ids = expired.map(p => p.id);

//   // 3️⃣ delete in the right order inside one transaction
//   await prisma.$transaction([
//     prisma.predictionMarket.deleteMany({
//       where: { postId: { in: ids } },
//     }),
//     prisma.feedPost.deleteMany({
//       where: { id: { in: ids } },
//     }),
//   ]);
// }
 // ❶ IDs of all expired posts
 export async function archiveExpiredFeedPosts() {
  const now = new Date();   // ← bring “now” back
 const ids = await prisma.feedPost.findMany({
  where: { expiration_date: { lte: now } },
  select: { id: true },
}).then(rows => rows.map(r => r.id));

if (ids.length === 0) return;

await prisma.$transaction([
  // delete trades first → then markets → then posts
  prisma.trade.deleteMany({ where: { market: { postId: { in: ids } } } }),
  prisma.predictionMarket.deleteMany({ where: { postId: { in: ids } } }),
  prisma.feedPost.deleteMany({ where: { id: { in: ids } } }),
]);
}

// export async function fetchFeedPosts() {
//   await archiveExpiredFeedPosts();
//   const posts = await prisma.feedPost.findMany({
//     where: {
//       isPublic: true,
//       OR: [{ expiration_date: null }, { expiration_date: { gt: new Date() } }],
//     },
//     orderBy: { created_at: "desc" },
//     include: {
//       predictionMarket: {
//         select: {
//           id: true,
//           question: true,
//           yesPool: true,
//           noPool: true,
//           b: true,
//           state: true,
//           outcome: true,
//           closesAt: true,
//         },
//       },
//       author: true,
//     },
//   });
//   return posts.map((p) => ({ ...p }));
// }
export async function fetchFeedPosts() {
  await archiveExpiredFeedPosts();

  const user = await getUserFromCookies();
  const currentUserId = user?.userId ? BigInt(user.userId) : null;

  const rows = await prisma.feedPost.findMany({
    where: {
      isPublic: true,
      parent_id: null,
      OR: [
        { expiration_date: null },
        { expiration_date: { gt: new Date() } },
      ],
    },
    orderBy: { created_at: "desc" },

    /* 👇 use select so scalar `post_id` is available */
    select: {
      id: true,                 // feed‑row PK
      type: true,
      content: true,
      library_post_id: true,
      stack_id: true,
      image_url: true,

      video_url: true,
      caption: true,
      like_count: true,
    
      // commentCount: true,
      _count: { select: { children: true } },   // children = replies

      expiration_date: true,
      created_at: true,

      predictionMarket: {
        select: {
          id: true,
          question: true,
          yesPool: true,
          noPool: true,
          b: true,
          state: true,
          outcome: true,
          closesAt: true,
        },
      },
      author: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  const postIds = rows
    .map((r) => r.id)
    .filter((id): id is bigint => id !== null);

  let userLikes: Record<string, any> = {};
  if (currentUserId && postIds.length) {
    const likes = await prisma.like.findMany({
      where: { user_id: currentUserId, feed_post_id: { in: postIds } },
    });
    userLikes = Object.fromEntries(
      likes.map((l) => [l.feed_post_id.toString(), l])
    );
  }

  const rowsWithLike = rows.map((r) => ({
    ...r,
    currentUserLike: r.id
      ? userLikes[r.id.toString()] ?? null
      : null,
  }));

 // 🔽 Hydrate LIBRARY covers from library_posts
    const stackIds = Array.from(
       new Set(rowsWithLike.filter(r => r.type === "LIBRARY" && r.stack_id).map(r => r.stack_id as string))
     );
     const singleIds = Array.from(
       new Set(rowsWithLike.filter(r => r.type === "LIBRARY" && r.library_post_id).map(r => r.library_post_id as string))
     );
   
     let stackCovers: Record<string, { urls: string[]; size: number }> = {};
     if (stackIds.length) {
       const items = await prisma.libraryPost.findMany({
         where: { stack_id: { in: stackIds } },
         orderBy: { created_at: "asc" },
         select: { id: true, stack_id: true, thumb_urls: true },
       });
       const grouped = new Map<string, string[]>();
       for (const it of items) {
         const k = it.stack_id!;
         const arr = grouped.get(k) ?? [];
         const u = (it.thumb_urls?.[0] ?? null);
         if (u) arr.push(u);
         grouped.set(k, arr);
       }
       stackCovers = Object.fromEntries(
         Array.from(grouped.entries()).map(([k, arr]) => [k, { urls: arr, size: arr.length }])
       );
     }
   
     const singleCovers = singleIds.length
       ? Object.fromEntries(
           (await prisma.libraryPost.findMany({
             where: { id: { in: singleIds } },
             select: { id: true, thumb_urls: true },
           })).map(lp => [lp.id, lp.thumb_urls?.[0] ?? null])
         )
       : {};
   
     const hydrated = rowsWithLike.map((r) => {
       if (r.type !== "LIBRARY") return r;
       if (r.stack_id && stackCovers[r.stack_id]) {
         const { urls, size } = stackCovers[r.stack_id];
         return {
           ...r,
           library: { kind: "stack", stackId: r.stack_id, coverUrls: urls, size },
         };
       }
       if (r.library_post_id) {
         const cover = singleCovers[r.library_post_id] ?? null;
         return {
           ...r,
           library: { kind: "single", libraryPostId: r.library_post_id, coverUrl: cover, coverUrls: [], size: 1 },
         };
       }
       // fallback: try content JSON or leave as-is
       try {
         return { ...r, library: r.content ? JSON.parse(r.content) : undefined };
       } catch { return r; }
     });
   
     return hydrated; // includes currentUserLike + library hydration
   }
export async function deleteFeedPost({
  id,
  path,
}: {
  id: bigint;
  path?: string;
}) {
  const user = await getUserFromCookies();
  if (!user) return;
  const post = await prisma.feedPost.findUnique({ where: { id } });
  if (!post || post.author_id !== user.userId) return;
  const ids: bigint[] = [];
  const collect = async (postId: bigint) => {
    const children = await prisma.feedPost.findMany({
      where: { parent_id: postId },
      select: { id: true },
    });
    for (const child of children) {
      await collect(child.id);
    }
    ids.push(postId);
  };
  await collect(id);
  await prisma.feedPost.deleteMany({ where: { id: { in: ids } } });
  if (path) revalidatePath(path);
}

export async function replicateFeedPost({
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
  const oid = BigInt(originalPostId);
  const uid = BigInt(userId);
  const original = await prisma.feedPost.findUnique({ where: { id: oid } });
  if (!original) throw new Error("Feed post not found");
  if (!canRepost(original.type)) {
    throw new Error("Post type not allowed to be replicated");
  }
  // const payload = JSON.stringify({ id: oid.toString(), text });
  const payload = JSON.stringify({
    id: oid.toString(),
    text,
    source: "feed",
  });
  const newPost = await prisma.feedPost.create({
    data: {
      content: `REPLICATE:${payload}`,
      author_id: uid,
      type: "TEXT",
      isPublic: true,
    },
  });
  if (path) revalidatePath(path);
  return newPost;
}

