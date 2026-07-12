/**
 * Phase 3.6 \u2014 OG image for the public argument search page.
 *
 * Renders a 1200\u00d7630 social card showing the user's query and (when
 * available) the result count for it. When q is empty we render a
 * generic "Search public arguments" card so the URL still has a usable
 * preview when shared bare.
 *
 * Lives at /api/og/search/arguments and is referenced from the search
 * page's OpenGraph metadata via the `images` field.
 */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
// One-hour cache. Long enough to avoid hammering the API on every share
// expansion, short enough that result-count freshness stays believable.
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "\u2026";
}

async function fetchCount(q: string): Promise<number | null> {
  try {
    const u = new URL(`${BASE_URL}/api/v3/search/arguments`);
    u.searchParams.set("q", q);
    u.searchParams.set("limit", "1");
    const res = await fetch(u.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { count?: number };
    return typeof body.count === "number" ? body.count : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const sort = (sp.get("sort") ?? "").trim();
  const mode = (sp.get("mode") ?? "").trim();

  const queryDisplay = q ? truncate(q, 90) : "Search public arguments";
  const count = q ? await fetchCount(q) : null;

  const subtitle = q
    ? count != null
      ? `${count} result${count === 1 ? "" : "s"}`
      : "Public arguments matching your query"
    : "Every result is a permalink with scheme, evidence, and standing.";

  const sortLabel =
    sort === "dialectical_fitness" ? "ranked by dialectical fitness" : null;
  const modeLabel = mode === "lexical" || mode === "vector" ? `${mode} retrieval` : null;
  const facets = [sortLabel, modeLabel].filter(Boolean) as string[];

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
          <span style={{ color: "#475569" }}>\u00b7</span>
          <span style={{ color: "#cbd5e1" }}>Argument Search</span>
        </div>

        {/* Query */}
        <div
          style={{
            marginTop: "48px",
            fontSize: q ? "56px" : "64px",
            lineHeight: 1.1,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#fff",
            display: "flex",
          }}
        >
          {q ? `\u201c${queryDisplay}\u201d` : queryDisplay}
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: "24px",
            fontSize: "26px",
            color: "#cbd5e1",
            display: "flex",
          }}
        >
          {subtitle}
        </div>

        {/* Facet chips */}
        {facets.length > 0 ? (
          <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
            {facets.map((f) => (
              <div
                key={f}
                style={{
                  padding: "6px 14px",
                  background: "rgba(99,102,241,0.18)",
                  border: "1px solid rgba(99,102,241,0.45)",
                  borderRadius: "999px",
                  color: "#c7d2fe",
                  fontSize: "16px",
                  display: "flex",
                }}
              >
                {f}
              </div>
            ))}
          </div>
        ) : null}

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
            Permalinks \u00b7 schemes \u00b7 evidence with provenance \u00b7 dialectical standing
          </div>
          <div style={{ display: "flex", color: "#a5b4fc", fontWeight: 700 }}>
            {BASE_URL.replace("https://", "")}/search/arguments
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
