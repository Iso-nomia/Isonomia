/**
 * Citation Navigation Utility
 * 
 * Phase 2.1 of Stacks Improvement Roadmap
 * 
 * Enables click-to-navigate functionality for citations,
 * taking users to the exact location in the source.
 */

import { Citation, Source, Annotation } from "@prisma/client";
import { parseAnchorData, CitationAnchor } from "./anchorTypes";

export interface CitationNavigationTarget {
  type: "pdf" | "link" | "video" | "image";
  url: string;
  params: Record<string, any>;
}

export type CitationWithSource = Citation & {
  source: Source & {
    libraryPostId?: string | null;
  };
  annotation?: Annotation | null;
};

/**
 * Determine the navigation target for a citation
 * Returns null if the citation cannot be navigated to
 */
export function getCitationNavigationTarget(
  citation: CitationWithSource
): CitationNavigationTarget | null {
  const { source, anchorType, anchorData, annotation } = citation;

  // Parse anchor data into typed structure
  const anchor = anchorType 
    ? parseAnchorData(anchorType, anchorData) 
    : null;

  // PDF source (via library post)
  if (source.libraryPostId) {
    const page = getPageFromAnchor(anchor, annotation) || 1;
    const highlightId = anchorType === "annotation" ? citation.anchorId : null;
    const rect = getRect(anchor, annotation);

    return {
      type: "pdf",
      url: `/library/${source.libraryPostId}`,
      params: {
        page,
        highlight: highlightId,
        rect,
      },
    };
  }

  // Video/audio source with timestamp
  if (source.url && anchor?.type === "timestamp") {
    const { start, end } = anchor;
    
    // YouTube timestamp URL format
    if (isYouTubeUrl(source.url)) {
      const urlWithTimestamp = appendYouTubeTimestamp(source.url, start);
      return {
        type: "video",
        url: urlWithTimestamp,
        params: { start, end },
      };
    }

    // Vimeo timestamp URL format
    if (isVimeoUrl(source.url)) {
      const urlWithTimestamp = appendVimeoTimestamp(source.url, start);
      return {
        type: "video",
        url: urlWithTimestamp,
        params: { start, end },
      };
    }

    // Generic video - pass timestamp in params
    return {
      type: "video",
      url: source.url,
      params: { start, end },
    };
  }

  // Image with coordinates
  if (source.url && anchor?.type === "coordinates") {
    return {
      type: "image",
      url: source.url,
      params: {
        x: anchor.x,
        y: anchor.y,
        width: anchor.width,
        height: anchor.height,
      },
    };
  }

  // Web link (may have text range anchor)
  if (source.url) {
    return {
      type: "link",
      url: source.url,
      params: {
        textRange: anchor?.type === "text_range" ? anchor : null,
      },
    };
  }

  return null;
}

/**
 * Build URL with query params for navigating to a PDF citation
 */
export function buildPDFNavigationUrl(target: CitationNavigationTarget): string {
  if (target.type !== "pdf") return target.url;

  const params = new URLSearchParams();
  
  if (target.params.page) {
    params.set("page", String(target.params.page));
  }
  
  if (target.params.highlight) {
    params.set("highlight", target.params.highlight);
  }

  const queryString = params.toString();
  return queryString ? `${target.url}?${queryString}` : target.url;
}

/**
 * Extract page number from anchor data or annotation
 */
function getPageFromAnchor(
  anchor: CitationAnchor | null,
  annotation?: Annotation | null
): number | null {
  if (anchor?.type === "annotation" || anchor?.type === "page") {
    return anchor.page;
  }
  if (annotation?.page) {
    return annotation.page;
  }
  return null;
}

/**
 * Extract rect from anchor data or annotation
 */
function getRect(
  anchor: CitationAnchor | null,
  annotation?: Annotation | null
): { x: number; y: number; width: number; height: number } | null {
  if (anchor?.type === "annotation" && anchor.rect) {
    return anchor.rect;
  }
  if (anchor?.type === "coordinates") {
    return {
      x: anchor.x,
      y: anchor.y,
      width: anchor.width,
      height: anchor.height,
    };
  }
  if (annotation?.rect) {
    return annotation.rect as { x: number; y: number; width: number; height: number };
  }
  return null;
}

/**
 * Check if URL is a YouTube video
 */
function isYouTubeUrl(url: string): boolean {
  return /youtube\.com|youtu\.be/i.test(url);
}

/**
 * Check if URL is a Vimeo video
 */
function isVimeoUrl(url: string): boolean {
  return /vimeo\.com/i.test(url);
}

/**
 * Append timestamp to YouTube URL
 */
function appendYouTubeTimestamp(url: string, startSeconds: number): string {
  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set("t", String(Math.floor(startSeconds)));
    return urlObj.toString();
  } catch {
    return `${url}${url.includes("?") ? "&" : "?"}t=${Math.floor(startSeconds)}`;
  }
}

/**
 * Append timestamp to Vimeo URL
 */
function appendVimeoTimestamp(url: string, startSeconds: number): string {
  // Vimeo uses #t=1m2s format
  const minutes = Math.floor(startSeconds / 60);
  const seconds = Math.floor(startSeconds % 60);
  return `${url}#t=${minutes}m${seconds}s`;
}

/**
 * Format locator string for display
 */
export function formatCitationLocator(citation: Citation): string {
  if (citation.locator) {
    return citation.locator;
  }

  // Auto-generate from anchor data
  const anchor = citation.anchorType 
    ? parseAnchorData(citation.anchorType, citation.anchorData) 
    : null;

  if (!anchor) return "";

  switch (anchor.type) {
    case "annotation":
    case "page":
      return `p. ${anchor.page}`;

    case "timestamp": {
      const formatTime = (secs: number) => {
        const mins = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${mins}:${s.toString().padStart(2, "0")}`;
      };
      if (anchor.end !== undefined) {
        return `${formatTime(anchor.start)}–${formatTime(anchor.end)}`;
      }
      return formatTime(anchor.start);
    }

    case "text_range":
      return "text selection";

    case "coordinates":
      return "region";

    default:
      return "";
  }
}
