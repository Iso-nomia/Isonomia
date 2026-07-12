"use client";

/**
 * LinkBlockCard
 * 
 * Phase 1.2 of Stacks Improvement Roadmap
 * 
 * Displays a link block with OG metadata preview
 */

import { ExternalLinkIcon, RefreshCwIcon, AlertCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface LinkBlockCardProps {
  block: {
    id: string;
    linkUrl: string | null;
    linkTitle: string | null;
    linkDescription: string | null;
    linkImage: string | null;
    linkFavicon: string | null;
    linkSiteName: string | null;
    linkScreenshot: string | null;
    processingStatus: string;
    title: string | null;
  };
  compact?: boolean;
  className?: string;
}

export function LinkBlockCard({ block, compact, className }: LinkBlockCardProps) {
  const isProcessing = block.processingStatus === "pending" || 
                       block.processingStatus === "processing";
  const hasFailed = block.processingStatus === "failed";
  
  const displayTitle = block.linkTitle || block.title || block.linkUrl || "Link";
  const hostname = block.linkUrl ? new URL(block.linkUrl).hostname : "";

  return (
    <div 
      className={cn(
        "group relative rounded-lg border bg-card overflow-hidden",
        "hover:border-primary/50 transition-colors",
        className
      )}
    >
      {/* Preview Image */}
      <div className="aspect-video bg-muted relative">
        {block.linkImage || block.linkScreenshot ? (
          <img
            src={block.linkImage || block.linkScreenshot!}
            alt={displayTitle}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
            <ExternalLinkIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        
        {/* Processing indicator */}
        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <RefreshCwIcon className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading preview...</span>
          </div>
        )}
        
        {/* Error indicator */}
        {hasFailed && (
          <div className="absolute top-2 right-2 bg-destructive/90 text-destructive-foreground px-2 py-1 rounded text-xs flex items-center gap-1">
            <AlertCircleIcon className="h-3 w-3" />
            Failed
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          {block.linkFavicon && (
            <img 
              src={block.linkFavicon} 
              alt="" 
              className="h-4 w-4 rounded-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className="text-xs text-muted-foreground truncate">
            {block.linkSiteName || hostname}
          </span>
        </div>
        
        <h3 className="font-medium text-sm line-clamp-2 mb-1">
          {displayTitle}
        </h3>
        
        {!compact && block.linkDescription && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {block.linkDescription}
          </p>
        )}
      </div>
      
      {/* Click overlay */}
      {block.linkUrl && (
        <a
          href={block.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="sr-only">Open {displayTitle}</span>
        </a>
      )}
    </div>
  );
}
