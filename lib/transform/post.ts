import type { BasePost } from "@/lib/types/post";

export const mapRealtimePost = (dbRow: any): BasePost => ({
  id: dbRow.id,
  canonicalId: dbRow.postId          // ✅ correct link
  ?? dbRow.post_id      // (legacy)
  ?? dbRow.id,             // realtime rows *are* canonical

  author: dbRow.author,
  type: dbRow.type,
  content: dbRow.content ?? null,
  roomPostContent: dbRow.room_post_content ?? dbRow.roomPostContent ?? null,
  image_url: dbRow.image_url ?? null,
  productReview: dbRow.productReview?? null,
  video_url: dbRow.video_url ?? null,
  caption: (dbRow as any).caption ?? null,
  pluginType: (dbRow as any).pluginType ?? null,
  pluginData: (dbRow as any).pluginData ?? null,
  predictionMarket: (dbRow as any).predictionMarket ?? null,
  claimIds:
    dbRow.productReview?.claims?.map((c: any) => c.id.toString()) ?? [],
  likeCount: dbRow.like_count ?? dbRow.likeCount ?? 0,
  commentCount: dbRow._count?.children ?? dbRow.commentCount ?? 0,
  expirationDate: dbRow.expiration_date ?? null,
  createdAt: dbRow.created_at
  ? new Date(dbRow.created_at).toISOString()
  : new Date().toISOString(),
});
export function canonicalIdOf(row: { type: string; id: bigint; post_id?: bigint | null }) {
  return row.type === "PREDICTION" ? row.id : row.post_id ?? row.id;
}
export const mapFeedPost = (dbRow: any): BasePost => ({
  id: dbRow.id,
  canonicalId:
    dbRow.type === "PREDICTION"
      ? dbRow.id                // <- thread/[id] must point to feed row
      : dbRow.postId ?? dbRow.id,  post_id: dbRow.postId ?? null,
// canonicalId: canonicalIdOf(dbRow),
  author: dbRow.author,
  type: dbRow.type,
  content: dbRow.content ?? null,
  roomPostContent: dbRow.room_post_content ?? dbRow.roomPostContent ?? null,
  image_url: dbRow.image_url ?? null,
  productReview: dbRow.productReview?? null,

  video_url: dbRow.video_url ?? null,
  caption: (dbRow as any).caption ?? null,
  pluginType: (dbRow as any).pluginType ?? null,
  pluginData: (dbRow as any).pluginData ?? null,
  predictionMarket: (dbRow as any).predictionMarket ?? null,
  claimIds:
    dbRow.productReview?.claims?.map((c: any) => c.id.toString()) ?? [],
  likeCount: dbRow.like_count ?? dbRow.likeCount ?? 0,
  // commentCount: dbRow.commentCount ?? 0,
  commentCount: dbRow._count?.children ?? 0,   // instead of row.commentCount

  expirationDate: dbRow.expiration_date ?? null,
  currentUserLike: (dbRow as any).currentUserLike ?? null,
  createdAt: dbRow.created_at
  ? new Date(dbRow.created_at).toISOString()
  : new Date().toISOString(),
});
