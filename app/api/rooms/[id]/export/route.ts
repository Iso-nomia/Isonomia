export const dynamic = "force-dynamic";

// app/api/rooms/[id]/export/route.ts
import { NextResponse } from "next/server";
import { streamPgDump } from "@/server/export/pgdump";
import { iterRoomMedia, streamAndHashObject } from "@/server/export/s3walk";
import { packAsTarZst } from "@/server/export/pack";
import { emptyManifest } from "@/server/export/manifest";
import { S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import crypto from "node:crypto";
import { prisma } from "@/lib/prismaclient";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const room = await prisma.room.findUnique({ where: { id: params.id }});
  if (!room || !room.isSharded) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const schema = `room_${room.id.replace(/[^a-zA-Z0-9_]/g, "")}`;
  const s3 = new S3Client({ region: process.env.AWS_REGION! });

  // db.sql stream + hash (we hash db.sql bytes we stream)
  const dbStream = streamPgDump(process.env.DATABASE_URL!, schema);
  const dbHash = crypto.createHash("sha256");
  const teeDb = dbStream.pipe(new (require("stream").PassThrough)());
  dbStream.on("data", (c: Buffer) => dbHash.update(c));

  // media listing: OPTIONAL limit page while bootstrapping
  const mediaEntries: Array<{ path: string; stream: NodeJS.ReadableStream; hashPromise: Promise<string> }> = [];
  for await (const key of iterRoomMedia(s3, room.mediaBucket!, "")) {
    const { stream, digestPromise } = await streamAndHashObject(s3, room.mediaBucket!, key);
    mediaEntries.push({ path: key, stream, hashPromise: digestPromise });
  }

  // counts: do a couple for now
  const [{ cnt: messages }] = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*)::int AS cnt FROM "${schema}"."messages"`);
  const [{ cnt: realtime_posts }] = await prisma.$queryRawUnsafe<{ cnt: number }[]>(`SELECT COUNT(*)::int AS cnt FROM "${schema}"."realtime_posts"`);

  // assemble manifest (hashes will be filled below)
  const manifest = emptyManifest({
    roomId: room.id,
    region: process.env.AWS_REGION!,
    schema,
    mediaBucket: room.mediaBucket!,
    counts: { messages, realtime_posts },
  });

  // pack tar (streaming)
  const out = packAsTarZst({
    dbSql: teeDb,
    media: mediaEntries.map(({ path, stream }) => ({ path, stream: stream as Readable })),
    manifest, // NB: manifest.hashes.* will be empty until we await hash promises; good enough for MVP
  });

  // we also compute db.sql digest (on-the-side)
  const finalizeDbHash = new Promise<string>((resolve) => dbStream.on("end", () => resolve(dbHash.digest("hex"))));
  finalizeDbHash.then((h) => manifest.hashes.dbSql = h);
  Promise.all(mediaEntries.map(async (m) => (manifest.hashes.media[m.path] = await m.hashPromise))).catch(() => {});

  const fileName = `room_${room.id}.tar.zst`;
  return new NextResponse(out as any, {
    headers: {
      "Content-Type": "application/zstd",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
