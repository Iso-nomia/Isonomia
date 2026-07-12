/**
 * Citation Anchor Types
 * 
 * Phase 2.1 of Stacks Improvement Roadmap
 * 
 * TypeScript types for executable citation references that
 * enable click-to-navigate functionality.
 */

/**
 * Anchor for PDF annotations/highlights
 * Links to an existing Annotation record
 */
export interface AnnotationAnchor {
  type: "annotation";
  annotationId: string;
  page: number;
  // Denormalized for quick display without fetching annotation
  rect?: { x: number; y: number; width: number; height: number };
}

/**
 * Anchor for web capture text selections
 * Uses CSS selector paths to identify text ranges
 */
export interface TextRangeAnchor {
  type: "text_range";
  // CSS selector path to start element
  startSelector: string;
  startOffset: number;
  // CSS selector path to end element
  endSelector: string;
  endOffset: number;
}

/**
 * Anchor for video/audio timestamps
 * Supports both point-in-time and range selections
 */
export interface TimestampAnchor {
  type: "timestamp";
  start: number;  // Seconds from beginning
  end?: number;   // Optional end time for range selections
}

/**
 * Anchor for page-level references
 * Used when citing a whole page without specific selection
 */
export interface PageAnchor {
  type: "page";
  page: number;
}

/**
 * Anchor for image region selections
 * Uses percentage-based coordinates for responsive display
 */
export interface CoordinatesAnchor {
  type: "coordinates";
  x: number;      // X position (percentage)
  y: number;      // Y position (percentage)
  width: number;  // Width (percentage)
  height: number; // Height (percentage)
}

/**
 * Union type for all anchor types
 */
export type CitationAnchor =
  | AnnotationAnchor
  | TextRangeAnchor
  | TimestampAnchor
  | PageAnchor
  | CoordinatesAnchor;

/**
 * Type guard for AnnotationAnchor
 */
export function isAnnotationAnchor(anchor: CitationAnchor): anchor is AnnotationAnchor {
  return anchor.type === "annotation";
}

/**
 * Type guard for TextRangeAnchor
 */
export function isTextRangeAnchor(anchor: CitationAnchor): anchor is TextRangeAnchor {
  return anchor.type === "text_range";
}

/**
 * Type guard for TimestampAnchor
 */
export function isTimestampAnchor(anchor: CitationAnchor): anchor is TimestampAnchor {
  return anchor.type === "timestamp";
}

/**
 * Type guard for PageAnchor
 */
export function isPageAnchor(anchor: CitationAnchor): anchor is PageAnchor {
  return anchor.type === "page";
}

/**
 * Type guard for CoordinatesAnchor
 */
export function isCoordinatesAnchor(anchor: CitationAnchor): anchor is CoordinatesAnchor {
  return anchor.type === "coordinates";
}

/**
 * Parse anchor data from JSON stored in database
 */
export function parseAnchorData(anchorType: string | null, anchorData: unknown): CitationAnchor | null {
  if (!anchorType || !anchorData) return null;

  const data = anchorData as Record<string, unknown>;

  switch (anchorType) {
    case "annotation":
      return {
        type: "annotation",
        annotationId: String(data.annotationId || ""),
        page: Number(data.page || 1),
        rect: data.rect as AnnotationAnchor["rect"],
      };

    case "text_range":
      return {
        type: "text_range",
        startSelector: String(data.startSelector || ""),
        startOffset: Number(data.startOffset || 0),
        endSelector: String(data.endSelector || ""),
        endOffset: Number(data.endOffset || 0),
      };

    case "timestamp":
      return {
        type: "timestamp",
        start: Number(data.start || 0),
        end: data.end !== undefined ? Number(data.end) : undefined,
      };

    case "page":
      return {
        type: "page",
        page: Number(data.page || 1),
      };

    case "coordinates":
      return {
        type: "coordinates",
        x: Number(data.x || 0),
        y: Number(data.y || 0),
        width: Number(data.width || 0),
        height: Number(data.height || 0),
      };

    default:
      return null;
  }
}

/**
 * Format anchor for display (human-readable locator)
 */
export function formatAnchorLocator(anchor: CitationAnchor): string {
  switch (anchor.type) {
    case "annotation":
    case "page":
      return `p. ${anchor.page}`;

    case "timestamp": {
      const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
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
