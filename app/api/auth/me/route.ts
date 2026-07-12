export const dynamic = "force-dynamic";

// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/auth";

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ userId: null });
  }
  
  return NextResponse.json({ userId: user.id });
}
