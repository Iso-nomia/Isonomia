export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { fetchIntegrations, saveIntegration } from "@/lib/actions/integration.actions";

export async function GET() {
  const integrations = await fetchIntegrations();
  return NextResponse.json(integrations);
}

export async function POST(req: NextRequest) {
  const { service, credential } = await req.json();
  if (!service || !credential) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }
  await saveIntegration({ service, credential });
  return NextResponse.json({ success: true });
}
