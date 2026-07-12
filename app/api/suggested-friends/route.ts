export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getUserFromCookies } from "@/lib/serverutils";
import { fetchFriendSuggestions } from "@/lib/actions/friend-suggestions.actions";

export async function GET() {
  const user = await getUserFromCookies();
  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const suggestions = await fetchFriendSuggestions(user.userId);
  return NextResponse.json(suggestions);
}
