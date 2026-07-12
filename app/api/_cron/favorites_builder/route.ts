export const runtime = 'edge';

import { NextResponse } from "next/server";
import { run } from "@/jobs/favorites_builder";

export async function GET() {
  if (process.env.ENABLE_FAV_BUILDER !== "true") {
    return NextResponse.json({ skipped: true, reason: "builder disabled" });
  }
  await run();
  return NextResponse.json({ success: true });
}
