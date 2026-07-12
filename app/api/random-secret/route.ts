export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { pickRandomSecret } from "@/lib/entropy/server";

export async function GET() {
  const word = pickRandomSecret();
  return NextResponse.json({ word });
}
