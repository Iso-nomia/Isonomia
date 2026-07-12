export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { NetIdentificationService } from "@/app/server/services/NetIdentificationService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { argumentId, deliberationId } = body;

    const service = new NetIdentificationService();

    if (argumentId) {
      // Detect net in single argument
      const netCandidate = await service.detectMultiScheme(argumentId);
      return NextResponse.json({ net: netCandidate });
    } else if (deliberationId) {
      // Detect all nets in deliberation
      const nets = await service.detectNetsInDeliberation(deliberationId);
      return NextResponse.json({ nets });
    } else {
      return NextResponse.json(
        { error: "Either argumentId or deliberationId required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Net detection error:", error);
    return NextResponse.json(
      { error: "Failed to detect nets" },
      { status: 500 }
    );
  }
}
