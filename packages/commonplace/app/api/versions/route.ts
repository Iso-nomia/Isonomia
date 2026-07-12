import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    versions: [],
    note: "Phase 2: list versions. Not implemented yet.",
  });
}
