/**
 * Stack Preview Embed Widget
 *
 * Embeddable widget showing a stack preview with thumbnail grid.
 * Designed for embedding in external sites.
 *
 * @route /embed/stack/[stackId]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prismaclient";
import { Citation, Source, Stack, StackItem } from "@prisma/client";
import { ExternalLink, Layers, FileText, Link2 } from "lucide-react";

type Theme = "light" | "dark" | "auto";

interface PageProps {
  params: Promise<{ stackId: string }>;
  searchParams: Promise<{ theme?: Theme; width?: string; compact?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { stackId } = await params;

  const stack = await prisma.stack.findUnique({
    where: { id: stackId },
    select: { name: true, description: true },
  });

  if (!stack) {
    return { title: "Stack Not Found" };
  }

  return {
    title: stack.name,
    description: stack.description || `Stack on Mesh`,
    openGraph: {
      title: stack.name,
      description: stack.description || undefined,
      type: "website",
    },
  };
}

type StackItemWithSource = StackItem & {
  source: Source & {
    citations: Citation[];
  };
};

type StackWithItems = Stack & {
  items: StackItemWithSource[];
  owner: { name: string | null };
};

export default async function StackEmbedPage({ params, searchParams }: PageProps) {
  const { stackId } = await params;
  const { theme = "auto", compact } = await searchParams;

  const stack = await prisma.stack.findUnique({
    where: { id: stackId },
    include: {
      items: {
        take: 12,
        orderBy: { position: "asc" },
      },
      owner: {
        select: { name: true },
      },
    },
  }) as unknown as StackWithItems | null;

  if (!stack) {
    notFound();
  }

  // Check visibility
  const isPublic =
    stack.visibility === "public_open" ||
    stack.visibility === "public_closed" ||
    stack.visibility === "unlisted";

  if (!isPublic) {
    notFound();
  }

  const isCompact = compact === "true";
  const themeClass = getThemeClass(theme);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mesh.app";

  return (
    <html lang="en" className={themeClass}>
      <body className="m-0 p-0 font-sans">
        <div className={`embed-container ${isCompact ? "compact" : ""}`}>
          {/* Header */}
          <div className="embed-header">
            <div className="header-content">
              <Layers className="icon" size={18} />
              <div className="header-text">
                <h1 className="stack-title">{stack.name}</h1>
                {!isCompact && stack.description && (
                  <p className="stack-description">{stack.description}</p>
                )}
              </div>
            </div>
            <a
              href={`${baseUrl}/stacks/${stack.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="view-link"
            >
              <ExternalLink size={14} />
              View
            </a>
          </div>

          {/* Items Grid */}
          <div className={`items-grid ${isCompact ? "compact-grid" : ""}`}>
            {stack.items.map((item) => (
              <SourceThumbnail
                key={item.id}
                source={item.source}
                baseUrl={baseUrl}
                isCompact={isCompact}
              />
            ))}
          </div>

          {/* Footer */}
          <div className="embed-footer">
            <span className="item-count">
              {stack.items.length} sources
            </span>
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

interface SourceThumbnailProps {
  source: StackItemWithSource["source"];
  baseUrl: string;
  isCompact: boolean;
}

function SourceThumbnail({ source, baseUrl, isCompact }: SourceThumbnailProps) {
  const hasCitations = source.citations && source.citations.length > 0;
  const typeIcon = getSourceTypeIcon(source.kind);

  return (
    <a
      href={`${baseUrl}/sources/${source.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="source-thumbnail"
    >
      <div className="thumbnail-icon">{typeIcon}</div>
      {!isCompact && (
        <>
          <div className="thumbnail-title">{source.title || "Untitled"}</div>
          {hasCitations && (
            <div className="citation-badge">Cited</div>
          )}
        </>
      )}
    </a>
  );
}

function getSourceTypeIcon(type: string | null) {
  switch (type) {
    case "book":
      return <FileText size={20} />;
    case "article":
      return <FileText size={20} />;
    case "website":
      return <Link2 size={20} />;
    default:
      return <FileText size={20} />;
  }
}

function getThemeClass(theme: Theme): string {
  if (theme === "dark") return "dark-theme";
  if (theme === "light") return "light-theme";
  return ""; // auto uses prefers-color-scheme
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
      --badge-bg: #dbeafe;
      --badge-text: #1d4ed8;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #111827;
        --text-color: #f9fafb;
        --text-muted: #9ca3af;
        --border-color: #374151;
        --card-bg: #1f2937;
        --accent-color: #60a5fa;
        --badge-bg: #1e3a5f;
        --badge-text: #93c5fd;
      }
    }

    .dark-theme {
      --bg-color: #111827;
      --text-color: #f9fafb;
      --text-muted: #9ca3af;
      --border-color: #374151;
      --card-bg: #1f2937;
      --accent-color: #60a5fa;
      --badge-bg: #1e3a5f;
      --badge-text: #93c5fd;
    }

    .light-theme {
      --bg-color: #ffffff;
      --text-color: #1f2937;
      --text-muted: #6b7280;
      --border-color: #e5e7eb;
      --card-bg: #f9fafb;
      --accent-color: #3b82f6;
      --badge-bg: #dbeafe;
      --badge-text: #1d4ed8;
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
      align-items: flex-start;
      margin-bottom: 16px;
      gap: 12px;
    }

    .header-content {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      flex: 1;
      min-width: 0;
    }

    .header-content .icon {
      flex-shrink: 0;
      color: var(--accent-color);
      margin-top: 2px;
    }

    .header-text {
      flex: 1;
      min-width: 0;
    }

    .stack-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 4px 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stack-description {
      font-size: 13px;
      color: var(--text-muted);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .view-link {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--accent-color);
      text-decoration: none;
      padding: 6px 10px;
      border-radius: 6px;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .view-link:hover {
      background: var(--border-color);
    }

    .items-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
      gap: 10px;
      margin-bottom: 16px;
    }

    .items-grid.compact-grid {
      grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
      gap: 6px;
    }

    .source-thumbnail {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 8px;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s;
    }

    .source-thumbnail:hover {
      border-color: var(--accent-color);
    }

    .compact-grid .source-thumbnail {
      padding: 8px;
    }

    .thumbnail-icon {
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .compact-grid .thumbnail-icon {
      margin-bottom: 0;
    }

    .thumbnail-title {
      font-size: 11px;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.3;
    }

    .citation-badge {
      font-size: 9px;
      background: var(--badge-bg);
      color: var(--badge-text);
      padding: 2px 6px;
      border-radius: 4px;
      margin-top: 6px;
    }

    .embed-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
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
  `;
}
