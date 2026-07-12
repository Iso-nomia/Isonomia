/**
 * Dev-only whoami: returns the Firebase auth uid + numeric mesh user id for
 * the current request. Use this in the browser to discover the id you need
 * to pass to `scripts/grant-deliberation-role.ts`.
 *
 * NOT for production traffic — guarded by NODE_ENV.
 */
import { NextResponse } from "next/server";
import { getCurrentUserAuthId, getCurrentUserId } from "@/lib/serverutils";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled in production" }, { status: 404 });
  }
  const [authId, userIdBig] = await Promise.all([
    getCurrentUserAuthId().catch(() => null),
    getCurrentUserId().catch(() => null),
  ]);
  return NextResponse.json({
    authId,
    userId: userIdBig ? String(userIdBig) : null,
  });
}
