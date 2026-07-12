import { CopyStep } from './types';
import { S3Client, CopyObjectCommand } from '@aws-sdk/client-s3';

function parseS3Url(url: string): { bucket: string; key: string } | null {
  try {
    if (url.startsWith('s3://')) {
      const without = url.slice(5);
      const idx = without.indexOf('/');
      return { bucket: without.slice(0, idx), key: decodeURIComponent(without.slice(idx + 1)) };
    }
    const u = new URL(url);
    if (u.hostname.endsWith('.s3.amazonaws.com')) {
      const bucket = u.hostname.split('.s3.amazonaws.com')[0];
      const key = u.pathname.replace(/^\//, '');
      return { bucket, key: decodeURIComponent(key) };
    }
    if (u.hostname === 's3.amazonaws.com') {
      const parts = u.pathname.replace(/^\//, '').split('/');
      const bucket = parts.shift()!;
      const key = parts.join('/');
      return { bucket, key: decodeURIComponent(key) };
    }
    return null;
  } catch { return null; }
}

async function copyObject(s3: S3Client, sourceBucket: string, key: string, targetBucket: string, kmsKeyArn: string) {
  await s3.send(new CopyObjectCommand({
    Bucket: targetBucket,
    Key: key,
    CopySource: `/${sourceBucket}/${encodeURIComponent(key)}`,
    ServerSideEncryption: 'aws:kms',
    SSEKMSKeyId: kmsKeyArn,
    MetadataDirective: 'COPY'
  }));
}

export const copyConversationMedia: CopyStep = async (ctx) => {
  if (!ctx.conversationId) return;
  const { prisma, region, sourceBucket, targetBucket, kmsKeyArn } = ctx;
  const s3 = new S3Client({ region });

  const attachments = await prisma.$queryRawUnsafe<{ path: string }[]>(`
    SELECT "path" FROM "public"."message_attachments"
    WHERE "message_id" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1)
  `, ctx.conversationId);
  for (const a of attachments) {
    if (!a.path) continue;
    await copyObject(s3, sourceBucket, a.path, targetBucket, kmsKeyArn);
  }

//   If you eventually want to also rewrite sheaf_blobs.path to the room bucket
//    (instead of leaving the original path), add this after the copy:
//   await prisma.$executeRawUnsafe(`
//   UPDATE "public"."sheaf_blobs"
//   SET "path" = regexp_replace("path", 's3://[^/]+/', 's3://${targetBucket}/')
//   WHERE "id" IN (
//     SELECT "blobId" FROM "public"."sheaf_attachments"
//     WHERE "facetId" IN (
//       SELECT id FROM "public"."sheaf_facets"
//       WHERE "messageId" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1)
//     )
//   )
// `, ctx.conversationId);

  const blobs = await prisma.$queryRawUnsafe<{ path: string | null }[]>(`
    SELECT "path" FROM "public"."sheaf_blobs"
    WHERE "id" IN (
      SELECT "blobId" FROM "public"."sheaf_attachments"
      WHERE "facetId" IN (
        SELECT id FROM "public"."sheaf_facets"
        WHERE "messageId" IN (SELECT id FROM "public"."messages" WHERE "conversation_id" = $1)
      )
    )
  `, ctx.conversationId);

  for (const b of blobs) {
    if (!b.path) continue;
    const parsed = parseS3Url(b.path);
    if (!parsed) continue;
    if (parsed.bucket !== sourceBucket) continue;
    await copyObject(s3, parsed.bucket, parsed.key, targetBucket, kmsKeyArn);
    // optional: rewrite path to room-bucket after DB copy if desired
  }
};

export const copyRealtimeMedia: CopyStep = async (ctx) => {
  if (!ctx.realtimeRoomId) return;
  const { prisma, region, sourceBucket, targetBucket, kmsKeyArn } = ctx;
  const s3 = new S3Client({ region });
  const posts = await prisma.$queryRawUnsafe<{ id: bigint; image_url: string | null; video_url: string | null }[]>(`
    SELECT id, image_url, video_url FROM "public"."realtime_posts"
    WHERE "realtime_room_id" = $1
  `, ctx.realtimeRoomId);

  for (const p of posts) {
    const updates: { field: 'image_url'|'video_url'; value: string }[] = [];
    if (p.image_url) {
      const parsed = parseS3Url(p.image_url);
      if (parsed && parsed.bucket === sourceBucket) {
        await copyObject(s3, parsed.bucket, parsed.key, targetBucket, kmsKeyArn);
        updates.push({ field: 'image_url', value: `s3://${targetBucket}/${parsed.key}` });
      }
    }
    if (p.video_url) {
      const parsed = parseS3Url(p.video_url);
      if (parsed && parsed.bucket === sourceBucket) {
        await copyObject(s3, parsed.bucket, parsed.key, targetBucket, kmsKeyArn);
        updates.push({ field: 'video_url', value: `s3://${targetBucket}/${parsed.key}` });
      }
    }
    if (updates.length) {
      const setSql = updates.map((u, i) => `"${u.field}" = $${i+2}`).join(', ');
      const params = [p.id, ...updates.map(u => u.value)];
      await prisma.$executeRawUnsafe(`UPDATE "public"."realtime_posts" SET ${setSql} WHERE id = $1`, ...params);
    }
  }
};
