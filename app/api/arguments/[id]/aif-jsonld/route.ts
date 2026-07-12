//app/api/arguments/[id]/aif-jsonld/route.ts

import { NextRequest, NextResponse } from "next/server";
import { buildAifGraphJSONLD } from "@/lib/aif/jsonld";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const jsonld = await buildAifGraphJSONLD({ argumentIds: [params.id] });
  return NextResponse.json(jsonld, { headers: { "Cache-Control": "no-store" } });
}
