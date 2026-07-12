"use client";

/**
 * BlockCard
 * 
 * Phase 1.2 of Stacks Improvement Roadmap
 * 
 * Unified block card router that renders the appropriate card component
 * based on block type (pdf, link, text, image, video, dataset, embed)
 */

import { LinkBlockCard } from "./LinkBlockCard";
import { TextBlockCard } from "./TextBlockCard";
import { VideoBlockCard } from "./VideoBlockCard";
import { FileTextIcon, ImageIcon, DatabaseIcon, CodeIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Block type enum (matches Prisma schema)
type BlockType = "pdf" | "link" | "text" | "image" | "video" | "dataset" | "embed";

// Partial LibraryPost with required fields for block rendering
export interface BlockData {
  id: string;
  title: string | null;
  blockType: BlockType;
  file_url: string | null;
  processingStatus: string;
  
  // PDF fields
  page_count: number;
  cover_image_url: string | null;
  
  // Link fields
  linkUrl: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  linkImage: string | null;
  linkFavicon: string | null;
  linkSiteName: string | null;
  linkScreenshot: string | null;
  
  // Text fields
  textContent: string | null;
  textFormat: string | null;
  
  // Image fields
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageAltText: string | null;
  
  // Video fields
  videoUrl: string | null;
  videoProvider: string | null;
  videoEmbedCode: string | null;
  videoThumbnail: string | null;
  videoDuration: number | null;
}

interface BlockCardProps {
  block: BlockData;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
  onOpenPdf?: (blockId: string) => void;
}

/**
 * PdfBlockCard - Renders PDF documents with cover preview
 */
function PdfBlockCard({ 
  block, 
  compact, 
  className, 
  onOpenPdf 
}: { 
  block: BlockData; 
  compact?: boolean; 
  className?: string;
  onOpenPdf?: (blockId: string) => void;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card overflow-hidden",
        "hover:border-primary/50 transition-colors cursor-pointer",
        className
      )}
      onClick={() => onOpenPdf?.(block.id)}
    >
      {/* Cover Image */}
      <div className="aspect-[3/4] bg-muted relative">
        {block.cover_image_url ? (
          <img
            src={block.cover_image_url}
            alt={block.title || "PDF"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900">
            <FileTextIcon className="h-12 w-12 text-red-500" />
          </div>
        )}
        
        {/* Page count badge */}
        {block.page_count > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-0.5 rounded text-xs">
            {block.page_count} {block.page_count === 1 ? "page" : "pages"}
          </div>
        )}
      </div>
      
      {/* Title */}
      {!compact && (
        <div className="p-3">
          <h3 className="font-medium text-sm line-clamp-2">
            {block.title || "Untitled Document"}
          </h3>
        </div>
      )}
    </div>
  );
}

/**
 * ImageBlockCard - Renders image blocks
 */
function ImageBlockCard({ 
  block, 
  compact, 
  className,
  onClick
}: { 
  block: BlockData; 
  compact?: boolean; 
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card overflow-hidden",
        "hover:border-primary/50 transition-colors cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="aspect-square bg-muted relative">
        {block.imageUrl ? (
          <img
            src={block.imageUrl}
            alt={block.imageAltText || block.title || "Image"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>
      
      {!compact && block.title && (
        <div className="p-3">
          <h3 className="font-medium text-sm line-clamp-1">{block.title}</h3>
        </div>
      )}
    </div>
  );
}

/**
 * DatasetBlockCard - Placeholder for dataset blocks (future feature)
 */
function DatasetBlockCard({ 
  block, 
  compact, 
  className,
  onClick
}: { 
  block: BlockData; 
  compact?: boolean; 
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-4",
        "hover:border-primary/50 transition-colors cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
          <DatabaseIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">
            {block.title || "Dataset"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Data file
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * EmbedBlockCard - Placeholder for embed blocks (future feature)
 */
function EmbedBlockCard({ 
  block, 
  compact, 
  className,
  onClick
}: { 
  block: BlockData; 
  compact?: boolean; 
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-4",
        "hover:border-primary/50 transition-colors cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
          <CodeIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">
            {block.title || "Embed"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Embedded content
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Main BlockCard component - routes to appropriate card based on block type
 */
export function BlockCard({ block, compact, className, onClick, onOpenPdf }: BlockCardProps) {
  switch (block.blockType) {
    case "pdf":
      return (
        <PdfBlockCard 
          block={block} 
          compact={compact} 
          className={className}
          onOpenPdf={onOpenPdf}
        />
      );
      
    case "link":
      return (
        <LinkBlockCard 
          block={block} 
          compact={compact} 
          className={className}
        />
      );
      
    case "text":
      return (
        <TextBlockCard 
          block={block} 
          compact={compact} 
          className={className}
          onClick={onClick}
        />
      );
      
    case "image":
      return (
        <ImageBlockCard 
          block={block} 
          compact={compact} 
          className={className}
          onClick={onClick}
        />
      );
      
    case "video":
      return (
        <VideoBlockCard 
          block={block} 
          compact={compact} 
          className={className}
        />
      );
      
    case "dataset":
      return (
        <DatasetBlockCard 
          block={block} 
          compact={compact} 
          className={className}
          onClick={onClick}
        />
      );
      
    case "embed":
      return (
        <EmbedBlockCard 
          block={block} 
          compact={compact} 
          className={className}
          onClick={onClick}
        />
      );
      
    default:
      // Fallback for unknown types - render as generic card
      return (
        <div
          className={cn(
            "rounded-lg border bg-card p-4",
            "hover:border-primary/50 transition-colors",
            className
          )}
          onClick={onClick}
        >
          <h3 className="font-medium text-sm">
            {block.title || "Unknown Block"}
          </h3>
        </div>
      );
  }
}

export default BlockCard;
