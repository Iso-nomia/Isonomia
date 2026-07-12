// server/provisioner/s3.ts
import { S3Client, CreateBucketCommand, PutBucketEncryptionCommand, PutBucketLifecycleConfigurationCommand, PutBucketVersioningCommand } from '@aws-sdk/client-s3';

export async function createBucket(roomId: string, region: string, kmsKeyArn: string) {
  const s3 = new S3Client({ region });
  const name = `mesh-room-${roomId}-${region}`.toLowerCase();
  await s3.send(new CreateBucketCommand({ Bucket: name })); // idempotency: if exists, catch elsewhere
  await s3.send(new PutBucketEncryptionCommand({
    Bucket: name,
    ServerSideEncryptionConfiguration: {
      Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'aws:kms', KMSMasterKeyID: kmsKeyArn } }]
    }
  }));
  await ensureLifecycle(s3, name);
  await ensureVersioning(s3, name);
  return name;
}

async function ensureLifecycle(s3: S3Client, bucket: string) {
  await s3.send(new PutBucketLifecycleConfigurationCommand({
    Bucket: bucket,
    LifecycleConfiguration: {
      Rules: [{
        ID: 'IAAfter90d',
        Status: 'Enabled',
        Transitions: [{ Days: 90, StorageClass: 'STANDARD_IA' }]
      }]
    }
  }));
}

async function ensureVersioning(s3: S3Client, bucket: string) {
  await s3.send(new PutBucketVersioningCommand({
    Bucket: bucket,
    VersioningConfiguration: { Status: 'Enabled' }
  }));
}
