// Stub: import/restore helpers (server-side, not yet implemented in this deployment)
import type { S3Client } from "@aws-sdk/client-s3";

export async function unpackTarZstToTmp(_data: ArrayBuffer): Promise<string> {
  throw new Error("unpackTarZstToTmp: not implemented in this deployment");
}

export async function restoreDbFromFile(_shardUrl: string, _sqlFile: string): Promise<void> {
  throw new Error("restoreDbFromFile: not implemented in this deployment");
}

export async function uploadMediaFolder(_s3: S3Client, _bucket: string, _folder: string): Promise<void> {
  throw new Error("uploadMediaFolder: not implemented in this deployment");
}
