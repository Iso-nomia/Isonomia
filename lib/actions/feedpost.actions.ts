// lib/actions/feedpost.actions.ts
"use server";

import { prisma } from "../prismaclient";
import { getUserFromCookies } from "../serverutils";
import { feed_post_type } from "@prisma/client"; // ✅ runtime enum

interface CreateFeedPostParams {
  caption?: string;
  content?: string;
  imageUrl?: string;
  videoUrl?: string;
  isPublic?: boolean;
  productReview?: {
    productName: string;
    rating: number; // 1 – 5
    summary: string;
    productLink?: string;
    images?: string[];
    claims?: string[];
  };
  stackId?: string;
  libraryPostId?: string;
  postType: feed_post_type;
  articleId?: string;
}

export async function createFeedPost({
  caption = "",
  content = "",
  imageUrl,
  videoUrl,
  isPublic = true,
  productReview,
  stackId,
  libraryPostId,
  articleId,
    postType,
}: CreateFeedPostParams) {
  const user = await getUserFromCookies();
  if (!user || user.userId == null) throw new Error("Unauthenticated");
  const authorId = BigInt(user.userId);

  const post = await prisma.feedPost.create({
    data: {
      author_id: authorId,
      type: postType, // ✅ correct Prisma column
      isPublic: isPublic ?? true,
      content: content ?? null,
      caption: caption ?? null,
      image_url: imageUrl ?? null,
      video_url: videoUrl ?? null,

      articleId: articleId ?? null,
      ...(stackId && { stack_id: stackId }),
      ...(libraryPostId && { library_post_id: libraryPostId }),
      // now a real enum value
      /* 1-to-1 relation – create ProductReview + nested claims */
      ...(productReview && {
        productReview: {
          create: {
            author_id: authorId,
            product_name: productReview.productName,
            rating: productReview.rating,
            ...(productReview.summary && { summary: productReview.summary }),
            ...(productReview.productLink && { product_link: productReview.productLink }),
            image_urls: productReview.images ?? [],
            claims: {
              create: (productReview.claims ?? []).map((t) => ({ text: t })),
            },
          },
        },
      }),
    },
  });
  return post;
}
