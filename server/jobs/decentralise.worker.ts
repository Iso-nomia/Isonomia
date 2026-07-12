// server/jobs/decentralise.worker.ts
import { Worker, QueueEvents, Job } from 'bullmq';
import type { CopyContext } from '@/server/jobs/copy';                  // ⬅ type import
import { provisionShard } from '@/server/provisioner/orchestrate';
import { copyRoomDb, copyRoomMedia } from '@/server/jobs/copy';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReceipt } from '@/server/trust/receipt';
import { prisma } from '@/lib/prismaclient';

export type DecentraliseJobData = {
  roomId: string;
  kind: 'CONVERSATION' | 'REALTIME';
  conversationId?: string; // bigint as string
  realtimeRoomId?: string;
  region: string;
  sourceBucket: string;
};

export const decentraliseEvents = new QueueEvents('decentralise', {
  connection: { url: process.env.REDIS_URL! }
});

export const decentraliseWorker = new Worker<DecentraliseJobData>(
  'decentralise',
  async (job: Job<DecentraliseJobData>) => {
    const { roomId, kind, conversationId, realtimeRoomId, region, sourceBucket } = job.data;
    const baseDbUrl = process.env.DATABASE_URL!;
    const serviceRoleArn = process.env.SERVICE_KMS_ROLE_ARN!;

    // 0) Provision shard (schema + bucket + kms), and persist on Room
    const prov = await provisionShard(prisma, roomId, region, baseDbUrl, serviceRoleArn);
    // prov = { schema, shardUrl, bucket, kmsKeyArn, kmsAlias }

    // 1) Build the context passed to copy steps
    const copyCtx: CopyContext = {
      prisma,
      targetSchema: prov.schema,
      roomId,
      region,
      sourceBucket,
      targetBucket: prov.bucket,
      kmsKeyArn: prov.kmsKeyArn,
      conversationId: kind === 'CONVERSATION' && conversationId ? BigInt(conversationId) : undefined,
      realtimeRoomId: kind === 'REALTIME' ? realtimeRoomId : undefined,
    };

    // 2) Helper to push structured progress (SSE will stream job.progress)
    const emit = (data: Record<string, any>) =>
      job.updateProgress({ ts: Date.now(), ...data });

    // 3) COPY DB (with progress + parity counts)
    emit({ step: 'copy-db', status: 'start' });
    await copyRoomDb(copyCtx);
    emit({ step: 'copy-db', status: 'done' });

    // Parity: messages (conversation-backed)
    if (copyCtx.conversationId) {
      const [{ cnt: src }] = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
        `SELECT COUNT(*)::int AS cnt
           FROM public."messages"
          WHERE "conversation_id" = $1`,
        copyCtx.conversationId
      );
      const [{ cnt: dst }] = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
        `SELECT COUNT(*)::int AS cnt
           FROM "${prov.schema}"."messages"`
      );
      emit({ step: 'verify', table: 'messages', src, dst, ok: src === dst });
    }

    // Parity: realtime_posts (realtime-backed)
    if (copyCtx.realtimeRoomId) {
      const [{ cnt: src }] = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
        `SELECT COUNT(*)::int AS cnt
           FROM public."realtime_posts"
          WHERE "realtime_room_id" = $1`,
        copyCtx.realtimeRoomId
      );
      const [{ cnt: dst }] = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
        `SELECT COUNT(*)::int AS cnt
           FROM "${prov.schema}"."realtime_posts"`
      );
      emit({ step: 'verify', table: 'realtime_posts', src, dst, ok: src === dst });
    }

    // 4) COPY MEDIA (with progress)
    emit({ step: 'copy-media', status: 'start' });
    await copyRoomMedia(copyCtx);                    // ⬅ uses your dispatcher
    emit({ step: 'copy-media', status: 'done' });

    // 5) Write a signed Sovereignty Receipt into the room bucket
    const receipt = createReceipt({
      roomId,
      timestamp: new Date().toISOString(),
      region,
      bucket: prov.bucket,
      kmsAlias: `alias/mesh/room/${roomId}`,
      shardUrl: prov.shardUrl ?? null,
      manifestHash: null, // will be filled post-export in Sprint 3
    });

    const s3 = new S3Client({ region });
    await s3.send(new PutObjectCommand({
      Bucket: prov.bucket,
      Key: '__sovereignty/receipt.json',
      Body: Buffer.from(JSON.stringify(receipt)),
      ContentType: 'application/json',
    }));

    emit({ step: 'done', receiptKey: '__sovereignty/receipt.json', bucket: prov.bucket });
    return { ok: true, ...prov };
  },
  { connection: { url: process.env.REDIS_URL! } }
);
