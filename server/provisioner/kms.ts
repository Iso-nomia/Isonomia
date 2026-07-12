// server/provisioner/kms.ts
import { KMSClient, CreateKeyCommand, CreateAliasCommand, CreateGrantCommand, RetireGrantCommand, ListGrantsCommand, UpdateAliasCommand } from '@aws-sdk/client-kms';

export async function createKmsKey(roomId: string, region: string, serviceRoleArn: string) {
  const kms = new KMSClient({ region });
  const key = await kms.send(new CreateKeyCommand({
    Description: `Mesh room ${roomId}`,
    Tags: [{ TagKey: 'RoomId', TagValue: roomId }]
  }));
  const keyId = key.KeyMetadata!.KeyId!;
  const kmsKeyArn = key.KeyMetadata!.Arn!;
  const aliasName = `alias/mesh/room/${roomId}`;
  await kms.send(new CreateAliasCommand({ AliasName: aliasName, TargetKeyId: keyId }));
  await kms.send(new CreateGrantCommand({
    KeyId: keyId,
    GranteePrincipal: serviceRoleArn,
    Operations: ['Encrypt','Decrypt','GenerateDataKey','ReEncryptFrom','ReEncryptTo','DescribeKey']
  }));
  return { kmsKeyArn, aliasName };
}

export async function revokeMeshGrant(region: string, keyId: string, granteePrincipal: string) {
  const kms = new KMSClient({ region });
  const grants = await kms.send(new ListGrantsCommand({ KeyId: keyId }));
  const grant = grants.Grants?.find(g => g.GranteePrincipal === granteePrincipal);
  if (grant?.GrantId) {
    await kms.send(new RetireGrantCommand({ GrantId: grant.GrantId, KeyId: keyId }));
  }
}

export async function rotateKey(region: string, aliasName: string) {
  const kms = new KMSClient({ region });
  const key = await kms.send(new CreateKeyCommand({
    Description: `Rotated key for ${aliasName}`
  }));
  await kms.send(new UpdateAliasCommand({ AliasName: aliasName, TargetKeyId: key.KeyMetadata!.KeyId! }));
  return key.KeyMetadata!.Arn!;
}
