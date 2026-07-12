export const dynamic = "force-dynamic";

// app/api/rooms/import/route.ts
import { NextResponse } from "next/server";
import { provisionShard } from "@/server/shards/provision";
import { prisma } from "@/lib/prismaclient";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createReceipt } from "@/server/trust/receipt";
import { unpackTarZstToTmp, restoreDbFromFile, uploadMediaFolder } from "@/server/import/restore";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const region = url.searchParams.get("region") ?? process.env.AWS_REGION!;
  const roomId = crypto.randomUUID(); // or reuse manifest.roomId with suffix

  // 1) read body into tmp file
  const tmp = await unpackTarZstToTmp(await req.arrayBuffer());

  // 2) provision new shard/bucket/kms
  const prov = await provisionShard(roomId, region);

  // 3) restore db.sql
  await restoreDbFromFile(prov.shardUrl, `${tmp}/db.sql`);

  // 4) upload media/* to room bucket
  const s3 = new S3Client({ region });
  await uploadMediaFolder(s3, prov.mediaBucket, `${tmp}/media`);

  // 5) receipt
  const receipt = createReceipt({
    roomId, region, bucket: prov.mediaBucket, kmsAlias: `alias/mesh/room/${roomId}`, shardUrl: prov.shardUrl, manifestHash: null
  });
  await s3.send(new PutObjectCommand({ Bucket: prov.mediaBucket, Key: '__sovereignty/receipt.json', Body: Buffer.from(JSON.stringify(receipt)) }));

  return NextResponse.json({ ok: true, roomId });
}
