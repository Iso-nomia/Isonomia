export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/serverutils";
import { getCommitmentStores } from "@/lib/aif/graph-builder";
import { prisma } from "@/lib/prismaclient";
import { resolveDeliberationName } from "@/lib/deliberations/resolveName";

/**
 * GET /api/aif/dialogue/[deliberationId]/commitments/export
 * 
 * Export commitment stores in various formats.
 * 
 * Query params:
 * - format: "json" | "csv" | "markdown" (default: json)
 * - participantId (optional): Filter to specific participant
 * - asOf (optional): Export state as of a specific timestamp
 * - includeInactive (optional): Include retracted commitments (default: false)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { deliberationId: string } }
) {
  const startTime = Date.now();
  
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { deliberationId } = params;
    const searchParams = req.nextUrl.searchParams;
    const format = searchParams.get("format") || "json";
    const participantId = searchParams.get("participantId") || undefined;
    const asOf = searchParams.get("asOf") || undefined;
    const includeInactive = searchParams.get("includeInactive") === "true";

    if (!["json", "csv", "markdown"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Must be json, csv, or markdown" },
        { status: 400 }
      );
    }

    // Verify user has access to this deliberation
    const deliberation = await prisma.deliberation.findUnique({
      where: { id: deliberationId },
      select: { id: true, roomId: true, title: true }
    });

    if (!deliberation) {
      return NextResponse.json(
        { error: "Deliberation not found" },
        { status: 404 }
      );
    }

    if (deliberation.roomId) {
      // TODO: Add room access check when RoomMember model is available.
      // The schema currently has no RoomMember model/table, so access is gated
      // only by authentication above (matching the commitments route).
    }

    // Get commitment stores (all commitments for export)
    const result = await getCommitmentStores(
      deliberationId,
      participantId,
      asOf,
      10000, // Large limit for export
      0
    );

    const stores = result.data;
    const duration = Date.now() - startTime;

    // Filter inactive commitments if requested
    const filteredStores = stores.map((store: any) => ({
      ...store,
      commitments: includeInactive
        ? store.commitments
        : store.commitments.filter((c: any) => c.isActive),
    }));

    // Generate export based on format
    if (format === "json") {
      const exportData = {
        deliberationId,
        deliberationTitle: resolveDeliberationName(deliberation, { fallback: "Untitled" }),
        exportedAt: new Date().toISOString(),
        asOf: asOf || "latest",
        includeInactive,
        stores: filteredStores,
        metadata: {
          totalParticipants: filteredStores.length,
          totalCommitments: filteredStores.reduce(
            (sum: number, s: any) => sum + s.commitments.length,
            0
          ),
          exportDuration: `${duration}ms`,
        },
      };

      return NextResponse.json(exportData, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="commitments-${deliberationId}-${Date.now()}.json"`,
          "X-Response-Time": `${duration}ms`,
        },
      });
    }

    if (format === "csv") {
      // CSV format: participantId, participantName, claimId, claimText, moveId, moveKind, timestamp, isActive
      let csv = "Participant ID,Participant Name,Claim ID,Claim Text,Move ID,Move Kind,Timestamp,Is Active\n";
      
      for (const store of filteredStores) {
        for (const commitment of store.commitments || []) {
          const row = [
            store.participantId,
            `"${store.participantName.replace(/"/g, '""')}"`,
            commitment.claimId,
            `"${commitment.claimText.replace(/"/g, '""')}"`,
            commitment.moveId,
            commitment.moveKind,
            commitment.timestamp,
            commitment.isActive ? "true" : "false",
          ];
          csv += row.join(",") + "\n";
        }
      }

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="commitments-${deliberationId}-${Date.now()}.csv"`,
          "X-Response-Time": `${duration}ms`,
        },
      });
    }

    if (format === "markdown") {
      let md = `# Commitment Stores Export\n\n`;
      md += `**Deliberation:** ${deliberation.title || deliberationId}\n`;
      md += `**Exported At:** ${new Date().toISOString()}\n`;
      md += `**State:** ${asOf ? `As of ${asOf}` : "Latest"}\n`;
      md += `**Participants:** ${filteredStores.length}\n\n`;
      md += `---\n\n`;

      for (const store of filteredStores) {
        md += `## ${store.participantName} (${store.participantId})\n\n`;
        
        const activeCommitments = store.commitments.filter((c: any) => c.isActive);
        const inactiveCommitments = store.commitments.filter((c: any) => !c.isActive);

        if (activeCommitments.length > 0) {
          md += `### Active Commitments (${activeCommitments.length})\n\n`;
          for (const commitment of activeCommitments) {
            md += `- **${commitment.claimText}**\n`;
            md += `  - *Claim ID:* \`${commitment.claimId}\`\n`;
            md += `  - *Move:* ${commitment.moveKind} (\`${commitment.moveId}\`)\n`;
            md += `  - *Timestamp:* ${commitment.timestamp}\n\n`;
          }
        }

        if (includeInactive && inactiveCommitments.length > 0) {
          md += `### Retracted Commitments (${inactiveCommitments.length})\n\n`;
          for (const commitment of inactiveCommitments) {
            md += `- ~~${commitment.claimText}~~\n`;
            md += `  - *Claim ID:* \`${commitment.claimId}\`\n`;
            md += `  - *Move:* ${commitment.moveKind} (\`${commitment.moveId}\`)\n`;
            md += `  - *Timestamp:* ${commitment.timestamp}\n\n`;
          }
        }

        md += `---\n\n`;
      }

      return new NextResponse(md, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="commitments-${deliberationId}-${Date.now()}.md"`,
          "X-Response-Time": `${duration}ms`,
        },
      });
    }

    // Should never reach here
    return NextResponse.json(
      { error: "Invalid format" },
      { status: 400 }
    );
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Error exporting commitments:", error);
    return NextResponse.json(
      { error: "Failed to export commitments" },
      { 
        status: 500,
        headers: {
          "X-Response-Time": `${duration}ms`
        }
      }
    );
  }
}
