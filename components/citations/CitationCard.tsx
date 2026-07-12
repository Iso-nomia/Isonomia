"use client";

/**
 * CitationCard Component
 * 
 * Phase 2.1 of Stacks Improvement Roadmap
 * Phase 3.1: Added source trust badges (verification + archive status)
 * 
 * Displays a citation with click-to-navigate functionality.
 * Clicking navigates to the exact location in the source.
 */

import { 
  ExternalLinkIcon, 
  FileTextIcon, 
  VideoIcon, 
  ImageIcon,
  QuoteIcon,
  MapPinIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  getCitationNavigationTarget, 
  CitationWithSource,
} from "@/lib/citations/navigation";
import { IntentBadge, CitationIntentType } from "./IntentSelector";
import { SourceTrustBadges, SourceTrustData } from "@/components/sources/SourceTrustBadges";
import { SourceVerificationStatus } from "@/components/sources/VerificationBadge";
import { ArchiveStatus } from "@/components/sources/ArchiveBadge";

// Extended source type with trust fields
interface SourceWithTrust {
  id: string;
  title?: string | null;
  url?: string | null;
  verificationStatus?: SourceVerificationStatus;
  lastCheckedAt?: Date | string | null;
  canonicalUrl?: string | null;
  archiveStatus?: ArchiveStatus;
  archiveUrl?: string | null;
  archivedAt?: Date | string | null;
}

interface CitationCardProps {
  citation: CitationWithSource & { 
    intent?: CitationIntentType | null;
    source: SourceWithTrust;
  };
  compact?: boolean;
  className?: string;
  showIntent?: boolean;
  showTrustBadges?: boolean;
  onNavigate?: () => void;
}

export function CitationCard({ 
  citation, 
  compact = false, 
  className,
  showIntent = true,
  showTrustBadges = false,
  onNavigate,
}: CitationCardProps) {
  const navTarget = getCitationNavigationTarget(citation);

  // Build source trust data if trust badges are enabled
  const sourceTrustData: SourceTrustData | null = showTrustBadges && citation.source.verificationStatus ? {
    id: citation.source.id,
    verificationStatus: citation.source.verificationStatus,
    lastCheckedAt: citation.source.lastCheckedAt,
    canonicalUrl: citation.source.canonicalUrl,
    archiveStatus: citation.source.archiveStatus || "none",
    archiveUrl: citation.source.archiveUrl,
    archivedAt: citation.source.archivedAt,
  } : null;

  const handleClick = () => {
    if (!navTarget) return;

    onNavigate?.();

    if (navTarget.type === "pdf") {
      // For PDFs, dispatch an event that PdfLightbox can listen to
      // This opens the PDF in a modal at the correct page
      const postId = navTarget.url.replace("/library/", "");
      window.dispatchEvent(new CustomEvent("pdf:open", {
        detail: {
          postId,
          page: navTarget.params.page,
          highlight: navTarget.params.highlight,
          rect: navTarget.params.rect,
        },
      }));
    } else if (navTarget.type === "video" || navTarget.type === "link") {
      // Open external link/video in new tab
      window.open(navTarget.url, "_blank", "noopener,noreferrer");
    } else if (navTarget.type === "image") {
      // Open image in new tab (could enhance with region highlight in future)
      window.open(navTarget.url, "_blank", "noopener,noreferrer");
    }
  };

  // Determine icon based on navigation type
  const TypeIcon = getTypeIcon(navTarget?.type);
  // Type assertion to handle Prisma client cache issues
  const hasAnchor = !!(citation as any).anchorType;
  const isNavigable = !!navTarget;

  return (
    <div
      onClick={isNavigable ? handleClick : undefined}
      className={cn(
        "group p-3 rounded-lg border transition-all",
        isNavigable && "cursor-pointer hover:border-primary/50 hover:bg-muted/50",
        !isNavigable && "opacity-75",
        className
      )}
      role={isNavigable ? "button" : undefined}
      tabIndex={isNavigable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isNavigable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="p-2 rounded-md bg-muted flex-shrink-0">
          <TypeIcon className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Source title and intent badge */}
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm line-clamp-1 flex-1 min-w-0">
              {citation.source.title || "Untitled Source"}
            </span>
            {/* Phase 3.1: Inline trust badges */}
            {sourceTrustData && (
              <div onClick={(e) => e.stopPropagation()}>
                <SourceTrustBadges 
                  source={sourceTrustData} 
                  compact={true}
                />
              </div>
            )}
            {showIntent && citation.intent && (
              <IntentBadge intent={citation.intent} showLabel={!compact} />
            )}
          </div>

          {/* Locator with anchor indicator */}
          {citation.locator && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {hasAnchor && (
                <MapPinIcon className="h-3 w-3 text-primary" />
              )}
              <span>{citation.locator}</span>
            </div>
          )}

          {/* Quote */}
          {!compact && citation.quote && (
            <blockquote className="mt-2 text-sm italic text-muted-foreground border-l-2 border-muted-foreground/30 pl-2 line-clamp-2">
              &ldquo;{citation.quote}&rdquo;
            </blockquote>
          )}

          {/* Note */}
          {!compact && citation.note && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {citation.note}
            </p>
          )}

          {/* Relevance indicator */}
          {citation.relevance && (
            <div className="mt-1.5 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 w-3 rounded-full",
                    i < citation.relevance! 
                      ? "bg-primary" 
                      : "bg-muted"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Navigate indicator */}
        {isNavigable && (
          <ExternalLinkIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        )}
      </div>
    </div>
  );
}

/**
 * Get the appropriate icon for the navigation type
 */
function getTypeIcon(type?: "pdf" | "link" | "video" | "image") {
  switch (type) {
    case "pdf":
      return FileTextIcon;
    case "video":
      return VideoIcon;
    case "image":
      return ImageIcon;
    case "link":
    default:
      return ExternalLinkIcon;
  }
}

/**
 * Compact citation badge for inline display
 */
interface CitationBadgeProps {
  citation: CitationWithSource;
  onClick?: () => void;
}

export function CitationBadge({ citation, onClick }: CitationBadgeProps) {
  const navTarget = getCitationNavigationTarget(citation);
  // Type assertion to handle Prisma client cache issues
  const hasAnchor = !!(citation as any).anchorType;

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full",
        "bg-muted hover:bg-muted/80 transition-colors",
        hasAnchor && "ring-1 ring-primary/30"
      )}
      title={citation.source.title || "View source"}
    >
      {hasAnchor && <MapPinIcon className="h-3 w-3 text-primary" />}
      <QuoteIcon className="h-3 w-3" />
      <span className="max-w-[120px] truncate">
        {citation.locator || citation.source.title?.slice(0, 20) || "Source"}
      </span>
    </button>
  );
}

export default CitationCard;
