/**
 * Source Card Embed Widget
 *
 * Embeddable widget showing a single source with verification status.
 * Designed for embedding in external sites.
 *
 * @route /embed/source/[sourceId]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prismaclient";
import { Source } from "@prisma/client";
import {
  ExternalLink,
  FileText,
  Book,
  Globe,
  Link2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";

type Theme = "light" | "dark" | "auto";

interface PageProps {
  params: Promise<{ sourceId: string }>;
  searchParams: Promise<{ theme?: Theme; compact?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sourceId } = await params;

  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    select: { title: true, authorsJson: true, container: true },
  });

  if (!source) {
    return { title: "Source Not Found" };
  }

  return {
    title: source.title || "Untitled Source",
    description: source.container || `Source on Mesh`,
    openGraph: {
      title: source.title || "Source",
      description: source.container || undefined,
      type: "website",
    },
  };
}

type VerificationInfo = {
  id: string;
  status: string;
  verifiedAt: Date | null;
  score: number | null;
} | null;

type SourceWithVerification = Source & {
  _count: {
    citations: number;
  };
};

export default async function SourceEmbedPage({ params, searchParams }: PageProps) {
  const { sourceId } = await params;
  const { theme = "auto", compact } = await searchParams;

  const source = await prisma.source.findUnique({
    where: { id: sourceId },
    include: {
      _count: {
        select: { citations: true },
      },
    },
  }) as SourceWithVerification | null;

  if (!source) {
    notFound();
  }

  const verification: VerificationInfo =
    source.verificationStatus && source.verificationStatus !== "unverified"
      ? {
          id: source.id,
          status: source.verificationStatus,
          verifiedAt: source.verifiedAt,
          score: null,
        }
      : null;

  const isCompact = compact === "true";
  const themeClass = getThemeClass(theme);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mesh.app";

  const authors = parseAuthors(source.authorsJson);
  const year = source.year ?? null;

  const typeInfo = getSourceTypeInfo(source.kind);

  return (
    <html lang="en" className={themeClass}>
      <body className="m-0 p-0 font-sans">
        <div className={`embed-container ${isCompact ? "compact" : ""}`}>
          <a
            href={`${baseUrl}/sources/${source.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="source-card"
          >
            {/* Type Icon */}
            <div className="source-icon">{typeInfo.icon}</div>

            {/* Content */}
            <div className="source-content">
              <h1 className="source-title">{source.title || "Untitled"}</h1>

              {!isCompact && (
                <>
                  {authors.length > 0 && (
                    <p className="source-authors">
                      {formatAuthors(authors)}
                      {year && ` (${year})`}
                    </p>
                  )}

                  {source.container && (
                    <p className="source-container">{source.container}</p>
                  )}
                </>
              )}

              {/* Metadata row */}
              <div className="source-meta">
                <span className="meta-item type-badge">
                  {typeInfo.label}
                </span>

                {source._count.citations > 0 && (
                  <span className="meta-item citations">
                    {source._count.citations} citation{source._count.citations !== 1 ? "s" : ""}
                  </span>
                )}

                {source.doi && (
                  <span className="meta-item doi">
                    DOI
                  </span>
                )}
              </div>
            </div>

            {/* Verification Status */}
            <div className="verification-status">
              <VerificationBadge verification={verification} isCompact={isCompact} />
            </div>

            {/* External Link Icon */}
            <ExternalLink size={14} className="external-icon" />
          </a>

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

interface VerificationBadgeProps {
  verification: VerificationInfo;
  isCompact: boolean;
}

function VerificationBadge({ verification, isCompact }: VerificationBadgeProps) {
  if (!verification) {
    return (
      <div className="verification-badge pending">
        <Clock size={14} />
        {!isCompact && <span>Unverified</span>}
      </div>
    );
  }

  const status = verification.status.toLowerCase();

  if (status === "verified" || status === "confirmed") {
    return (
      <div className="verification-badge verified">
        <CheckCircle size={14} />
        {!isCompact && <span>Verified</span>}
      </div>
    );
  }

  if (status === "failed" || status === "invalid") {
    return (
      <div className="verification-badge failed">
        <XCircle size={14} />
        {!isCompact && <span>Failed</span>}
      </div>
    );
  }

  if (status === "warning" || status === "partial") {
    return (
      <div className="verification-badge warning">
        <AlertTriangle size={14} />
        {!isCompact && <span>Partial</span>}
      </div>
    );
  }

  return (
    <div className="verification-badge pending">
      <Clock size={14} />
      {!isCompact && <span>Pending</span>}
    </div>
  );
}

function getSourceTypeInfo(type: string | null): { icon: React.ReactNode; label: string } {
  switch (type?.toLowerCase()) {
    case "book":
      return { icon: <Book size={24} />, label: "Book" };
    case "article":
    case "journal-article":
      return { icon: <FileText size={24} />, label: "Article" };
    case "website":
    case "webpage":
      return { icon: <Globe size={24} />, label: "Website" };
    case "report":
      return { icon: <FileText size={24} />, label: "Report" };
    default:
      return { icon: <Link2 size={24} />, label: type || "Source" };
  }
}

function parseAuthors(authors: unknown): string[] {
  if (!authors) return [];
  const toNames = (arr: unknown[]): string[] =>
    arr.map((a) => {
      if (typeof a === "string") return a;
      if (a && typeof a === "object") {
        const obj = a as { name?: string; family?: string; given?: string };
        if (obj.name) return obj.name;
        return [obj.given, obj.family].filter(Boolean).join(" ");
      }
      return "";
    });
  if (Array.isArray(authors)) {
    return toNames(authors);
  }
  if (typeof authors === "string") {
    try {
      const parsed = JSON.parse(authors);
      if (Array.isArray(parsed)) {
        return toNames(parsed);
      }
    } catch {
      return authors.split(",").map((a) => a.trim());
    }
  }
  return [];
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return `${authors[0]} et al.`;
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
      --verified-color: #10b981;
      --verified-bg: #ecfdf5;
      --warning-color: #f59e0b;
      --warning-bg: #fffbeb;
      --failed-color: #ef4444;
      --failed-bg: #fef2f2;
      --pending-color: #6b7280;
      --pending-bg: #f9fafb;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #111827;
        --text-color: #f9fafb;
        --text-muted: #9ca3af;
        --border-color: #374151;
        --card-bg: #1f2937;
        --accent-color: #60a5fa;
        --verified-bg: #064e3b;
        --warning-bg: #78350f;
        --failed-bg: #7f1d1d;
        --pending-bg: #1f2937;
      }
    }

    .dark-theme {
      --bg-color: #111827;
      --text-color: #f9fafb;
      --text-muted: #9ca3af;
      --border-color: #374151;
      --card-bg: #1f2937;
      --accent-color: #60a5fa;
      --verified-bg: #064e3b;
      --warning-bg: #78350f;
      --failed-bg: #7f1d1d;
      --pending-bg: #1f2937;
    }

    .light-theme {
      --bg-color: #ffffff;
      --text-color: #1f2937;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
      --card-bg: #f9fafb;
      --accent-color: #3b82f6;
      --verified-bg: #ecfdf5;
      --warning-bg: #fffbeb;
      --failed-bg: #fef2f2;
      --pending-bg: #f9fafb;
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
      padding: 10px;
    }

    .source-card {
      display: flex;
      gap: 12px;
      padding: 14px;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
      align-items: flex-start;
    }

    .source-card:hover {
      border-color: var(--accent-color);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .compact .source-card {
      padding: 10px;
      gap: 10px;
    }

    .source-icon {
      flex-shrink: 0;
      color: var(--text-muted);
      padding: 8px;
      background: var(--bg-color);
      border-radius: 8px;
    }

    .compact .source-icon {
      padding: 6px;
    }

    .source-content {
      flex: 1;
      min-width: 0;
    }

    .source-title {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 4px 0;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .compact .source-title {
      -webkit-line-clamp: 1;
      white-space: nowrap;
    }

    .source-authors {
      font-size: 12px;
      color: var(--text-muted);
      margin: 0 0 4px 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .source-container {
      font-size: 11px;
      color: var(--text-muted);
      margin: 0 0 8px 0;
      font-style: italic;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .source-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .meta-item {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg-color);
      color: var(--text-muted);
    }

    .meta-item.type-badge {
      text-transform: capitalize;
    }

    .meta-item.citations {
      color: var(--accent-color);
    }

    .meta-item.doi {
      font-weight: 600;
    }

    .verification-status {
      flex-shrink: 0;
    }

    .verification-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
    }

    .verification-badge.verified {
      background: var(--verified-bg);
      color: var(--verified-color);
    }

    .verification-badge.warning {
      background: var(--warning-bg);
      color: var(--warning-color);
    }

    .verification-badge.failed {
      background: var(--failed-bg);
      color: var(--failed-color);
    }

    .verification-badge.pending {
      background: var(--pending-bg);
      color: var(--pending-color);
    }

    .external-icon {
      flex-shrink: 0;
      color: var(--text-muted);
      opacity: 0;
      transition: opacity 0.15s;
    }

    .source-card:hover .external-icon {
      opacity: 1;
    }

    .embed-footer {
      display: flex;
      justify-content: flex-end;
      padding-top: 10px;
      margin-top: 12px;
      font-size: 10px;
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
