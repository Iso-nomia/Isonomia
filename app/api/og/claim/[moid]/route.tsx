import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ moid: string }> }
) {
  const { moid } = await params;

  const claim = await prisma.claim.findUnique({
    where: { moid },
    select: {
      text: true,
      moid: true,
      ClaimEvidence: { select: { title: true, uri: true }, take: 4 },
      _count: {
        select: {
          attacksReceived: true,
          defensesFor: true,
          arguments: true,
        },
      },
    },
  });

  if (!claim) {
    return buildFallbackImage();
  }

  const truncatedText =
    claim.text.length > 260
      ? claim.text.slice(0, 260) + "…"
      : claim.text;

  const evidenceCount = claim.ClaimEvidence.length;
  const supportCount = claim._count.defensesFor;
  const challengeCount = claim._count.attacksReceived;
  const argumentCount = claim._count.arguments;

  const firstEvidenceTitle =
    claim.ClaimEvidence[0]?.title || null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #0a0a1a 0%, #12122b 55%, #0f1a2e 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Top accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #818cf8 0%, #6366f1 50%, #4f46e5 100%)",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.4)",
              color: "#a5b4fc",
              fontSize: "11px",
              fontWeight: 700,
              padding: "5px 14px",
              borderRadius: "20px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            CLAIM
          </div>

          <div
            style={{
              marginLeft: "12px",
              color: "#334155",
              fontSize: "12px",
              fontFamily: "monospace",
              display: "flex",
            }}
          >
            {moid}
          </div>

          <div style={{ flex: 1 }} />

          <div
            style={{
              color: "#6366f1",
              fontSize: "20px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              display: "flex",
            }}
          >
            Isonomia
          </div>
        </div>

        {/* Claim text */}
        <div
          style={{
            color: "#f1f5f9",
            fontSize: "28px",
            fontWeight: 600,
            lineHeight: 1.45,
            flex: 1,
            display: "flex",
          }}
        >
          {truncatedText}
        </div>

        {/* Evidence preview */}
        {firstEvidenceTitle ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "20px",
              padding: "12px 16px",
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.15)",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                color: "#64748b",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginRight: "12px",
                display: "flex",
              }}
            >
              SOURCE
            </div>
            <div
              style={{
                color: "#94a3b8",
                fontSize: "14px",
                display: "flex",
              }}
            >
              {firstEvidenceTitle.length > 80
                ? firstEvidenceTitle.slice(0, 80) + "…"
                : firstEvidenceTitle}
            </div>
          </div>
        ) : null}

        {/* Bottom stats row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            paddingTop: "20px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {evidenceCount > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginRight: "24px",
                color: "#475569",
                fontSize: "13px",
              }}
            >
              {evidenceCount} source{evidenceCount !== 1 ? "s" : ""}
            </div>
          ) : null}

          {argumentCount > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginRight: "24px",
                color: "#475569",
                fontSize: "13px",
              }}
            >
              {argumentCount} argument{argumentCount !== 1 ? "s" : ""}
            </div>
          ) : null}

          {supportCount > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginRight: "16px",
                color: "#4ade80",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {supportCount} support{supportCount !== 1 ? "s" : ""}
            </div>
          ) : null}

          {challengeCount > 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#f87171",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {challengeCount} challenge{challengeCount !== 1 ? "s" : ""}
            </div>
          ) : null}

          <div style={{ flex: 1 }} />

          <div
            style={{
              color: "#334155",
              fontSize: "13px",
              display: "flex",
            }}
          >
            {BASE_URL.replace("https://", "")}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

function buildFallbackImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0a0a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            color: "#6366f1",
            fontSize: "32px",
            fontWeight: 800,
            display: "flex",
          }}
        >
          Isonomia
        </div>
        <div
          style={{
            color: "#475569",
            fontSize: "18px",
            marginTop: "12px",
            display: "flex",
          }}
        >
          Digital Agora
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
