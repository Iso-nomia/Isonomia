export const dynamic = "force-dynamic";

// app/api/argument-annotations/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  // TODO: persist to prisma.argumentAnnotation (make a new table)
  console.log('Saving highlights', body);

  return NextResponse.json({ ok: true });
}
