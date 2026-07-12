import { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prismaclient";
import { getClaimPermalinkUrl } from "@/lib/citations/claimPermalinkService";

export const dynamic = "force-dynamic";

type Theme = "auto" | "light" | "dark";

type PageProps = {
  params: Promise<{ moid: string }>;
  searchParams: Promise<{ theme?: string; compact?: string }>;
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

function isValidTheme(t: string | undefined): t is Theme {
  return t === "auto" || t === "light" || t === "dark";
}

function getTheme(raw: string | undefined): Theme {
  return isValidTheme(raw) ? raw : "auto";
}

function getThemeClass(theme: Theme): string {
  if (theme === "dark") return "dark-theme";
  if (theme === "light") return "light-theme";
  return "";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { moid } = await params;
  const claim = await prisma.claim.findUnique({
    where: { moid },
    select: { text: true },
  });

  return {
    title: claim ? `Claim: ${claim.text.slice(0, 80)}` : "Claim — Isonomia",
    description: claim?.text.slice(0, 160),
  };
}

export default async function ClaimEmbedPage({ params, searchParams }: PageProps) {
  const { moid } = await params;
  const { theme: rawTheme, compact: rawCompact } = await searchParams;

  const theme = getTheme(rawTheme);
  const compact = rawCompact === "true";
  const themeClass = getThemeClass(theme);

  const claim = await prisma.claim.findUnique({
    where: { moid },
    select: {
      id: true,
      text: true,
      moid: true,
      ClaimEvidence: {
        select: { id: true, title: true, uri: true },
        take: 5,
      },
      _count: {
        select: {
          attacksReceived: true,
          defensesFor: true,
          arguments: true,
        },
      },
    },
  });

  const publicUrl = getClaimPermalinkUrl(moid);

  if (!claim) {
    return (
      <html lang="en">
        <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#111827", color: "#9ca3af" }}>
          <div style={{ padding: "24px", textAlign: "center" }}>
            <p>This claim is not available.</p>
            <a href={BASE_URL} style={{ color: "#6366f1", fontSize: "13px" }}>
              Isonomia
            </a>
          </div>
        </body>
      </html>
    );
  }

  const supportCount = claim._count.defensesFor;
  const challengeCount = claim._count.attacksReceived;
  const argumentCount = claim._count.arguments;

  return (
    <html lang="en" className={themeClass}>
      <body>
        <div className={`embed-container${compact ? " compact" : ""}`}>
          <style>{embedStyles(theme)}</style>

          {/* Header */}
          <div className="embed-header">
            <div className="header-badges">
              <span className="badge badge-claim">Claim</span>
              <span className="badge badge-moid">{moid}</span>
            </div>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="view-link"
              aria-label="View claim on Isonomia"
            >
              <ExternalLink size={12} />
              View
            </a>
          </div>

          {/* Claim text */}
          <div className="claim-text">{claim.text}</div>

          {/* Engagement stats */}
          {!compact && (argumentCount > 0 || supportCount > 0 || challengeCount > 0) && (
            <div className="stats-row">
              {argumentCount > 0 && (
                <span className="stat">
                  {argumentCount} argument{argumentCount !== 1 ? "s" : ""}
                </span>
              )}
              {supportCount > 0 && (
                <span className="stat stat-support">
                  {supportCount} support{supportCount !== 1 ? "s" : ""}
                </span>
              )}
              {challengeCount > 0 && (
                <span className="stat stat-challenge">
                  {challengeCount} challenge{challengeCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Evidence sources */}
          {!compact && claim.ClaimEvidence.length > 0 && (
            <div className="section">
              <div className="section-label">
                Sources ({claim.ClaimEvidence.length})
              </div>
              <div className="evidence-list">
                {claim.ClaimEvidence.map((ev) => (
                  <a
                    key={ev.id}
                    href={ev.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="evidence-item"
                  >
                    <span className="evidence-title">
                      {ev.title || ev.uri}
                    </span>
                    <ExternalLink size={11} className="evidence-icon" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="embed-footer">
            <span className="powered-by">
              Powered by{" "}
              <a href={BASE_URL} target="_blank" rel="noopener noreferrer">
                Isonomia
              </a>
            </span>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="respond-link"
            >
              Respond on Isonomia →
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

function embedStyles(theme: Theme): string {
  return `
    :root {
      --bg-color: #ffffff;
      --text-color: #1f2937;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
      --card-bg: #f9fafb;
      --accent-color: #6366f1;
      --badge-bg: #eef2ff;
      --badge-text: #4338ca;
      --evidence-bg: #f9fafb;
      --evidence-hover: #f3f4f6;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #111827;
        --text-color: #f9fafb;
        --text-muted: #9ca3af;
        --border-color: #1f2937;
        --card-bg: #1f2937;
        --accent-color: #818cf8;
        --badge-bg: #1e1b4b;
        --badge-text: #a5b4fc;
        --evidence-bg: #1f2937;
        --evidence-hover: #374151;
      }
    }

    .dark-theme {
      --bg-color: #111827;
      --text-color: #f9fafb;
      --text-muted: #9ca3af;
      --border-color: #1f2937;
      --card-bg: #1f2937;
      --accent-color: #818cf8;
      --badge-bg: #1e1b4b;
      --badge-text: #a5b4fc;
      --evidence-bg: #1f2937;
      --evidence-hover: #374151;
    }

    .light-theme {
      --bg-color: #ffffff;
      --text-color: #1f2937;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
      --card-bg: #f9fafb;
      --accent-color: #6366f1;
      --badge-bg: #eef2ff;
      --badge-text: #4338ca;
      --evidence-bg: #f9fafb;
      --evidence-hover: #f3f4f6;
    }

    *, *::before, *::after { box-sizing: border-box; }

    body {
      margin: 0;
      padding: 0;
      background: var(--bg-color);
      color: var(--text-color);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }

    .embed-container {
      padding: 16px;
    }

    .embed-container.compact {
      padding: 12px;
    }

    .embed-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .header-badges {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }

    .badge-claim {
      background: var(--badge-bg);
      color: var(--badge-text);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 10px;
    }

    .badge-moid {
      background: var(--card-bg);
      color: var(--text-muted);
      border: 1px solid var(--border-color);
      font-family: monospace;
      font-size: 10px;
    }

    .view-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--accent-color);
      text-decoration: none;
      padding: 5px 10px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--card-bg);
      flex-shrink: 0;
    }

    .view-link:hover {
      background: var(--border-color);
    }

    .claim-text {
      font-size: 15px;
      font-weight: 500;
      line-height: 1.55;
      color: var(--text-color);
      margin: 0 0 12px 0;
    }

    .stats-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .stat {
      font-size: 12px;
      color: var(--text-muted);
    }

    .stat-support {
      color: #10b981;
      font-weight: 600;
    }

    .stat-challenge {
      color: #ef4444;
      font-weight: 600;
    }

    .section {
      margin-top: 12px;
    }

    .section-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .evidence-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .evidence-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 10px;
      background: var(--evidence-bg);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      text-decoration: none;
      color: var(--text-color);
    }

    .evidence-item:hover {
      background: var(--evidence-hover);
    }

    .evidence-title {
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .evidence-icon {
      flex-shrink: 0;
      color: var(--text-muted);
    }

    .embed-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid var(--border-color);
      font-size: 11px;
      color: var(--text-muted);
    }

    .powered-by a {
      color: var(--accent-color);
      text-decoration: none;
    }

    .powered-by a:hover {
      text-decoration: underline;
    }

    .respond-link {
      color: var(--accent-color);
      text-decoration: none;
      font-size: 11px;
      font-weight: 600;
    }

    .respond-link:hover {
      text-decoration: underline;
    }
  `;
}
