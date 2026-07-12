// server/export/s3walk.ts
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import type { ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import crypto from "node:crypto";

export async function* iterRoomMedia(s3: S3Client, bucket: string, prefix = "") {
  let token: string|undefined = undefined;
  do {
    const page: ListObjectsV2CommandOutput = await s3.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: prefix, ContinuationToken: token
    }));
    token = page.NextContinuationToken;
    for (const o of page.Contents ?? []) {
      if (!o.Key) continue;
      yield o.Key;
    }
  } while (token);
}

export async function streamAndHashObject(s3: S3Client, bucket: string, key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const hash = crypto.createHash("sha256");
  const body = res.Body as any as NodeJS.ReadableStream;
  body.on("data", (c: Buffer) => hash.update(c));
  return { stream: body, digestPromise: new Promise<string>((resolve, reject) => {
    body.on("end", () => resolve(hash.digest("hex")));
    body.on("error", reject);
  })};
}
