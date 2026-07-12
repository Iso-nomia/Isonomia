"use client";

/**
 * ExportButton Component
 *
 * Phase 3.2: Export Formats
 *
 * A dropdown button for exporting content in various academic formats.
 * Supports BibTeX, RIS, Markdown, PDF, and JSON exports.
 */

import * as React from "react";
import { Download, FileText, FileCode, FileJson, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ExportFormat, ExportTarget } from "@/lib/exports/types";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ExportButtonProps {
  /** Target type for export */
  target: ExportTarget;
  /** Target ID (deliberation ID, claim IDs, etc.) */
  targetId?: string;
  /** Multiple target IDs (comma-separated or array) */
  targetIds?: string | string[];
  /** Button variant */
  variant?: "default" | "ghost" | "outline" | "btnv2";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Additional class names */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Callback when export starts */
  onExportStart?: (format: ExportFormat) => void;
  /** Callback when export completes */
  onExportComplete?: (format: ExportFormat, success: boolean) => void;
  /** Custom label */
  label?: string;
  /** Show icon only */
  iconOnly?: boolean;
  /** Export options for formats */
  exportOptions?: {
    includeTOC?: boolean;
    includeFrontmatter?: boolean;
    includeDiagrams?: boolean;
    includeCover?: boolean;
    paperSize?: "letter" | "a4";
  };
}

// ─────────────────────────────────────────────────────────
// Format Configurations
// ─────────────────────────────────────────────────────────

interface FormatConfig {
  label: string;
  description: string;
  icon: React.ReactNode;
  mimeType: string;
  extension: string;
  category: "citation" | "document" | "data";
}

const FORMAT_CONFIGS: Record<ExportFormat, FormatConfig> = {
  bibtex: {
    label: "BibTeX",
    description: "For LaTeX & academic papers",
    icon: <FileCode className="h-4 w-4" />,
    mimeType: "application/x-bibtex",
    extension: ".bib",
    category: "citation",
  },
  ris: {
    label: "RIS",
    description: "For Zotero, Mendeley, EndNote",
    icon: <FileText className="h-4 w-4" />,
    mimeType: "application/x-research-info-systems",
    extension: ".ris",
    category: "citation",
  },
  markdown: {
    label: "Markdown",
    description: "For docs, notes, Obsidian",
    icon: <FileText className="h-4 w-4" />,
    mimeType: "text/markdown",
    extension: ".md",
    category: "document",
  },
  pdf: {
    label: "PDF Report",
    description: "Formatted document",
    icon: <FileText className="h-4 w-4" />,
    mimeType: "text/html",
    extension: ".html",
    category: "document",
  },
  json: {
    label: "JSON",
    description: "Raw structured data",
    icon: <FileJson className="h-4 w-4" />,
    mimeType: "application/json",
    extension: ".json",
    category: "data",
  },
  "csl-json": {
    label: "CSL-JSON",
    description: "Citation Style Language",
    icon: <FileJson className="h-4 w-4" />,
    mimeType: "application/vnd.citationstyles.csl+json",
    extension: ".json",
    category: "citation",
  },
};

// ─────────────────────────────────────────────────────────
// Export Button Component
// ─────────────────────────────────────────────────────────

export function ExportButton({
  target,
  targetId,
  targetIds,
  variant = "ghost",
  size = "default",
  className,
  disabled = false,
  onExportStart,
  onExportComplete,
  label = "Export",
  iconOnly = false,
  exportOptions = {},
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportingFormat, setExportingFormat] = React.useState<ExportFormat | null>(null);

  // Build export URL based on target
  const getExportUrl = React.useCallback(
    (format: ExportFormat): string => {
      const params = new URLSearchParams();
      params.set("format", format);

      // Add format-specific options
      if (exportOptions.includeTOC !== undefined) {
        params.set("includeTOC", String(exportOptions.includeTOC));
      }
      if (exportOptions.includeFrontmatter !== undefined) {
        params.set("includeFrontmatter", String(exportOptions.includeFrontmatter));
      }
      if (exportOptions.includeDiagrams !== undefined) {
        params.set("includeDiagrams", String(exportOptions.includeDiagrams));
      }
      if (exportOptions.includeCover !== undefined) {
        params.set("includeCover", String(exportOptions.includeCover));
      }
      if (exportOptions.paperSize) {
        params.set("paperSize", exportOptions.paperSize);
      }

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
          // For releases, use deliberation export with version
          return `/api/deliberations/${targetId}/export?${params}`;
        default:
          throw new Error(`Unsupported export target: ${target}`);
      }
    },
    [target, targetId, targetIds, exportOptions]
  );

  // Handle export
  const handleExport = React.useCallback(
    async (format: ExportFormat) => {
      if (isExporting) return;

      setIsExporting(true);
      setExportingFormat(format);
      onExportStart?.(format);

      try {
        const url = getExportUrl(format);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Export failed: ${response.statusText}`);
        }

        // Get filename from Content-Disposition header
        const disposition = response.headers.get("Content-Disposition");
        let filename = `export${FORMAT_CONFIGS[format].extension}`;
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
      } catch (error) {
        console.error("Export failed:", error);
        onExportComplete?.(format, false);
      } finally {
        setIsExporting(false);
        setExportingFormat(null);
      }
    },
    [isExporting, getExportUrl, onExportStart, onExportComplete]
  );

  // Get available formats for this target
  const getAvailableFormats = (): ExportFormat[] => {
    // All targets support these base formats
    const baseFormats: ExportFormat[] = ["bibtex", "ris", "json"];

    // Add document formats for certain targets
    if (target === "deliberation" || target === "release") {
      return [...baseFormats, "markdown", "pdf"];
    }

    if (target === "claim" || target === "argument") {
      return [...baseFormats, "markdown", "pdf"];
    }

    return baseFormats;
  };

  const availableFormats = getAvailableFormats();
  const citationFormats = availableFormats.filter(
    (f) => FORMAT_CONFIGS[f].category === "citation"
  );
  const documentFormats = availableFormats.filter(
    (f) => FORMAT_CONFIGS[f].category === "document"
  );
  const dataFormats = availableFormats.filter(
    (f) => FORMAT_CONFIGS[f].category === "data"
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn("gap-2", className)}
          disabled={disabled || isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {!iconOnly && (
            <span>{isExporting ? "Exporting..." : label}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Citation Formats */}
        {citationFormats.length > 0 && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1">
                Citation Formats
              </DropdownMenuLabel>
              {citationFormats.map((format) => (
                <DropdownMenuItem
                  key={format}
                  onClick={() => handleExport(format)}
                  disabled={exportingFormat === format}
                  className="cursor-pointer"
                >
                  <span className="mr-2">{FORMAT_CONFIGS[format].icon}</span>
                  <div className="flex flex-col">
                    <span>{FORMAT_CONFIGS[format].label}</span>
                    <span className="text-xs text-muted-foreground">
                      {FORMAT_CONFIGS[format].description}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Document Formats */}
        {documentFormats.length > 0 && (
          <>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1">
                Document Formats
              </DropdownMenuLabel>
              {documentFormats.map((format) => (
                <DropdownMenuItem
                  key={format}
                  onClick={() => handleExport(format)}
                  disabled={exportingFormat === format}
                  className="cursor-pointer"
                >
                  <span className="mr-2">{FORMAT_CONFIGS[format].icon}</span>
                  <div className="flex flex-col">
                    <span>{FORMAT_CONFIGS[format].label}</span>
                    <span className="text-xs text-muted-foreground">
                      {FORMAT_CONFIGS[format].description}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Data Formats */}
        {dataFormats.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1">
              Data Formats
            </DropdownMenuLabel>
            {dataFormats.map((format) => (
              <DropdownMenuItem
                key={format}
                onClick={() => handleExport(format)}
                disabled={exportingFormat === format}
                className="cursor-pointer"
              >
                <span className="mr-2">{FORMAT_CONFIGS[format].icon}</span>
                <div className="flex flex-col">
                  <span>{FORMAT_CONFIGS[format].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {FORMAT_CONFIGS[format].description}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportButton;
