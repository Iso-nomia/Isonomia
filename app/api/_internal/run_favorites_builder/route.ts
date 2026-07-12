export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { run } from "@/jobs/favorites_builder";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.INTERNAL_JOB_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  void run({ userId: body.userId ?? undefined });
  return NextResponse.json({ accepted: true }, { status: 202 });
}
