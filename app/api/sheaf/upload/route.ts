import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismaclient';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ ok: false, error: 'No file' }, { status: 400 });

  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  // compute sha256
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

  // write under .uploads/sheaf (dev only)
  const dir = join(process.cwd(), '.uploads', 'sheaf');
  await mkdir(dir, { recursive: true });
  const outPath = join(dir, `${sha256}-${file.name}`);
  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(outPath);
    ws.on('error', reject);
    ws.on('finish', () => resolve());
    ws.end(buf);
  });

  // upsert SheafBlob
  const blob = await prisma.sheafBlob.upsert({
    where: { sha256 },
    update: { mime: file.type || 'application/octet-stream', size: buf.length, path: outPath },
    create: { sha256, mime: file.type || 'application/octet-stream', size: buf.length, path: outPath },
  });

  return NextResponse.json({
    ok: true,
    blob: {
      id: String(blob.id),
      sha256,
      mime: blob.mime,
      size: blob.size,
      path: blob.path,
      name: file.name,
    }
  });
}
