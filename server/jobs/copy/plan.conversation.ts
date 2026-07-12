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
