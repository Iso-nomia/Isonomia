/**
 * Evidence List Embed Widget
 *
 * Embeddable widget showing citations/evidence for a target,
 * grouped by citation intent.
 *
 * @route /embed/evidence/[targetId]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prismaclient";
import { Citation, Source } from "@prisma/client";
import { ExternalLink, FileText, CheckCircle2, AlertCircle, HelpCircle, Lightbulb } from "lucide-react";

type Theme = "light" | "dark" | "auto";

interface PageProps {
  params: Promise<{ targetId: string }>;
  searchParams: Promise<{ theme?: Theme; width?: string; compact?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { targetId } = await params;

  const count = await prisma.citation.count({
    where: { targetId },
  });

  return {
    title: `Evidence (${count} citations)`,
    description: `${count} citations supporting this content`,
  };
}

type CitationWithSource = Citation & {
  source: Source;
};

interface GroupedCitations {
  supporting: CitationWithSource[];
  contradicting: CitationWithSource[];
  background: CitationWithSource[];
  other: CitationWithSource[];
}

export default async function EvidenceEmbedPage({ params, searchParams }: PageProps) {
  const { targetId } = await params;
  const { theme = "auto", compact } = await searchParams;

  const citations = await prisma.citation.findMany({
    where: { targetId },
    include: {
      source: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  }) as CitationWithSource[];

  if (citations.length === 0) {
    notFound();
  }

  const isCompact = compact === "true";
  const themeClass = getThemeClass(theme);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mesh.app";

  const grouped = groupByIntent(citations);

  return (
    <html lang="en" className={themeClass}>
      <body className="m-0 p-0 font-sans">
        <div className={`embed-container ${isCompact ? "compact" : ""}`}>
          {/* Header */}
          <div className="embed-header">
            <div className="header-content">
              <FileText className="icon" size={18} />
              <h1 className="header-title">Evidence & Citations</h1>
            </div>
            <span className="citation-count">{citations.length} sources</span>
          </div>

          {/* Citation Groups */}
          <div className="citation-groups">
            {grouped.supporting.length > 0 && (
              <CitationGroup
                title="Supporting"
                icon={<CheckCircle2 size={14} />}
                citations={grouped.supporting}
                baseUrl={baseUrl}
                isCompact={isCompact}
                colorClass="supporting"
              />
            )}

            {grouped.contradicting.length > 0 && (
              <CitationGroup
                title="Contradicting"
                icon={<AlertCircle size={14} />}
                citations={grouped.contradicting}
                baseUrl={baseUrl}
                isCompact={isCompact}
                colorClass="contradicting"
              />
            )}

            {grouped.background.length > 0 && (
              <CitationGroup
                title="Background"
                icon={<Lightbulb size={14} />}
                citations={grouped.background}
                baseUrl={baseUrl}
                isCompact={isCompact}
                colorClass="background"
              />
            )}

            {grouped.other.length > 0 && (
              <CitationGroup
                title="Other"
                icon={<HelpCircle size={14} />}
                citations={grouped.other}
                baseUrl={baseUrl}
                isCompact={isCompact}
                colorClass="other"
              />
            )}
          </div>

          {/* Footer */}
          <div className="embed-footer">
            <span className="powered-by">
              Powered by <a href={baseUrl} target="_blank" rel="noopener">Mesh</a>
            </span>
          </div>

          <style>{embedStyles(theme)}</style>
        </div>
      </body>
    </html>
  );
}

interface CitationGroupProps {
  title: string;
  icon: React.ReactNode;
  citations: CitationWithSource[];
  baseUrl: string;
  isCompact: boolean;
  colorClass: string;
}

function CitationGroup({
  title,
  icon,
  citations,
  baseUrl,
  isCompact,
  colorClass,
}: CitationGroupProps) {
  return (
    <div className={`citation-group ${colorClass}`}>
      <div className="group-header">
        {icon}
        <span className="group-title">{title}</span>
        <span className="group-count">({citations.length})</span>
      </div>
      <div className="group-citations">
        {citations.map((citation) => (
          <CitationRow
            key={citation.id}
            citation={citation}
            baseUrl={baseUrl}
            isCompact={isCompact}
          />
        ))}
      </div>
    </div>
  );
}

interface CitationRowProps {
  citation: CitationWithSource;
  baseUrl: string;
  isCompact: boolean;
}

function CitationRow({ citation, baseUrl, isCompact }: CitationRowProps) {
  const source = citation.source;

  // Build inline citation display
  const authors = parseAuthors(
    typeof source.authorsJson === "string"
      ? source.authorsJson
      : source.authorsJson != null
        ? JSON.stringify(source.authorsJson)
        : null
  );
  const year = source.year ?? null;

  const inlineCitation = authors.length > 0
    ? `${authors[0]}${authors.length > 1 ? " et al." : ""}${year ? ` (${year})` : ""}`
    : source.title?.slice(0, 30) || "Source";

  return (
    <a
      href={`${baseUrl}/sources/${source.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="citation-row"
    >
      <div className="citation-content">
        <span className="inline-citation">{inlineCitation}</span>
        {!isCompact && (
          <span className="citation-title">{source.title}</span>
        )}
        {!isCompact && citation.quote && (
          <span className="citation-quote">&ldquo;{citation.quote}&rdquo;</span>
        )}
      </div>
      <ExternalLink size={12} className="external-icon" />
    </a>
  );
}

function parseAuthors(authors: string | null | undefined): string[] {
  if (!authors) return [];
  // Handle JSON array or comma-separated string
  try {
    const parsed = JSON.parse(authors);
    if (Array.isArray(parsed)) {
      return parsed.map((a: string | { name?: string }) =>
        typeof a === "string" ? a : a.name || ""
      );
    }
  } catch {
    // Treat as comma-separated
    return authors.split(",").map((a) => a.trim());
  }
  return [];
}

function groupByIntent(citations: CitationWithSource[]): GroupedCitations {
  const grouped: GroupedCitations = {
    supporting: [],
    contradicting: [],
    background: [],
    other: [],
  };

  for (const citation of citations) {
    const intent = citation.intent?.toLowerCase() || "";

    if (intent.includes("support") || intent.includes("confirm") || intent.includes("agree")) {
      grouped.supporting.push(citation);
    } else if (intent.includes("contradict") || intent.includes("refut") || intent.includes("oppos") || intent.includes("disagree")) {
      grouped.contradicting.push(citation);
    } else if (intent.includes("background") || intent.includes("context") || intent.includes("review")) {
      grouped.background.push(citation);
    } else {
      grouped.other.push(citation);
    }
  }

  return grouped;
}

function getThemeClass(theme: Theme): string {
  if (theme === "dark") return "dark-theme";
  if (theme === "light") return "light-theme";
  return "";
}

function embedStyles(theme: Theme): string {
  return `
    :root {
      --bg-color: #ffffff;
      --text-color: #1f2937;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
      --card-bg: #f9fafb;
      --accent-color: #3b82f6;
      --supporting-color: #10b981;
      --supporting-bg: #ecfdf5;
      --contradicting-color: #ef4444;
      --contradicting-bg: #fef2f2;
      --background-color: #8b5cf6;
      --background-bg: #f5f3ff;
      --other-color: #6b7280;
      --other-bg: #f9fafb;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #111827;
        --text-color: #f9fafb;
        --text-muted: #9ca3af;
        --border-color: #374151;
        --card-bg: #1f2937;
        --accent-color: #60a5fa;
        --supporting-bg: #064e3b;
        --contradicting-bg: #7f1d1d;
        --background-bg: #4c1d95;
        --other-bg: #1f2937;
      }
    }

    .dark-theme {
      --bg-color: #111827;
      --text-color: #f9fafb;
      --text-muted: #9ca3af;
      --border-color: #374151;
      --card-bg: #1f2937;
      --accent-color: #60a5fa;
      --supporting-bg: #064e3b;
      --contradicting-bg: #7f1d1d;
      --background-bg: #4c1d95;
      --other-bg: #1f2937;
    }

    .light-theme {
      --bg-color: #ffffff;
      --text-color: #1f2937;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
      --card-bg: #f9fafb;
      --accent-color: #3b82f6;
      --supporting-bg: #ecfdf5;
      --contradicting-bg: #fef2f2;
      --background-bg: #f5f3ff;
      --other-bg: #f9fafb;
    }

    body {
      background: var(--bg-color);
      color: var(--text-color);
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }

    .embed-container {
      padding: 16px;
      max-width: 100%;
      box-sizing: border-box;
    }

    .embed-container.compact {
      padding: 12px;
    }

    .embed-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }

    .header-content {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .header-content .icon {
      color: var(--accent-color);
    }

    .header-title {
      font-size: 14px;
      font-weight: 600;
      margin: 0;
    }

    .citation-count {
      font-size: 12px;
      color: var(--text-muted);
    }

    .citation-groups {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .citation-group {
      border-radius: 8px;
      overflow: hidden;
    }

    .citation-group.supporting .group-header {
      background: var(--supporting-bg);
      color: var(--supporting-color);
    }

    .citation-group.contradicting .group-header {
      background: var(--contradicting-bg);
      color: var(--contradicting-color);
    }

    .citation-group.background .group-header {
      background: var(--background-bg);
      color: var(--background-color);
    }

    .citation-group.other .group-header {
      background: var(--other-bg);
      color: var(--other-color);
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .group-title {
      flex: 1;
    }

    .group-count {
      font-weight: 400;
      opacity: 0.8;
    }

    .group-citations {
      border: 1px solid var(--border-color);
      border-top: none;
      border-radius: 0 0 8px 8px;
    }

    .citation-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 10px 12px;
      text-decoration: none;
      color: inherit;
      border-bottom: 1px solid var(--border-color);
      transition: background 0.15s;
    }

    .citation-row:last-child {
      border-bottom: none;
    }

    .citation-row:hover {
      background: var(--card-bg);
    }

    .citation-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }

    .inline-citation {
      font-size: 12px;
      font-weight: 600;
      color: var(--accent-color);
    }

    .citation-title {
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .citation-quote {
      font-size: 11px;
      color: var(--text-muted);
      font-style: italic;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .external-icon {
      color: var(--text-muted);
      flex-shrink: 0;
      margin-left: 8px;
      margin-top: 2px;
    }

    .embed-footer {
      display: flex;
      justify-content: flex-end;
      padding-top: 12px;
      margin-top: 16px;
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
  `;
}
