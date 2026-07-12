import { CopyStep } from './types';
import { insertSelectWhere, insertSelectWhereSubquery } from './sql';

// Realtime-backed room copy plan
export const copyRealtimeDbRows: CopyStep = async (ctx) => {
  if (!ctx.realtimeRoomId) throw new Error('realtimeRoomId required');
  const { prisma, targetSchema } = ctx;
  const rrid = ctx.realtimeRoomId;

  const T = {
    RR: 'realtime_rooms',
    RR_USERS: 'users_realtime_rooms',
    RR_TOKENS: 'realtime_room_invite_tokens',
    POSTS: 'realtime_posts',
    EDGES: 'realtime_edges',
    LIKES: 'realtime_likes',
    REVIEWS: 'product_reviews',
    CLAIMS: 'product_review_claims',
    VOTES: 'product_review_votes',
    VOUCHES: 'product_review_vouches',
  };

  await insertSelectWhere(prisma, targetSchema, T.RR, `"id" = $1`, rrid);
  await insertSelectWhere(prisma, targetSchema, T.RR_USERS, `"realtime_room_id" = $1`, rrid);
  await insertSelectWhere(prisma, targetSchema, T.RR_TOKENS, `"realtime_room_id" = $1`, rrid);

  await insertSelectWhere(prisma, targetSchema, T.POSTS, `"realtime_room_id" = $1`, rrid);
  await insertSelectWhere(prisma, targetSchema, T.EDGES, `"realtime_room_id" = $1`, rrid);
  await insertSelectWhereSubquery(prisma, targetSchema, T.LIKES,
    `"realtime_post_id" IN (SELECT id FROM "public"."realtime_posts" WHERE "realtime_room_id" = $1)`, rrid);

  await insertSelectWhereSubquery(prisma, targetSchema, T.REVIEWS,
    `"realtime_post_id" IN (SELECT id FROM "public"."realtime_posts" WHERE "realtime_room_id" = $1)`, rrid);
  await insertSelectWhereSubquery(prisma, targetSchema, T.CLAIMS,
    `"review_id" IN (SELECT id FROM "public"."product_reviews" WHERE "realtime_post_id" IN (SELECT id FROM "public"."realtime_posts" WHERE "realtime_room_id" = $1))`, rrid);
  await insertSelectWhereSubquery(prisma, targetSchema, T.VOTES,
    `"claim_id" IN (SELECT id FROM "public"."product_review_claims" WHERE "review_id" IN (SELECT id FROM "public"."product_reviews" WHERE "realtime_post_id" IN (SELECT id FROM "public"."realtime_posts" WHERE "realtime_room_id" = $1)) )`, rrid);
  await insertSelectWhereSubquery(prisma, targetSchema, T.VOUCHES,
    `"claim_id" IN (SELECT id FROM "public"."product_review_claims" WHERE "review_id" IN (SELECT id FROM "public"."product_reviews" WHERE "realtime_post_id" IN (SELECT id FROM "public"."realtime_posts" WHERE "realtime_room_id" = $1)) )`, rrid);

  await prisma.$executeRawUnsafe(`ANALYZE "${targetSchema}".*`);
};
