# apply_copy_module.py
import os, textwrap
base = "."
def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p,"w").write(s.strip()+"\n"); print("wrote", p)

types_ts = r'''
import { PrismaClient } from '@prisma/client';
export type CopyContext = {
  prisma: PrismaClient;
  targetSchema: string;
  roomId: string;
  region: string;
  sourceBucket: string;
  targetBucket: string;
  kmsKeyArn: string;
  conversationId?: bigint;
  realtimeRoomId?: string;
};
export type CopyStep = (ctx: CopyContext) => Promise<void>;
export function qident(name: string) { return `"${name.replace(/"/g,'""')}"`; }
'''
sql_ts = r'''
import { PrismaClient } from '@prisma/client';
import { qident } from './types';

export async function getOrderedColumns(prisma: PrismaClient, table: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
      AND (is_generated = 'NEVER' OR is_generated IS NULL)
    ORDER BY ordinal_position
  `, table);
  return rows.map(r => r.column_name);
}

export async function insertSelectWhere(prisma: PrismaClient, targetSchema: string, table: string, whereSql: string, bind: any) {
  const cols = await getOrderedColumns(prisma, table);
  const colList = cols.map(qident).join(', ');
  const src = `"public".${qident(table)}`;
  const dst = `${qident(targetSchema)}.${qident(table)}`;
  const sql = `
    INSERT INTO ${dst} (${colList})
    SELECT ${colList} FROM ${src}
    WHERE ${whereSql}
    ON CONFLICT DO NOTHING
  `;
  await prisma.$executeRawUnsafe(sql, bind);
}

export async function insertSelectWhereSubquery(prisma: PrismaClient, targetSchema: string, table: string, subWhere: string, bind: any) {
  const cols = await getOrderedColumns(prisma, table);
  const colList = cols.map(qident).join(', ');
  const src = `"public".${qident(table)}`;
  const dst = `${qident(targetSchema)}.${qident(table)}`;
  const sql = `
    INSERT INTO ${dst} (${colList})
    SELECT ${colList} FROM ${src}
    WHERE ${subWhere}
    ON CONFLICT DO NOTHING
  `;
  await prisma.$executeRawUnsafe(sql, bind);
}
'''
plan_conv_ts = r'''
import { CopyStep } from './types';
import { insertSelectWhere, insertSelectWhereSubquery } from './sql';

// Conversation-backed room copy plan (ordered for FKs)
export const copyConversationDbRows: CopyStep = async (ctx) => {
  if (!ctx.conversationId) throw new Error('conversationId required');
  const { prisma, targetSchema } = ctx;
  const convId = ctx.conversationId;

  const T = {
    CONV: 'conversations',
    DRIFTS: 'drifts',
    DRIFT_MEMBERS: 'drift_members',
    MSG: 'messages',
    MSG_ATTACH: 'message_attachments',
    SHEAF_META: 'sheaf_message_meta',
    SHEAF_FACETS: 'sheaf_facets',
    SHEAF_ATTACH: 'sheaf_attachments',
    SHEAF_BLOBS: 'sheaf_blobs',
    REACTIONS: 'MessageReaction', // falls back if snake table exists
    MENTIONS: 'message_mentions',
    STARS: 'message_stars',
    BOOKMARKS: 'bookmarks',
    CONV_PARTS: 'conversation_participants',
    CONV_STATE: 'conversation_state',
    POLLS: 'polls',
    VOTES: 'poll_votes',
    LINK_PREVIEWS: 'link_previews',
  };

  await insertSelectWhere(prisma, targetSchema, T.CONV, `"id" = $1`, convId);
  await insertSelectWhere(prisma, targetSchema, T.DRIFTS, `"conversation_id" = $1`, convId);
  await insertSelectWhereSubquery(prisma, targetSchema, T.DRIFT_MEMBERS,
    `"drift_id" IN (SELECT id FROM "public"."drifts" WHERE "conversation_id" = $1)`, convId);

  await insertSelectWhere(prisma, targetSchema, T.MSG, `"conversation_id" = $1`, convId);
  await insertSelectWhereSubquery(prisma, targetSchema, T.MSG_ATTACH,
    `"message_id" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1)`, convId);

  await insertSelectWhereSubquery(prisma, targetSchema, T.SHEAF_META,
    `"messageId" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1)`, convId);
  await insertSelectWhereSubquery(prisma, targetSchema, T.SHEAF_FACETS,
    `"messageId" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1)`, convId);
  await insertSelectWhereSubquery(prisma, targetSchema, T.SHEAF_ATTACH,
    `"facetId" IN (SELECT id FROM "public"."sheaf_facets" WHERE "messageId" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1))`, convId);
  await insertSelectWhereSubquery(prisma, targetSchema, T.SHEAF_BLOBS,
    `"id" IN (SELECT "blobId" FROM "public"."sheaf_attachments" WHERE "facetId" IN (SELECT id FROM "public"."sheaf_facets" WHERE "messageId" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1)))`, convId);

  await insertSelectWhereSubquery(prisma, targetSchema, T.REACTIONS,
    `"messageId" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1)`, convId);
  await insertSelectWhereSubquery(prisma, targetSchema, T.MENTIONS,
    `"messageId" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1)`, convId);

  await insertSelectWhereSubquery(prisma, targetSchema, T.STARS,
    `"message_id" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1)`, convId);
  await insertSelectWhereSubquery(prisma, targetSchema, T.BOOKMARKS,
    `"message_id" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1)`, convId);

  await insertSelectWhere(prisma, targetSchema, T.CONV_PARTS, `"conversation_id" = $1`, convId);
  await insertSelectWhere(prisma, targetSchema, T.CONV_STATE, `"conversationId" = $1`, convId);

  await insertSelectWhere(prisma, targetSchema, T.POLLS, `"conversation_id" = $1`, convId);
  await insertSelectWhereSubquery(prisma, targetSchema, T.VOTES,
    `"poll_id" IN (SELECT id FROM "public"."polls" WHERE "conversation_id" = $1)`, convId);

  await insertSelectWhereSubquery(prisma, targetSchema, T.LINK_PREVIEWS,
    `"facetId" IN (SELECT id FROM "public"."sheaf_facets" WHERE "messageId" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1))`, convId);

  await prisma.$executeRawUnsafe(`ANALYZE "${targetSchema}".*`);
};
'''
plan_rt_ts = r'''
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
'''
index_ts = r'''
import { CopyContext } from './types';
import { copyConversationDbRows } from './plan.conversation';
import { copyRealtimeDbRows } from './plan.realtime';
export * from './types'; // for types re-use

export async function copyRoomDb(ctx: CopyContext) {
  if (ctx.conversationId) return copyConversationDbRows(ctx);
  if (ctx.realtimeRoomId) return copyRealtimeDbRows(ctx);
  throw new Error('copyRoomDb: provide conversationId or realtimeRoomId');
}
'''

write(os.path.join(base, 'server/jobs/copy/types.ts'), types_ts)
write(os.path.join(base, 'server/jobs/copy/sql.ts'), sql_ts)
write(os.path.join(base, 'server/jobs/copy/plan.conversation.ts'), plan_conv_ts)
write(os.path.join(base, 'server/jobs/copy/plan.realtime.ts'), plan_rt_ts)
write(os.path.join(base, 'server/jobs/copy/index.ts'), index_ts)
print("Done.")
