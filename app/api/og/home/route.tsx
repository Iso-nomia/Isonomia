/**
 * OG image for the public homepage (`/`).
 *
 * Renders a 1200×630 social card so that sharing the bare site URL on
 * X / LinkedIn / Slack produces a branded preview, matching the cards
 * already generated for argument permalinks and the search surface.
 *
 * Lives at /api/og/home and is referenced from the homepage's OpenGraph
 * metadata via the `images` field.
 */
import { ImageResponse } from "next/og";

export const runtime = "edge";
// Static card — nothing here depends on request data, so cache hard.
export const revalidate = 86_400;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background:
            "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 55%, #16213e 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "56px 64px",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          color: "#fff",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            color: "#a5b4fc",
            fontSize: "16px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <span>Isonomia</span>
          <span style={{ color: "#475569" }}>·</span>
          <span style={{ color: "#cbd5e1" }}>Open-source reasoning infrastructure</span>
        </div>

        {/* Title */}
        <div
          style={{
            marginTop: "56px",
            fontSize: "60px",
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#fff",
            display: "flex",
          }}
        >
          Store, cite, and check the reasoning behind a conclusion.
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: "28px",
            fontSize: "26px",
            lineHeight: 1.35,
            color: "#cbd5e1",
            display: "flex",
            maxWidth: "980px",
          }}
        >
          Isonomia turns an argument into structured, verifiable data instead of
          prose — with provenance, the strongest objection on file, and whether
          it has survived challenge.
        </div>

        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#64748b",
            fontSize: "16px",
          }}
        >
          <div style={{ display: "flex" }}>
            Permalinks · schemes · evidence with provenance · dialectical standing
          </div>
          <div style={{ display: "flex", color: "#a5b4fc", fontWeight: 700 }}>
            {BASE_URL.replace("https://", "")}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
