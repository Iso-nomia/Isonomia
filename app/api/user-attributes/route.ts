export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  fetchUserAttributes,
  upsertUserAttributes,
} from "@/lib/actions/userattributes.actions";
import { visibility } from "@prisma/client";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }
  const attrs = await fetchUserAttributes({ userId: BigInt(userId) });
  if (!attrs) {
    return NextResponse.json({ error: "User attributes not found" }, { status: 404 });
  }
  return NextResponse.json(attrs);
}

export async function POST(req: NextRequest) {
  const data = await req.json();
  const { userAttributes, path } = data;
  if (!userAttributes || !path) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }
  if (userAttributes.events_visibility) {
    userAttributes.events_visibility = userAttributes.events_visibility as visibility;
  }
  if (userAttributes.tv_visibility) {
    userAttributes.tv_visibility = userAttributes.tv_visibility as visibility;
  }
  if (userAttributes.podcasts_visibility) {
    userAttributes.podcasts_visibility = userAttributes.podcasts_visibility as visibility;
  }
  await upsertUserAttributes({ userAttributes, path });
  return NextResponse.json({ success: true });
}
