"use client";

/**
 * ExportFormatSelector Component
 *
 * Phase 3.2: Export Formats
 *
 * A selector component for choosing export formats with options.
 */

import * as React from "react";
import {
  FileCode,
  FileText,
  FileJson,
  Check,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ExportFormat } from "@/lib/exports/types";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface ExportFormatOptions {
  includeTOC?: boolean;
  includeFrontmatter?: boolean;
  includeDiagrams?: boolean;
  includeCover?: boolean;
  paperSize?: "letter" | "a4";
  includeVersions?: boolean;
  includeSources?: boolean;
}

export interface ExportFormatSelectorProps {
  /** Currently selected format */
  value: ExportFormat;
  /** Callback when format changes */
  onChange: (format: ExportFormat) => void;
  /** Current options */
  options?: ExportFormatOptions;
  /** Callback when options change */
  onOptionsChange?: (options: ExportFormatOptions) => void;
  /** Available formats (defaults to all) */
  availableFormats?: ExportFormat[];
  /** Show options popover */
  showOptions?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

// ─────────────────────────────────────────────────────────
// Format Info
// ─────────────────────────────────────────────────────────

interface FormatInfo {
  label: string;
  description: string;
  icon: React.ReactNode;
  hasOptions: boolean;
}

const FORMAT_INFO: Record<ExportFormat, FormatInfo> = {
  bibtex: {
    label: "BibTeX",
    description: "LaTeX bibliography format",
    icon: <FileCode className="h-4 w-4" />,
    hasOptions: false,
  },
  ris: {
    label: "RIS",
    description: "Reference manager format",
    icon: <FileText className="h-4 w-4" />,
    hasOptions: false,
  },
  markdown: {
    label: "Markdown",
    description: "Documentation format",
    icon: <FileText className="h-4 w-4" />,
    hasOptions: true,
  },
  pdf: {
    label: "PDF Report",
    description: "Formatted document",
    icon: <FileText className="h-4 w-4" />,
    hasOptions: true,
  },
  json: {
    label: "JSON",
    description: "Structured data",
    icon: <FileJson className="h-4 w-4" />,
    hasOptions: true,
  },
  "csl-json": {
    label: "CSL-JSON",
    description: "Citation Style Language",
    icon: <FileJson className="h-4 w-4" />,
    hasOptions: false,
  },
};

const DEFAULT_FORMATS: ExportFormat[] = [
  "bibtex",
  "ris",
  "markdown",
  "pdf",
  "json",
];

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function ExportFormatSelector({
  value,
  onChange,
  options = {},
  onOptionsChange,
  availableFormats = DEFAULT_FORMATS,
  showOptions = true,
  disabled = false,
  className,
}: ExportFormatSelectorProps) {
  const selectedFormat = FORMAT_INFO[value];
  const hasOptions = selectedFormat?.hasOptions && showOptions;

  const handleOptionChange = (key: keyof ExportFormatOptions, val: boolean | string) => {
    onOptionsChange?.({ ...options, [key]: val });
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Format Selector */}
      <Select
        value={value}
        onValueChange={(v) => onChange(v as ExportFormat)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select format">
            <div className="flex items-center gap-2">
              {selectedFormat?.icon}
              <span>{selectedFormat?.label}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Citation Formats</SelectLabel>
            {availableFormats
              .filter((f) => ["bibtex", "ris", "csl-json"].includes(f))
              .map((format) => (
                <SelectItem key={format} value={format}>
                  <div className="flex items-center gap-2">
                    {FORMAT_INFO[format].icon}
                    <div className="flex flex-col">
                      <span>{FORMAT_INFO[format].label}</span>
                      <span className="text-xs text-muted-foreground">
                        {FORMAT_INFO[format].description}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Document Formats</SelectLabel>
            {availableFormats
              .filter((f) => ["markdown", "pdf"].includes(f))
              .map((format) => (
                <SelectItem key={format} value={format}>
                  <div className="flex items-center gap-2">
                    {FORMAT_INFO[format].icon}
                    <div className="flex flex-col">
                      <span>{FORMAT_INFO[format].label}</span>
                      <span className="text-xs text-muted-foreground">
                        {FORMAT_INFO[format].description}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Data Formats</SelectLabel>
            {availableFormats
              .filter((f) => ["json"].includes(f))
              .map((format) => (
                <SelectItem key={format} value={format}>
                  <div className="flex items-center gap-2">
                    {FORMAT_INFO[format].icon}
                    <div className="flex flex-col">
                      <span>{FORMAT_INFO[format].label}</span>
                      <span className="text-xs text-muted-foreground">
                        {FORMAT_INFO[format].description}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Options Dropdown */}
      {hasOptions && onOptionsChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={disabled}
            >
              <Settings2 className="h-4 w-4" />
              <span className="sr-only">Export options</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 p-3" align="end">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Export Options</h4>

              {/* Markdown options */}
              {value === "markdown" && (
                <>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Include TOC</span>
                    <input
                      type="checkbox"
                      checked={options.includeTOC ?? true}
                      onChange={(e) =>
                        handleOptionChange("includeTOC", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">YAML Frontmatter</span>
                    <input
                      type="checkbox"
                      checked={options.includeFrontmatter ?? true}
                      onChange={(e) =>
                        handleOptionChange("includeFrontmatter", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Mermaid Diagrams</span>
                    <input
                      type="checkbox"
                      checked={options.includeDiagrams ?? false}
                      onChange={(e) =>
                        handleOptionChange("includeDiagrams", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </label>
                </>
              )}

              {/* PDF options */}
              {value === "pdf" && (
                <>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Cover Page</span>
                    <input
                      type="checkbox"
                      checked={options.includeCover ?? true}
                      onChange={(e) =>
                        handleOptionChange("includeCover", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Paper Size</span>
                    <Select
                      value={options.paperSize ?? "letter"}
                      onValueChange={(v) =>
                        handleOptionChange("paperSize", v)
                      }
                    >
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="letter">Letter</SelectItem>
                        <SelectItem value="a4">A4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* JSON options */}
              {value === "json" && (
                <>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Include Versions</span>
                    <input
                      type="checkbox"
                      checked={options.includeVersions ?? true}
                      onChange={(e) =>
                        handleOptionChange("includeVersions", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm">Include Sources</span>
                    <input
                      type="checkbox"
                      checked={options.includeSources ?? true}
                      onChange={(e) =>
                        handleOptionChange("includeSources", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </label>
                </>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export default ExportFormatSelector;
