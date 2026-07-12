export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { clearNotifications } from "@/lib/actions/notification.actions";

export async function POST() {
  await clearNotifications();
  return NextResponse.json({ status: "ok" });
}
