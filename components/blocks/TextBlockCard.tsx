"use client";

/**
 * TextBlockCard
 * 
 * Phase 1.2 of Stacks Improvement Roadmap
 * 
 * Displays a text/note block with markdown rendering
 */

import { FileTextIcon, PenToolIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface TextBlockCardProps {
  block: {
    id: string;
    textContent: string | null;
    textFormat: string | null;
    title: string | null;
  };
  compact?: boolean;
  className?: string;
  onClick?: () => void;
}

export function TextBlockCard({ block, compact, className, onClick }: TextBlockCardProps) {
  const content = block.textContent || "";
  const isMarkdown = block.textFormat === "markdown";
  const hasTitle = !!block.title;
  
  // For compact mode or empty content, show minimal preview
  if (compact || !content) {
    return (
      <div
        className={cn(
          "group relative rounded-lg border bg-card p-4",
          "hover:border-primary/50 transition-colors cursor-pointer",
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileTextIcon className="h-4 w-4" />
          <span className="text-sm font-medium">
            {block.title || "Untitled Note"}
          </span>
        </div>
        {content && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {content.slice(0, 100)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card overflow-hidden",
        "hover:border-primary/50 transition-colors",
        className
      )}
      onClick={onClick}
    >
      {/* Header */}
      {hasTitle && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <PenToolIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{block.title}</span>
        </div>
      )}
      
      {/* Content */}
      <div className="p-4">
        {isMarkdown ? (
          <div className="prose prose-sm prose-stone dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                // Override heading sizes for card context
                h1: ({ children }) => (
                  <h3 className="text-base font-semibold mt-0 mb-2">{children}</h3>
                ),
                h2: ({ children }) => (
                  <h4 className="text-sm font-semibold mt-0 mb-2">{children}</h4>
                ),
                h3: ({ children }) => (
                  <h5 className="text-sm font-medium mt-0 mb-1">{children}</h5>
                ),
                // Limit paragraph overflow
                p: ({ children }) => (
                  <p className="text-sm text-foreground/80 mb-2 last:mb-0">{children}</p>
                ),
                // Style code blocks
                code: ({ children, className }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code className="px-1 py-0.5 bg-muted rounded text-xs">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={cn("block p-2 bg-muted rounded text-xs overflow-x-auto", className)}>
                      {children}
                    </code>
                  );
                },
                // Style lists
                ul: ({ children }) => (
                  <ul className="list-disc list-inside text-sm space-y-1 mb-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside text-sm space-y-1 mb-2">{children}</ol>
                ),
                // Style links
                a: ({ href, children }) => (
                  <a 
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {children}
                  </a>
                ),
                // Style blockquotes
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-primary/30 pl-3 italic text-sm text-muted-foreground my-2">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">
            {content}
          </p>
        )}
      </div>
      
      {/* Format indicator */}
      <div className="absolute bottom-2 right-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          {isMarkdown ? "MD" : "TXT"}
        </span>
      </div>
    </div>
  );
}
