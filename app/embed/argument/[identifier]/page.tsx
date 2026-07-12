import { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { resolvePermalink } from "@/lib/citations/permalinkService";
import { prisma } from "@/lib/prismaclient";

export const dynamic = "force-dynamic";

type Theme = "auto" | "light" | "dark";

type PageProps = {
  params: Promise<{ identifier: string }>;
  searchParams: Promise<{
    theme?: string;
    compact?: string;
    showEvidence?: string;
    showPremises?: string;
  }>;
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
  const { identifier } = await params;
  const resolved = await resolvePermalink(identifier);
  if (!resolved) return { title: "Argument — Isonomia" };

  const argument = await prisma.argument.findUnique({
    where: { id: resolved.argumentId },
    select: {
      text: true,
      conclusion: { select: { text: true } },
    },
  });

  const title = argument?.conclusion?.text
    ? `Argument: ${argument.conclusion.text.slice(0, 80)}`
    : "Argument — Isonomia";

  return {
    title,
    description: argument?.text.slice(0, 160),
  };
}

export default async function ArgumentEmbedPage({
  params,
  searchParams,
}: PageProps) {
  const { identifier } = await params;
  const {
    theme: rawTheme,
    compact: rawCompact,
    showEvidence: rawShowEvidence,
    showPremises: rawShowPremises,
  } = await searchParams;

  const theme = getTheme(rawTheme);
  const compact = rawCompact === "true";
  const showEvidence = rawShowEvidence !== "false";
  const showPremises = rawShowPremises !== "false";
  const themeClass = getThemeClass(theme);

  // Resolve identifier (shortCode or slug) → argumentId
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
          ClaimEvidence: {
            select: { id: true, title: true, uri: true },
            take: 5,
          },
        },
      },
      premises: {
        select: { claim: { select: { id: true, text: true } } },
        take: 5,
      },
      argumentSchemes: {
        select: { scheme: { select: { name: true, title: true } } },
        orderBy: [{ isPrimary: "desc" }, { order: "asc" }],
        take: 2,
      },
      deliberation: { select: { id: true, title: true } },
    },
  });

  const publicUrl = `${BASE_URL}/a/${identifier}`;

  if (!argument) {
    return (
      <html lang="en">
        <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#111827", color: "#9ca3af" }}>
          <div style={{ padding: "24px", textAlign: "center" }}>
            <p>This argument is not available.</p>
            <a href={BASE_URL} style={{ color: "#6366f1", fontSize: "13px" }}>
              Isonomia
            </a>
          </div>
        </body>
      </html>
    );
  }

  const confidence =
    argument.confidence !== null && argument.confidence !== undefined
      ? Math.round(argument.confidence * 100)
      : null;

  const primaryScheme = argument.argumentSchemes[0]?.scheme;
  const schemeName = primaryScheme?.name || primaryScheme?.title || null;

  const evidence = showEvidence ? (argument.conclusion?.ClaimEvidence ?? []) : [];
  const premises = showPremises ? argument.premises : [];

  return (
    <html lang="en" className={themeClass}>
      <body>
        <div className={`embed-container${compact ? " compact" : ""}`}>
          <style>{embedStyles(theme)}</style>

          {/* Header */}
          <div className="embed-header">
            <div className="header-badges">
              <span className="badge badge-argument">Argument</span>
              {schemeName && (
                <span className="badge badge-scheme">{schemeName}</span>
              )}
              {confidence !== null && (
                <span className="badge badge-confidence">{confidence}% confidence</span>
              )}
            </div>
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="view-link"
              aria-label="View argument on Isonomia"
            >
              <ExternalLink size={12} />
              View
            </a>
          </div>

          {/* Confidence bar */}
          {confidence !== null && (
            <div className="confidence-track">
              <div
                className="confidence-fill"
                style={{ width: `${confidence}%` }}
              />
            </div>
          )}

          {/* Conclusion claim */}
          {argument.conclusion?.text && (
            <div className="section conclusion-section">
              <div className="section-label">Conclusion</div>
              <p className="conclusion-text">{argument.conclusion.text}</p>
            </div>
          )}

          {/* Argument text */}
          <div className="argument-text">{argument.text}</div>

          {/* Premises */}
          {!compact && premises.length > 0 && (
            <div className="section">
              <div className="section-label">Premises</div>
              <ul className="premise-list">
                {premises.map(({ claim }) => (
                  <li key={claim.id} className="premise-item">
                    {claim.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence sources */}
          {!compact && evidence.length > 0 && (
            <div className="section">
              <div className="section-label">
                Evidence ({evidence.length})
              </div>
              <div className="evidence-list">
                {evidence.map((ev) => (
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
            {argument.deliberation?.title && (
              <span className="delib-name">
                {argument.deliberation.title}
              </span>
            )}
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
      --confidence-fill: #6366f1;
      --confidence-track: #e0e7ff;
      --conclusion-bg: #fafafa;
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
        --confidence-fill: #818cf8;
        --confidence-track: #1e1b4b;
        --conclusion-bg: #1a1f2e;
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
      --confidence-fill: #818cf8;
      --confidence-track: #1e1b4b;
      --conclusion-bg: #1a1f2e;
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
      --confidence-fill: #6366f1;
      --confidence-track: #e0e7ff;
      --conclusion-bg: #fafafa;
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
      margin-bottom: 10px;
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
      letter-spacing: 0.03em;
    }

    .badge-argument {
      background: var(--badge-bg);
      color: var(--badge-text);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 10px;
    }

    .badge-scheme {
      background: var(--card-bg);
      color: var(--text-muted);
      border: 1px solid var(--border-color);
    }

    .badge-confidence {
      background: transparent;
      color: var(--accent-color);
      font-weight: 700;
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
      transition: background 0.15s;
    }

    .view-link:hover {
      background: var(--border-color);
    }

/* ---- Universal Button v2 ---- */
.btnv2 {
  /* theming hooks */
  --btn-accent: 99,102,241;           /* indigo-500 (R,G,B) */
  --btn-border: 15,23,42;             /* slate-900 */
  --btn-text: 30,41,59;               /* slate-800 */
  --btn-bg-top: 255,255,255;          /* light glass */
  --btn-bg-bot: 255,255,255;

  -webkit-tap-highlight-color: transparent;
  appearance: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: .45rem;

  padding: .4rem .6rem;
  font-size: 13px;
  line-height: 1;
  border-radius: 8px;
  border: .5px solid rgba(var(--btn-border), .18);
  color: rgb(var(--btn-text));
  background: linear-gradient(180deg,
    rgba(var(--btn-bg-top), .92),
    rgba(var(--btn-bg-bot), .70)
  );
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.35),
    0 1px 2px rgba(2,6,23,.06),
    0 10px 20px -12px rgba(2,6,23,.16);
  backdrop-filter: saturate(1.05) blur(6px);
  transition:
    transform .12s ease,
    box-shadow .18s ease,
    border-color .18s ease,
    background-color .18s ease,
    color .18s ease;
  cursor: pointer;
}
.btnv2:hover {
  transform: translateY(-.5px);
  /* tasteful inset “press-in” feel */
  box-shadow:
    inset 0 1px 2px rgba(2,6,23,.08),
    inset 0 -2px 8px rgba(2,6,23,.06),
    0 4px 10px -6px rgba(2,6,23,.18);
}
.btnv2:active {
  transform: translateY(0);
  box-shadow:
    inset 0 2px 6px rgba(2,6,23,.18);
}
.btnv2:focus-visible {
  outline: none;
  border-color: rgba(var(--btn-accent), .45);
  box-shadow:
    0 0 0 3px rgba(var(--btn-accent), .22),
    inset 0 0 0 1px rgba(var(--btn-accent), .65);
}

/* Dark mode tuning */
.dark .btnv2 {
  --btn-text: 241,245,249;           /* slate-50 */
  --btn-bg-top: 15,23,42;            /* slate-900 glass */
  --btn-bg-bot: 15,23,42;
  border-color: rgba(148,163,184,.25);
  background: linear-gradient(180deg,
    rgba(var(--btn-bg-top), .62),
    rgba(var(--btn-bg-bot), .38)
  );
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.06),
    0 1px 2px rgba(0,0,0,.35),
    0 10px 20px -12px rgba(0,0,0,.5);
}
.dark .btnv2:hover {
  box-shadow:
    inset 0 1px 2px rgba(255,255,255,.06),
    inset 0 -2px 8px rgba(0,0,0,.25),
    0 4px 10px -6px rgba(0,0,0,.55);
}

/* Sizes & utility variants (optional) */
.btnv2--sm { padding: .32rem .5rem; font-size: 12px; border-radius: 7px; }
.btnv2--lg { padding: .56rem .9rem; font-size: 14px; border-radius: 10px; }
.btnv2--icon { padding: .42rem; width: 2rem; height: 2rem; display: inline-grid; place-items: center; }

/* Ghost (bordered, transparent) */
.btnv2--ghost {
  background: transparent;
  backdrop-filter: none;
  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.2);
}
.btnv2--ghost:hover {
  box-shadow:
    inset 0 1px 2px rgba(2,6,23,.08),
    0 4px 10px -8px rgba(2,6,23,.12);
}
    .confidence-track {
      height: 3px;
      background: var(--confidence-track);
      border-radius: 2px;
      margin-bottom: 14px;
      overflow: hidden;
    }

    .confidence-fill {
      height: 100%;
      background: var(--confidence-fill);
      border-radius: 2px;
      transition: width 0.4s ease;
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

    .conclusion-section {
      background: var(--conclusion-bg);
      border-left: 3px solid var(--accent-color);
      border-radius: 0 6px 6px 0;
      padding: 10px 12px;
      margin-bottom: 12px;
    }

    .conclusion-text {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.4;
      color: var(--text-color);
    }

    .argument-text {
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-color);
      margin: 0 0 4px 0;
    }

    .premise-list {
      margin: 0;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .premise-item {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.4;
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
      transition: background 0.15s;
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

    .delib-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 50%;
    }
  `;
}
