// server/provisioner/orchestrate.ts
import { PrismaClient } from '@prisma/client';
import { createSchema, applyBaseline } from './db';
import { createKmsKey } from './kms';
import { createBucket } from './s3';

export async function provisionShard(globalPrisma: PrismaClient, roomId: string, region: string, baseDbUrl: string, serviceRoleArn: string) {
  const schema = await createSchema(globalPrisma, roomId);
  await applyBaseline(globalPrisma, schema);
  const { kmsKeyArn, aliasName } = await createKmsKey(roomId, region, serviceRoleArn);
  const bucket = await createBucket(roomId, region, kmsKeyArn);

  const shardUrl = `${baseDbUrl}?schema=${encodeURIComponent(schema)}`;
  await globalPrisma.room.update({
    where: { id: roomId },
    data: { isSharded: true, shardUrl, mediaBucket: bucket, kmsKeyArn }
  });
  return { schema, shardUrl, bucket, kmsKeyArn, kmsAlias: aliasName };
}
