export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { updateUserSettings } from "@/lib/settings/service";

export async function PATCH(req: NextRequest) {
  const user = await getUserFromCookies();
  if (!user || user.userId == null) return NextResponse.json({}, { status: 401 });
  const payload = await req.json();
  await updateUserSettings(user.userId, payload);
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  return PATCH(req);
}
