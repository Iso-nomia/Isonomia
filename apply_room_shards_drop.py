# Create a code-first drop (no issues) with regular files under /mnt/data.
import os, textwrap, json, pathlib, sys

base = "."


def write(relpath: str, content: str):
    path = os.path.join(base, relpath)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content.strip() + "\n")
    return "sandbox:" + relpath

created = []

# ------------------------------
# 1) Prisma: additive Room model (as a separate file to paste into schema.prisma)
# ------------------------------
room_model = r"""
// prisma/models/Room.prisma — paste into your main `schema.prisma`
// Then run `pnpm prisma migrate dev -n add_room_model`
// Uses snake_case table mapping for consistency with your schema.
model Room {
  id               String   @id @default(cuid())
  kind             RoomKind
  conversation_id  BigInt?
  realtime_room_id String?

  isSharded   Boolean  @default(false)
  shardUrl    String?  @db.Text
  mediaBucket String?
  kmsKeyArn   String?

  created_at DateTime @default(now()) @db.Timestamptz(6)
  updated_at DateTime @default(now()) @updatedAt @db.Timestamptz(6)

  @@unique([conversation_id], map: "uniq_room_conversation")
  @@unique([realtime_room_id], map: "uniq_room_realtime")
  @@index([isSharded])
  @@map("rooms")
}

enum RoomKind {
  CONVERSATION
  REALTIME
}
"""
created.append(write("prisma/models/Room.prisma", room_model))

# ------------------------------
# 2) Config flags
# ------------------------------
flags_ts = r"""
// server/config/flags.ts
export const flags = {
  roomShards: process.env.ROOM_SHARDS_ENABLED === 'true',
  roomExport: process.env.ROOM_EXPORT_ENABLED === 'true',
  meshLiteLink: process.env.MESH_LITE_LINK || 'https://example.com/mesh-lite',
};
"""
created.append(write("server/config/flags.ts", flags_ts))

# ------------------------------
# 3) Rooms DAO
# ------------------------------
rooms_dao_ts = r"""
// server/rooms/dao.ts
import { PrismaClient, RoomKind } from '@prisma/client';
const prisma = new PrismaClient();

export async function getRoomById(id: string) {
  return prisma.room.findUnique({ where: { id } });
}

export async function getRoomByConversationId(conversationId: bigint) {
  return prisma.room.findUnique({ where: { conversation_id: conversationId } });
}

export async function getRoomByRealtimeRoomId(realtimeRoomId: string) {
  return prisma.room.findUnique({ where: { realtime_room_id: realtimeRoomId } });
}

export async function upsertRoomForConversation(conversationId: bigint) {
  return prisma.room.upsert({
    where: { conversation_id: conversationId },
    update: {},
    create: { kind: RoomKind.CONVERSATION, conversation_id: conversationId }
  });
}

export async function upsertRoomForRealtime(realtimeRoomId: string) {
  return prisma.room.upsert({
    where: { realtime_room_id: realtimeRoomId },
    update: {},
    create: { kind: RoomKind.REALTIME, realtime_room_id: realtimeRoomId }
  });
}
"""
created.append(write("server/rooms/dao.ts", rooms_dao_ts))

# ------------------------------
# 4) Tenant DB factory
# ------------------------------
tenant_ts = r"""
// server/db/tenant.ts
import { PrismaClient } from '@prisma/client';
import LRU from 'lru-cache';
import { getRoomById } from '@/server/rooms/dao';

type Entry = { prisma: PrismaClient; url: string; lastUsed: number };
const cache = new LRU<string, Entry>({ max: 500, ttl: 5 * 60 * 1000 }); // 5 min TTL

let globalPrisma: PrismaClient | null = null;
export function getGlobalPrisma() {
  if (!globalPrisma) globalPrisma = new PrismaClient();
  return globalPrisma;
}

/**
 * Returns a prisma client for the given room.
 * Falls back to the global client if not sharded.
 */
export async function getPrismaForRoom(roomId: string) {
  const room = await getRoomById(roomId);
  if (!room?.isSharded || !room.shardUrl) return getGlobalPrisma();

  const key = `${roomId}:${room.shardUrl}`;
  const existing = cache.get(key);
  if (existing) { existing.lastUsed = Date.now(); return existing.prisma; }

  const client = new PrismaClient({ datasources: { db: { url: room.shardUrl } } });
  cache.set(key, { prisma: client, url: room.shardUrl, lastUsed: Date.now() });
  return client;
}
"""
created.append(write("server/db/tenant.ts", tenant_ts))

# ------------------------------
# 5) Provisioner: db schema + baseline
# ------------------------------
provision_db_ts = r"""
// server/provisioner/db.ts
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

export async function createSchema(globalPrisma: PrismaClient, roomId: string) {
  const schema = `room_${roomId.replace(/[^a-zA-Z0-9_]/g, '')}`;
  await globalPrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  return schema;
}

/**
 * Apply baseline SQL into the target schema.
 * The baseline file should NOT contain CREATE SCHEMA; it should assume search_path is set.
 */
export async function applyBaseline(globalPrisma: PrismaClient, schema: string) {
  const sqlPath = path.join(process.cwd(), 'sql', 'room_baseline.sql');
  if (!fs.existsSync(sqlPath)) {
    console.warn(`[provisioner] baseline not found at ${sqlPath}; skipping`);
    return;
  }
  const baseline = fs.readFileSync(sqlPath, 'utf8');
  await globalPrisma.$executeRawUnsafe(`SET search_path = "${schema}"`);
  await globalPrisma.$executeRawUnsafe(baseline);
}
"""
created.append(write("server/provisioner/db.ts", provision_db_ts))

# ------------------------------
# 6) Provisioner: S3
# ------------------------------
provision_s3_ts = r"""
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
"""
created.append(write("server/provisioner/s3.ts", provision_s3_ts))

# ------------------------------
# 7) Provisioner: KMS
# ------------------------------
provision_kms_ts = r"""
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
"""
created.append(write("server/provisioner/kms.ts", provision_kms_ts))

# ------------------------------
# 8) Provisioner Orchestrate
# ------------------------------
provision_orchestrate_ts = r"""
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
"""
created.append(write("server/provisioner/orchestrate.ts", provision_orchestrate_ts))

# ------------------------------
# 9) CDC emitter
# ------------------------------
cdc_emitter_ts = r"""
// server/cdc/emitter.ts
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL!);

export type CdcEvent =
  | { type: 'message.created'; roomId: string; id: string; ts: number }
  | { type: 'reaction.added'; roomId: string; id: string; ts: number };

export async function emitCdc(e: CdcEvent) {
  await redis.xadd('cdc:events', '*', 'type', e.type, 'roomId', e.roomId, 'id', e.id, 'ts', String(e.ts));
}
"""
created.append(write("server/cdc/emitter.ts", cdc_emitter_ts))

# ------------------------------
# 10) Jobs: queues & worker
# ------------------------------
queues_ts = r"""
// server/jobs/queues.ts
import { Queue } from 'bullmq';
export const decentraliseQueue = new Queue('decentralise', { connection: { url: process.env.REDIS_URL! } });
"""
created.append(write("server/jobs/queues.ts", queues_ts))

worker_ts = r"""
// server/jobs/decentralise.worker.ts
import { Worker, QueueEvents, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { provisionShard } from '@/server/provisioner/orchestrate';
import { copyRoomDb, copyRoomMedia } from '@/server/jobs/copy';

export type DecentraliseJobData = {
  roomId: string;
  kind: 'CONVERSATION' | 'REALTIME';
  conversationId?: string; // bigint as string
  realtimeRoomId?: string;
  region: string;
  sourceBucket: string;
};

const prisma = new PrismaClient();
export const decentraliseEvents = new QueueEvents('decentralise', { connection: { url: process.env.REDIS_URL! } });

export const decentraliseWorker = new Worker<DecentraliseJobData>('decentralise', async (job: Job<DecentraliseJobData>) => {
  const { roomId, kind, conversationId, realtimeRoomId, region, sourceBucket } = job.data;
  const baseDbUrl = process.env.DATABASE_URL!;
  const serviceRoleArn = process.env.SERVICE_KMS_ROLE_ARN!;

  const prov = await provisionShard(prisma, roomId, region, baseDbUrl, serviceRoleArn);

  await copyRoomDb({
    prisma,
    targetSchema: prov.schema,
    roomId,
    region,
    sourceBucket,
    targetBucket: prov.bucket,
    kmsKeyArn: prov.kmsKeyArn,
    conversationId: kind === 'CONVERSATION' && conversationId ? BigInt(conversationId) : undefined,
    realtimeRoomId: kind === 'REALTIME' ? realtimeRoomId : undefined
  });

  await copyRoomMedia({
    prisma,
    targetSchema: prov.schema,
    roomId,
    region,
    sourceBucket,
    targetBucket: prov.bucket,
    kmsKeyArn: prov.kmsKeyArn,
    conversationId: kind === 'CONVERSATION' && conversationId ? BigInt(conversationId) : undefined,
    realtimeRoomId: kind === 'REALTIME' ? realtimeRoomId : undefined
  });

  return { ok: true, ...prov };
}, { connection: { url: process.env.REDIS_URL! } });
"""
created.append(write("server/jobs/decentralise.worker.ts", worker_ts))

# ------------------------------
# 11) API routes: decentralise + status
# ------------------------------
decentralise_route = r"""
// app/api/rooms/[id]/decentralise/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { decentraliseQueue } from '@/server/jobs/queues';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // TODO: authz check: ensure requester is room admin
  const body = await req.json();
  const { region = process.env.AWS_REGION || 'us-east-1', kind, conversationId, realtimeRoomId, sourceBucket = process.env.GLOBAL_MEDIA_BUCKET } = body;
  if (!kind || (kind !== 'CONVERSATION' && kind !== 'REALTIME')) {
    return NextResponse.json({ error: 'kind must be CONVERSATION or REALTIME' }, { status: 400 });
  }

  // Ensure room exists
  const prisma = new PrismaClient();
  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const job = await decentraliseQueue.add('copy', {
    roomId: params.id,
    kind,
    conversationId,
    realtimeRoomId,
    region,
    sourceBucket
  }, { attempts: 5, backoff: { type: 'exponential', delay: 5000 } });

  return NextResponse.json({ jobId: job.id });
}
"""
created.append(write("app/api/rooms/[id]/decentralise/route.ts", decentralise_route))

status_route = r"""
// app/api/rooms/[id]/decentralise/status/route.ts
import { NextRequest } from 'next/server';
import { decentraliseEvents } from '@/server/jobs/decentralise.worker';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (data: any) => controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      const onProg = (e: any) => send({ type: 'progress', ...e });
      const onComp = (e: any) => { send({ type: 'complete', ...e }); controller.close(); };
      const onFail = (e: any) => { send({ type: 'failed', ...e }); controller.close(); };
      decentraliseEvents.on('progress', onProg);
      decentraliseEvents.on('completed', onComp);
      decentraliseEvents.on('failed', onFail);
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
"""
created.append(write("app/api/rooms/[id]/decentralise/status/route.ts", status_route))

# ------------------------------
# 12) Trust: receipt signer + route
# ------------------------------
receipt_ts = r"""
// server/trust/receipt.ts
import nacl from 'tweetnacl';

export function createReceipt(payload: Record<string, any>) {
  const secret = Buffer.from(process.env.MESH_EXPORT_SECRET_KEY!, 'base64');
  const msg = Buffer.from(JSON.stringify(payload));
  const sig = nacl.sign.detached(msg, secret);
  return { payload, signature: Buffer.from(sig).toString('base64'), alg: 'Ed25519', keyId: 'mesh-export-key-1' };
}

export function verifyReceipt(receipt: { payload: any; signature: string }) {
  const pub = Buffer.from(process.env.MESH_EXPORT_PUBLIC_KEY!, 'base64');
  const ok = nacl.sign.detached.verify(Buffer.from(JSON.stringify(receipt.payload)), Buffer.from(receipt.signature, 'base64'), pub);
  return ok;
}
"""
created.append(write("server/trust/receipt.ts", receipt_ts))

receipt_route_ts = r"""
// app/api/rooms/[id]/receipt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { createReceipt } from '@/server/trust/receipt';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = new PrismaClient();
  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

  const payload = {
    roomId: room.id,
    timestamp: new Date().toISOString(),
    shardUrl: room.shardUrl,
    mediaBucket: room.mediaBucket,
    kmsKeyArn: room.kmsKeyArn,
    kmsAlias: room.kmsKeyArn ? `alias/mesh/room/${room.id}` : undefined,
    manifestHash: null
  };
  const receipt = createReceipt(payload);
  return NextResponse.json(receipt);
}
"""
created.append(write("app/api/rooms/[id]/receipt/route.ts", receipt_route_ts))

# ------------------------------
# 13) Export route (tar.zst stream scaffold)
# ------------------------------
export_route_ts = r"""
// app/api/rooms/[id]/export/route.ts
import { NextRequest } from 'next/server';
import { pack } from 'tar-stream';
import { spawn } from 'node:child_process';

export const dynamic = 'force-dynamic';

/**
 * Streams a tar.zst containing:
 * - db.sql (schema-scoped dump)
 * - media/ (copied from room bucket — TODO: wire from S3)
 * - manifest.json (hashes, counts) + export.signature (detached Ed25519)
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const roomId = params.id;
  const tar = pack();

  // 1) db.sql via pg_dump (ensure pg_dump available in runtime)
  const schemaName = `room_${roomId}`;
  const pgDump = spawn('pg_dump', ['--no-owner', '--schema', schemaName, process.env.PGDATABASE || 'postgres'], { env: process.env });

  // Note: tar-stream supports streams; we pipe stdout into the 'db.sql' entry.
  const dbEntry = tar.entry({ name: 'db.sql' });
  pgDump.stdout.on('data', chunk => dbEntry.write(chunk));
  pgDump.stdout.on('end', () => dbEntry.end());

  // 2) TODO: Add media/** entries by streaming S3 objects from the room bucket.
  // Placeholder: empty folder entry
  tar.entry({ name: 'media/' }, Buffer.from([]));

  // 3) TODO: manifest.json + export.signature
  tar.entry({ name: 'manifest.json' }, Buffer.from(JSON.stringify({ roomId, version: 1, createdAt: new Date().toISOString() }, null, 2)));

  // Finalize and compress with zstd
  const zstd = spawn('zstd', ['-q', '--stdout']);
  const body = new ReadableStream({
    start(controller) {
      tar.pipe(zstd.stdin);
      zstd.stdout.on('data', (chunk) => controller.enqueue(chunk));
      zstd.on('close', () => controller.close());
      tar.finalize();
    }
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'application/zstd',
      'Content-Disposition': `attachment; filename="room_${roomId}.tar.zst"`
    }
  });
}
"""
created.append(write("app/api/rooms/[id]/export/route.ts", export_route_ts))

# ------------------------------
# 14) Import route (tar.zst upload scaffold)
# ------------------------------
import_route_ts = r"""
// app/api/rooms/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
// import { provisionShard } from '@/server/provisioner/orchestrate';
// import { restore } from '@/server/import/restore';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const blob = await req.blob();
  // TODO: stream-decompress zstd, untar, psql restore, media upload, receipt emit.
  // For now, just acknowledge upload size.
  return NextResponse.json({ ok: true, bytes: blob.size });
}
"""
created.append(write("app/api/rooms/import/route.ts", import_route_ts))

# ------------------------------
# 15) UI — Sovereignty Panel + Cost Estimate
# ------------------------------
panel_tsx = r"""
// app/(dashboard)/rooms/[id]/settings/SovereigntyPanel.tsx
'use client';
import { useState, useEffect } from 'react';

export function SovereigntyPanel({ roomId }: { roomId: string }) {
  const [tier, setTier] = useState<'pooled'|'sovereign'|'portable'|'byoc'>('pooled');
  const [region, setRegion] = useState('us-east-1');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function decentralise(kind: 'CONVERSATION'|'REALTIME') {
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/rooms/${roomId}/decentralise`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ region, kind })
    });
    setBusy(false);
    if (!r.ok) { setMsg('Failed to start decentralise'); return; }
    const json = await r.json();
    setMsg(`Started job ${json.jobId}`);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Sovereignty</h3>
      <div className="flex gap-2">
        <button className={`px-2 py-1 rounded ${tier==='pooled'?'bg-gray-200':''}`} onClick={()=>setTier('pooled')}>Pooled</button>
        <button className={`px-2 py-1 rounded ${tier==='sovereign'?'bg-gray-200':''}`} onClick={()=>setTier('sovereign')}>Sovereign</button>
        <button className={`px-2 py-1 rounded ${tier==='portable'?'bg-gray-200':''}`} onClick={()=>setTier('portable')}>Portable</button>
        <button className={`px-2 py-1 rounded opacity-60`} disabled>BYOC (soon)</button>
      </div>
      <div>
        <label className="mr-2">Region</label>
        <select value={region} onChange={e=>setRegion(e.target.value)} className="border rounded px-2 py-1">
          <option>us-east-1</option>
          <option>us-west-2</option>
          <option>eu-central-1</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button disabled={busy} className="px-3 py-2 bg-black text-white rounded" onClick={()=>decentralise('CONVERSATION')}>Decentralise (Conversation)</button>
        <button disabled={busy} className="px-3 py-2 bg-black text-white rounded" onClick={()=>decentralise('REALTIME')}>Decentralise (Realtime)</button>
      </div>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
    </div>
  );
}
"""
created.append(write("app/(dashboard)/rooms/[id]/settings/SovereigntyPanel.tsx", panel_tsx))

cost_estimate_tsx = r"""
// app/(dashboard)/components/CostEstimate.tsx
'use client';

export function CostEstimate({ dbGB = 5, s3GB = 5, shards = 1 }: { dbGB?: number; s3GB?: number; shards?: number }) {
  // very rough: db $0.115/GB, s3 $0.023/GB, shard keys $1/mo
  const monthly = dbGB*0.115 + s3GB*0.023 + shards*1.0;
  return <div className="text-sm text-gray-600">Est. monthly: ${monthly.toFixed(2)} (rough)</div>;
}
"""
created.append(write("app/(dashboard)/components/CostEstimate.tsx", cost_estimate_tsx))

# ------------------------------
# 16) KMS revoke/rotate API
# ------------------------------
kms_revoke_ts = r"""
// app/api/rooms/[id]/kms/revoke/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { revokeMeshGrant } from '@/server/provisioner/kms';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = new PrismaClient();
  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room?.kmsKeyArn) return NextResponse.json({ error: 'Room/KMS not found' }, { status: 404 });
  await revokeMeshGrant(process.env.AWS_REGION!, room.kmsKeyArn, process.env.SERVICE_KMS_ROLE_ARN!);
  return NextResponse.json({ ok: true });
}
"""
created.append(write("app/api/rooms/[id]/kms/revoke/route.ts", kms_revoke_ts))

kms_rotate_ts = r"""
// app/api/rooms/[id]/kms/rotate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { rotateKey } from '@/server/provisioner/kms';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = new PrismaClient();
  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room?.kmsKeyArn) return NextResponse.json({ error: 'Room/KMS not found' }, { status: 404 });
  const aliasName = `alias/mesh/room/${room.id}`;
  const newArn = await rotateKey(process.env.AWS_REGION!, aliasName);
  await prisma.room.update({ where: { id: params.id }, data: { kmsKeyArn: newArn } });
  return NextResponse.json({ ok: true, kmsKeyArn: newArn });
}
"""
created.append(write("app/api/rooms/[id]/kms/rotate/route.ts", kms_rotate_ts))

# ------------------------------
# 17) Usage metering (stub) and API
# ------------------------------
usage_job_ts = r"""
// server/jobs/usageMeter.ts
import { PrismaClient } from '@prisma/client';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

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
    const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const o of out.Contents ?? []) s3Bytes += o.Size ?? 0;
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);

  return { dbBytes: Number(bytes ?? 0), s3Bytes };
}
"""
created.append(write("server/jobs/usageMeter.ts", usage_job_ts))

usage_route_ts = r"""
// app/api/rooms/[id]/usage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { measureRoom } from '@/server/jobs/usageMeter';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const prisma = new PrismaClient();
  const room = await prisma.room.findUnique({ where: { id: params.id } });
  if (!room?.mediaBucket) return NextResponse.json({ error: 'Room not found or not sharded' }, { status: 404 });
  const usage = await measureRoom(prisma, room.id, room.mediaBucket, process.env.AWS_REGION || 'us-east-1');
  return NextResponse.json({ roomId: room.id, ...usage });
}
"""
created.append(write("app/api/rooms/[id]/usage/route.ts", usage_route_ts))

# ------------------------------
# 18) Billing stub
# ------------------------------
billing_ts = r"""
// server/billing/stripe.ts
export async function reportUsage(roomId: string, dbBytes: number, s3Bytes: number) {
  // TODO: send to Stripe metered billing (usage records)
  return { ok: true, roomId, dbBytes, s3Bytes };
}
"""
created.append(write("server/billing/stripe.ts", billing_ts))

# ------------------------------
# 19) Metrics stub
# ------------------------------
metrics_pool_ts = r"""
// server/metrics/pool.ts
import { getGlobalPrisma } from '@/server/db/tenant';

export async function getGlobalConnectionCount() {
  const prisma = getGlobalPrisma();
  const [{ count }] = await prisma.$queryRawUnsafe<{ count: number }[]>(`
    SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()
  `);
  return count;
}
"""
created.append(write("server/metrics/pool.ts", metrics_pool_ts))

# ------------------------------
# 20) Baseline SQL placeholder + generator
# ------------------------------
baseline_sql = r"""
-- sql/room_baseline.sql
-- Placeholder: generate a baseline from your current schema.
-- Recommended: use scripts/generate-room-baseline.ts to pull a schema-only dump
-- filtered to room-scoped tables, with search_path set before execution.
-- Example content (CREATE TABLE ... in-room) should go here.
"""
created.append(write("sql/room_baseline.sql", baseline_sql))

generator_ts = r"""
// scripts/generate-room-baseline.ts
/**
 * Dev helper to generate sql/room_baseline.sql from your current DB.
 * Requires `pg_dump` in PATH and appropriate env (PG* vars).
 *
 * Example:
 *   PGHOST=... PGUSER=... PGPASSWORD=... PGDATABASE=... ts-node scripts/generate-room-baseline.ts
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = spawnSync('pg_dump', ['--schema-only', '--no-owner', process.env.PGDATABASE ?? 'postgres'], { env: process.env });
if (out.status !== 0) {
  console.error(out.stderr.toString());
  process.exit(out.status ?? 1);
}
const sql = out.stdout.toString();
// Optional: filter down to room-scoped tables if you prefix or tag them.
fs.writeFileSync(path.join(process.cwd(), 'sql', 'room_baseline.sql'), sql, 'utf8');
console.log('Wrote sql/room_baseline.sql');
"""
created.append(write("scripts/generate-room-baseline.ts", generator_ts))

# ------------------------------
# 21) Mesh-Lite skeleton
# ------------------------------
docker_compose = r"""
# mesh-lite/docker-compose.yml
version: '3.9'
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: meshlite
      POSTGRES_DB: meshlite
    ports: ["5433:5432"]
  minio:
    image: minio/minio
    command: server /data
    environment:
      MINIO_ROOT_USER: miniouser
      MINIO_ROOT_PASSWORD: miniopass
    ports: ["9000:9000", "9001:9001"]
  api:
    build: ./api
    environment:
      DATABASE_URL: postgresql://postgres:meshlite@db:5432/meshlite
      MINIO_ENDPOINT: http://minio:9000
    ports: ["8787:8787"]
"""
created.append(write("mesh-lite/docker-compose.yml", docker_compose))

mesh_import_sh = r"""
#!/usr/bin/env bash
# mesh-lite/import.sh
set -euo pipefail
TARBALL="$1"
mkdir -p /tmp/room && cd /tmp/room
zstd -d -c "$TARBALL" | tar -x
psql "$DATABASE_URL" < db.sql
# TODO: upload media/* to MinIO bucket
echo "Imported db.sql"
"""
created.append(write("mesh-lite/import.sh", mesh_import_sh))

mesh_api_server = r"""
// mesh-lite/api/server.ts
import http from 'node:http';

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: true, service: 'mesh-lite' }));
});

server.listen(8787, () => console.log('mesh-lite api on :8787'));
"""
created.append(write("mesh-lite/api/server.ts", mesh_api_server))

# ------------------------------
# 22) Passport + Verifier (web + CLI)
# ------------------------------
passport_page = r"""
// app/passport/page.tsx
export default function PassportPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Passport</h1>
      <p>Download exports and verify signatures & hashes.</p>
      <ul className="list-disc list-inside">
        <li><a href="/passport/verifier">Web verifier</a></li>
        <li><a href="https://github.com/yourorg/mesh-lite">Mesh‑Lite</a></li>
      </ul>
    </div>
  );
}
"""
created.append(write("app/passport/page.tsx", passport_page))

passport_verifier = r"""
// app/passport/verifier/page.tsx
'use client';
import { useState } from 'react';

export default function VerifierPage() {
  const [payload, setPayload] = useState('');
  const [signature, setSignature] = useState('');
  const [result, setResult] = useState<string | null>(null);

  async function verify() {
    const r = await fetch('/api/dev/verify', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ payload: JSON.parse(payload), signature }) });
    const json = await r.json();
    setResult(json.valid ? 'VALID' : 'INVALID');
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Verifier</h1>
      <textarea className="w-full border p-2" rows={8} placeholder="manifest.json" value={payload} onChange={e=>setPayload(e.target.value)} />
      <input className="w-full border p-2" placeholder="export.signature (base64)" value={signature} onChange={e=>setSignature(e.target.value)} />
      <button className="px-3 py-2 bg-black text-white rounded" onClick={verify}>Verify</button>
      {result && <p className="text-sm">{result}</p>}
    </div>
  );
}
"""
created.append(write("app/passport/verifier/page.tsx", passport_verifier))

verify_api = r"""
// app/api/dev/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import nacl from 'tweetnacl';

export async function POST(req: NextRequest) {
  const { payload, signature } = await req.json();
  const pub = Buffer.from(process.env.MESH_EXPORT_PUBLIC_KEY!, 'base64');
  const ok = nacl.sign.detached.verify(Buffer.from(JSON.stringify(payload)), Buffer.from(signature, 'base64'), pub);
  return NextResponse.json({ valid: ok });
}
"""
created.append(write("app/api/dev/verify/route.ts", verify_api))

verifier_cli = r"""
// tools/verifier-cli/index.ts
#!/usr/bin/env node
import fs from 'node:fs';
import nacl from 'tweetnacl';

const [,, manifestPath, sigPath] = process.argv;
if (!manifestPath || !sigPath) {
  console.error('Usage: verifier <manifest.json> <export.signature>');
  process.exit(2);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const sig = Buffer.from(fs.readFileSync(sigPath, 'utf8'), 'base64');
const pub = Buffer.from(process.env.MESH_EXPORT_PUBLIC_KEY!, 'base64');
const ok = nacl.sign.detached.verify(Buffer.from(JSON.stringify(manifest)), sig, pub);
console.log(ok ? 'VALID' : 'INVALID');
process.exit(ok ? 0 : 1);
"""
created.append(write("tools/verifier-cli/index.ts", verifier_cli))

# ------------------------------
# 23) Fix and re-write previously created /server/jobs/copy/media.ts to avoid bad spread
# ------------------------------
fixed_media_ts = r"""
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
"""
created.append(write("server/jobs/copy/media.ts", fixed_media_ts))

# List everything we created
created
