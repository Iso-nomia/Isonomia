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
