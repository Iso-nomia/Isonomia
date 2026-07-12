"use client";

/**
 * VideoBlockCard
 * 
 * Phase 1.2 of Stacks Improvement Roadmap
 * 
 * Displays a video block with embedded player or thumbnail preview
 */

import { PlayCircleIcon, RefreshCwIcon, AlertCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface VideoBlockCardProps {
  block: {
    id: string;
    videoUrl: string | null;
    videoProvider: string | null;
    videoEmbedCode: string | null;
    videoThumbnail: string | null;
    videoDuration: number | null;
    processingStatus: string;
    title: string | null;
  };
  compact?: boolean;
  autoplay?: boolean;
  className?: string;
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getEmbedUrl(videoUrl: string, provider: string | null): string | null {
  if (!videoUrl) return null;
  
  try {
    const url = new URL(videoUrl);
    
    // YouTube
    if (provider === "youtube" || url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
      let videoId: string | null = null;
      
      if (url.hostname.includes("youtu.be")) {
        videoId = url.pathname.slice(1);
      } else {
        videoId = url.searchParams.get("v");
      }
      
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    
    // Vimeo
    if (provider === "vimeo" || url.hostname.includes("vimeo.com")) {
      const match = url.pathname.match(/\/(\d+)/);
      if (match) {
        return `https://player.vimeo.com/video/${match[1]}`;
      }
    }
    
    // Loom
    if (provider === "loom" || url.hostname.includes("loom.com")) {
      const match = url.pathname.match(/\/share\/([a-z0-9]+)/i);
      if (match) {
        return `https://www.loom.com/embed/${match[1]}`;
      }
    }
    
    // Wistia
    if (provider === "wistia" || url.hostname.includes("wistia.com")) {
      const match = url.pathname.match(/\/medias\/([a-z0-9]+)/i);
      if (match) {
        return `https://fast.wistia.net/embed/iframe/${match[1]}`;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

export function VideoBlockCard({ block, compact, autoplay = false, className }: VideoBlockCardProps) {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  
  const isProcessing = block.processingStatus === "pending" || 
                       block.processingStatus === "processing";
  const hasFailed = block.processingStatus === "failed";
  
  const displayTitle = block.title || "Video";
  const embedUrl = block.videoUrl ? getEmbedUrl(block.videoUrl, block.videoProvider) : null;
  
  // Use embed code if available, otherwise generate from URL
  const canEmbed = !!block.videoEmbedCode || !!embedUrl;

  return (
    <div 
      className={cn(
        "group relative rounded-lg border bg-card overflow-hidden",
        "hover:border-primary/50 transition-colors",
        className
      )}
    >
      {/* Video Container */}
      <div className="aspect-video bg-black relative">
        {isPlaying && canEmbed ? (
          // Embedded player
          block.videoEmbedCode ? (
            <div 
              className="w-full h-full"
              dangerouslySetInnerHTML={{ __html: block.videoEmbedCode }}
            />
          ) : embedUrl ? (
            <iframe
              src={`${embedUrl}?autoplay=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : null
        ) : (
          // Thumbnail with play button
          <>
            {block.videoThumbnail ? (
              <img
                src={block.videoThumbnail}
                alt={displayTitle}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-black to-gray-900">
                <PlayCircleIcon className="h-12 w-12 text-white/50" />
              </div>
            )}
            
            {/* Play button overlay */}
            {canEmbed && !isProcessing && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPlaying(true);
                }}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group/play"
              >
                <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center group-hover/play:scale-110 transition-transform">
                  <PlayCircleIcon className="h-10 w-10 text-black ml-1" />
                </div>
              </button>
            )}
            
            {/* Duration badge */}
            {block.videoDuration && (
              <div className="absolute bottom-2 right-2 bg-black/80 text-white px-1.5 py-0.5 rounded text-xs font-medium">
                {formatDuration(block.videoDuration)}
              </div>
            )}
          </>
        )}
        
        {/* Processing indicator */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <RefreshCwIcon className="h-6 w-6 animate-spin text-white" />
            <span className="ml-2 text-sm text-white">Processing video...</span>
          </div>
        )}
        
        {/* Error indicator */}
        {hasFailed && (
          <div className="absolute top-2 right-2 bg-destructive/90 text-destructive-foreground px-2 py-1 rounded text-xs flex items-center gap-1">
            <AlertCircleIcon className="h-3 w-3" />
            Failed
          </div>
        )}
        
        {/* Provider badge */}
        {block.videoProvider && (
          <div className="absolute top-2 left-2 bg-black/60 text-white px-2 py-0.5 rounded text-xs capitalize">
            {block.videoProvider}
          </div>
        )}
      </div>
      
      {/* Title */}
      {!compact && (
        <div className="p-3">
          <h3 className="font-medium text-sm line-clamp-1">
            {displayTitle}
          </h3>
        </div>
      )}
    </div>
  );
}
