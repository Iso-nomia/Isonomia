"use client";

/**
 * ExportPreviewModal Component
 *
 * Phase 3.2: Export Formats
 *
 * A modal that shows a preview of the export content before downloading.
 */

import * as React from "react";
import {
  Download,
  Copy,
  Check,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ExportFormatSelector, ExportFormatOptions } from "./ExportFormatSelector";
import type { ExportFormat, ExportTarget } from "@/lib/exports/types";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ExportPreviewModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback to close the modal */
  onOpenChange: (open: boolean) => void;
  /** Target type for export */
  target: ExportTarget;
  /** Target ID */
  targetId?: string;
  /** Multiple target IDs */
  targetIds?: string | string[];
  /** Title for the export */
  title?: string;
  /** Initial format selection */
  initialFormat?: ExportFormat;
  /** Callback when export completes */
  onExportComplete?: (format: ExportFormat, success: boolean) => void;
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function ExportPreviewModal({
  open,
  onOpenChange,
  target,
  targetId,
  targetIds,
  title = "Export",
  initialFormat = "bibtex",
  onExportComplete,
}: ExportPreviewModalProps) {
  const [format, setFormat] = React.useState<ExportFormat>(initialFormat);
  const [options, setOptions] = React.useState<ExportFormatOptions>({
    includeTOC: true,
    includeFrontmatter: true,
    includeDiagrams: false,
    includeCover: true,
    paperSize: "letter",
  });
  const [preview, setPreview] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Build export URL
  const getExportUrl = React.useCallback(
    (fmt: ExportFormat): string => {
      const params = new URLSearchParams();
      params.set("format", fmt);

      // Add options
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.set(key, String(value));
        }
      });

      // Handle different targets
      switch (target) {
        case "deliberation":
          return `/api/deliberations/${targetId}/export?${params}`;
        case "claim":
          if (targetIds) {
            const ids = Array.isArray(targetIds) ? targetIds.join(",") : targetIds;
            params.set("claimIds", ids);
          }
          return `/api/claims/export?${params}`;
        case "argument":
          if (targetIds) {
            const ids = Array.isArray(targetIds) ? targetIds.join(",") : targetIds;
            params.set("argumentIds", ids);
          }
          return `/api/arguments/export?${params}`;
        case "source":
          if (targetIds) {
            const ids = Array.isArray(targetIds) ? targetIds.join(",") : targetIds;
            params.set("sourceIds", ids);
          }
          return `/api/sources/export?${params}`;
        case "quote":
          if (targetIds) {
            const ids = Array.isArray(targetIds) ? targetIds.join(",") : targetIds;
            params.set("quoteIds", ids);
          }
          return `/api/quotes/export?${params}`;
        case "release":
          return `/api/deliberations/${targetId}/export?${params}`;
        default:
          throw new Error(`Unsupported export target: ${target}`);
      }
    },
    [target, targetId, targetIds, options]
  );

  // Fetch preview when format or options change
  React.useEffect(() => {
    if (!open) return;

    const fetchPreview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = getExportUrl(format);
        const response = await fetch(url);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || `Failed to fetch preview`);
        }

        const text = await response.text();
        // Limit preview to first 10000 characters for performance
        setPreview(text.length > 10000 ? text.slice(0, 10000) + "\n\n... (truncated)" : text);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate preview");
        setPreview("");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreview();
  }, [open, format, options, getExportUrl]);

  // Handle download
  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      const url = getExportUrl(format);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Download failed");
      }

      // Get filename from Content-Disposition header
      const disposition = response.headers.get("Content-Disposition");
      let filename = `export.${format === "bibtex" ? "bib" : format}`;
      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      onExportComplete?.(format, true);
      onOpenChange(false);
    } catch (err) {
      console.error("Download failed:", err);
      onExportComplete?.(format, false);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  // Get language for syntax highlighting hint
  const getLanguage = (fmt: ExportFormat): string => {
    switch (fmt) {
      case "bibtex":
        return "bibtex";
      case "json":
      case "csl-json":
        return "json";
      case "markdown":
        return "markdown";
      case "ris":
        return "text";
      case "pdf":
        return "html";
      default:
        return "text";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Preview and download your export in various academic formats.
          </DialogDescription>
        </DialogHeader>

        {/* Format Selector */}
        <div className="flex items-center justify-between py-2 border-b">
          <ExportFormatSelector
            value={format}
            onChange={setFormat}
            options={options}
            onOptionsChange={setOptions}
            showOptions
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={isLoading || !preview}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              {error}
            </div>
          ) : (
            <ScrollArea className="h-[400px] w-full rounded-md border">
              <pre
                className={cn(
                  "p-4 text-sm font-mono whitespace-pre-wrap break-words",
                  getLanguage(format) === "json" && "text-green-700",
                  getLanguage(format) === "bibtex" && "text-blue-700",
                  getLanguage(format) === "html" && "text-purple-700"
                )}
              >
                {preview || "No preview available"}
              </pre>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isLoading || isDownloading || !!error}
            className="gap-2"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExportPreviewModal;
