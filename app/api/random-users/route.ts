export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { fetchRandomUsers } from "@/lib/actions/user.actions";

export async function GET(req: NextRequest) {
  const countParam = req.nextUrl.searchParams.get("count");
  const count = countParam ? parseInt(countParam, 10) : 7;
  const users = await fetchRandomUsers(count);
  return NextResponse.json(users);
}
