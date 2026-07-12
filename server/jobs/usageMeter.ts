// server/jobs/usageMeter.ts
import { PrismaClient } from '@prisma/client';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';

export async function measureRoom(prisma: PrismaClient, roomId: string, bucket: string, region: string) {
  // DB size approximation: sum table sizes in schema
  const schema = `room_${roomId}`;
  const [{ bytes }] = await prisma.$queryRawUnsafe<{ bytes: bigint }[]>(`
    SELECT COALESCE(SUM(pg_total_relation_size(quote_ident(schemaname)||'.'||quote_ident(tablename))),0) AS bytes
    FROM pg_tables WHERE schemaname = $1
  `, schema);

  const s3 = new S3Client({ region });
  let s3Bytes = 0;
  let token: string | undefined = undefined;
  do {
    const out: ListObjectsV2CommandOutput = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const o of out.Contents ?? []) s3Bytes += o.Size ?? 0;
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);

  return { dbBytes: Number(bytes ?? 0), s3Bytes };
}
