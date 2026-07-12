import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { resolvePermalink } from "@/lib/citations/permalinkService";
import { prisma } from "@/lib/prismaclient";

// Node.js runtime so Prisma can be used directly
export const dynamic = "force-dynamic";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await params;

  // Resolve shortCode/slug → argumentId, falling back to treating identifier as a raw argument UUID
  let argumentId: string = identifier;
  const resolved = await resolvePermalink(identifier);
  if (resolved) {
    argumentId = resolved.argumentId;
  }

  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      text: true,
      confidence: true,
      conclusion: {
        select: {
          text: true,
          ClaimEvidence: { select: { title: true }, take: 3 },
        },
      },
      premises: {
        select: { claim: { select: { text: true } } },
        take: 3,
      },
      argumentSchemes: {
        select: { isPrimary: true, scheme: { select: { name: true, title: true } } },
        orderBy: [{ isPrimary: "desc" }, { order: "asc" }],
        take: 1,
      },
      deliberation: { select: { title: true } },
    },
  });

  // Always return a valid image – never a 404 – to avoid broken embeds
  if (!argument) {
    return buildFallbackImage();
  }

  const truncatedText =
    argument.text.length > 240
      ? argument.text.slice(0, 240) + "…"
      : argument.text;

  const conclusionText = argument.conclusion?.text
    ? argument.conclusion.text.length > 130
      ? argument.conclusion.text.slice(0, 130) + "…"
      : argument.conclusion.text
    : null;

  const schemeInstance = argument.argumentSchemes[0];
  const schemeName =
    schemeInstance?.scheme.name ||
    schemeInstance?.scheme.title ||
    null;

  const confidence =
    argument.confidence !== null && argument.confidence !== undefined
      ? Math.round(argument.confidence * 100)
      : null;

  const deliberationTitle = argument.deliberation?.title || "Digital Agora";

  const evidenceCount = argument.conclusion?.ClaimEvidence.length ?? 0;
  const premiseCount = argument.premises.length;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 55%, #16213e 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Top accent line */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, #6366f1 0%, #818cf8 50%, #a78bfa 100%)",
          }}
        />

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
          <div
            style={{
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.4)",
              color: "#a5b4fc",
              fontSize: "12px",
              fontWeight: 700,
              padding: "5px 14px",
              borderRadius: "20px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            ARGUMENT
          </div>

          {schemeName ? (
            <div
              style={{
                marginLeft: "10px",
                background: "rgba(167,139,250,0.12)",
                border: "1px solid rgba(167,139,250,0.25)",
                color: "#c4b5fd",
                fontSize: "12px",
                fontWeight: 600,
                padding: "5px 14px",
                borderRadius: "20px",
                display: "flex",
              }}
            >
              {schemeName}
            </div>
          ) : null}

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

        {/* Conclusion section */}
        {conclusionText ? (
          <div style={{ display: "flex", flexDirection: "column", marginBottom: "20px" }}>
            <div
              style={{
                color: "#64748b",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: "8px",
                display: "flex",
              }}
            >
              CONCLUSION
            </div>
            <div
              style={{
                color: "#f1f5f9",
                fontSize: "20px",
                fontWeight: 600,
                lineHeight: 1.4,
                display: "flex",
              }}
            >
              {conclusionText}
            </div>
          </div>
        ) : null}

        {/* Argument text */}
        <div
          style={{
            color: conclusionText ? "#94a3b8" : "#e2e8f0",
            fontSize: conclusionText ? "16px" : "24px",
            lineHeight: 1.6,
            flex: 1,
            display: "flex",
            overflow: "hidden",
          }}
        >
          {truncatedText}
        </div>

        {/* Bottom meta row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "28px",
            paddingTop: "20px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {premiseCount > 0 ? (
            <div
              style={{
                color: "#475569",
                fontSize: "13px",
                marginRight: "20px",
                display: "flex",
              }}
            >
              {premiseCount} premise{premiseCount !== 1 ? "s" : ""}
            </div>
          ) : null}

          {evidenceCount > 0 ? (
            <div style={{ color: "#475569", fontSize: "13px", display: "flex" }}>
              {evidenceCount} source{evidenceCount !== 1 ? "s" : ""}
            </div>
          ) : null}

          <div style={{ flex: 1 }} />

          <div style={{ color: "#475569", fontSize: "13px", display: "flex" }}>
            {deliberationTitle}
          </div>

          {confidence !== null ? (
            <div
              style={{
                color: "#6366f1",
                fontSize: "13px",
                fontWeight: 700,
                marginLeft: "20px",
                display: "flex",
              }}
            >
              {confidence}% confidence
            </div>
          ) : null}

          <div
            style={{
              color: "#334155",
              fontSize: "13px",
              marginLeft: "20px",
              display: "flex",
            }}
          >
            {BASE_URL.replace("https://", "")}
          </div>
        </div>

        {/* Confidence bar */}
        {confidence !== null ? (
          <div
            style={{
              marginTop: "10px",
              height: "3px",
              background: "rgba(99,102,241,0.15)",
              borderRadius: "2px",
              display: "flex",
            }}
          >
            <div
              style={{
                height: "3px",
                width: `${confidence}%`,
                background: "linear-gradient(90deg, #6366f1, #818cf8)",
                borderRadius: "2px",
              }}
            />
          </div>
        ) : null}
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
          background: "#0f0f1a",
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
