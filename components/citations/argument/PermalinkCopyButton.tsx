"use client";

/**
 * PermalinkCopyButton Component
 *
 * Phase 3.3: Argument-Level Citations
 *
 * Button with dropdown for copying permalinks in various formats:
 * - Direct URL
 * - APA citation format
 * - MLA citation format
 * - Chicago citation format
 * - BibTeX format
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Link2,
  Copy,
  Check,
  ChevronDown,
  BookOpen,
  FileText,
  Code,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { usePermalink, useCopyPermalink } from "@/lib/citations/argumentCitationHooks";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface PermalinkCopyButtonProps {
  argumentId: string;
  variant?: "default" | "ghost" | "outline" | "icon";
  size?: "sm" | "md";
  showFormats?: boolean;
  className?: string;
}

type CopyFormat = "url" | "apa" | "mla" | "chicago" | "bibtex";

// ─────────────────────────────────────────────────────────
// Format Icons
// ─────────────────────────────────────────────────────────

const FORMAT_ICONS: Record<CopyFormat, React.ElementType> = {
  url: Link2,
  apa: BookOpen,
  mla: FileText,
  chicago: FileText,
  bibtex: Code,
};

const FORMAT_LABELS: Record<CopyFormat, string> = {
  url: "Copy URL",
  apa: "Copy APA citation",
  mla: "Copy MLA citation",
  chicago: "Copy Chicago citation",
  bibtex: "Copy BibTeX",
};

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function PermalinkCopyButton({
  argumentId,
  variant = "outline",
  size = "sm",
  showFormats = true,
  className,
}: PermalinkCopyButtonProps) {
  const [copiedFormat, setCopiedFormat] = React.useState<CopyFormat | null>(null);
  const [isLoadingFormat, setIsLoadingFormat] = React.useState(false);
  const { data: permalink, isLoading } = usePermalink(argumentId);
  const copyMutation = useCopyPermalink(argumentId);

  const handleCopy = async (format: CopyFormat) => {
    if (!permalink) return;

    let textToCopy: string;

    if (format === "url") {
      // URL is available directly from permalink
      textToCopy = permalink.fullUrl || "";
    } else {
      // Fetch the citation format on demand
      setIsLoadingFormat(true);
      try {
        const res = await fetch(`/api/arguments/${argumentId}/permalink?format=${format}`);
        if (!res.ok) throw new Error("Failed to fetch citation");
        const data = await res.json();
        textToCopy = data.data?.citation?.text || "";
        if (!textToCopy) {
          toast.error(`${format.toUpperCase()} citation not available`);
          setIsLoadingFormat(false);
          return;
        }
      } catch {
        toast.error("Failed to generate citation");
        setIsLoadingFormat(false);
        return;
      }
      setIsLoadingFormat(false);
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedFormat(format);
      toast.success(
        format === "url" ? "Link copied to clipboard" : `${format.toUpperCase()} citation copied`
      );
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Icon-only variant
  if (variant === "icon") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy("url")}
            disabled={isLoading || !permalink}
            className={cn("h-8 w-8 p-0", className)}
          >
            {copiedFormat === "url" ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Copy permalink</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Simple button without formats dropdown
  if (!showFormats) {
    return (
      <Button
        variant={variant}
        size={size === "sm" ? "sm" : "default"}
        onClick={() => handleCopy("url")}
        disabled={isLoading || !permalink}
        className={cn("gap-1.5", className)}
      >
        {copiedFormat === "url" ? (
          <>
            <Check className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Link2 className="w-4 h-4" />
            Copy link
          </>
        )}
      </Button>
    );
  }

  // Button with dropdown for formats
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isLoading || !permalink}
          title="Cite this argument"
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all cursor-pointer text-xs font-medium text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
        >
          {copiedFormat ? (
            <>
              <Check className="w-3 h-3 text-emerald-600" />
              Copied!
            </>
          ) : (
            <>
              <Link2 className="w-3 h-3" />
              Cite
            </>
          )}
          <ChevronDown className="w-3 h-3 -ml-0.5 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Copy as...</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => handleCopy("url")}>
          <Link2 className="w-4 h-4 mr-2" />
          Direct URL
          {copiedFormat === "url" && (
            <Check className="w-4 h-4 ml-auto text-green-500" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-gray-500">
          Citation Formats
        </DropdownMenuLabel>

        <DropdownMenuItem onClick={() => handleCopy("apa")}>
          <BookOpen className="w-4 h-4 mr-2" />
          APA (7th ed.)
          {copiedFormat === "apa" && (
            <Check className="w-4 h-4 ml-auto text-green-500" />
          )}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleCopy("mla")}>
          <FileText className="w-4 h-4 mr-2" />
          MLA (9th ed.)
          {copiedFormat === "mla" && (
            <Check className="w-4 h-4 ml-auto text-green-500" />
          )}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleCopy("chicago")}>
          <FileText className="w-4 h-4 mr-2" />
          Chicago (17th ed.)
          {copiedFormat === "chicago" && (
            <Check className="w-4 h-4 ml-auto text-green-500" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => handleCopy("bibtex")}>
          <Code className="w-4 h-4 mr-2" />
          BibTeX
          {copiedFormat === "bibtex" && (
            <Check className="w-4 h-4 ml-auto text-green-500" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────
// Permalink Display Component
// ─────────────────────────────────────────────────────────

export interface PermalinkDisplayProps {
  argumentId: string;
  className?: string;
}

export function PermalinkDisplay({ argumentId, className }: PermalinkDisplayProps) {
  const { data: permalink, isLoading } = usePermalink(argumentId);
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    const url = permalink?.fullUrl;
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Permalink copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    );
  }

  if (!permalink) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-gray-600 dark:text-gray-300 truncate">
          <Link2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{permalink.shortCode}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="shrink-0"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}

export default PermalinkCopyButton;
