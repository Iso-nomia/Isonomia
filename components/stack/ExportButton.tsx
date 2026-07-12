"use client";

/**
 * ExportButton
 * 
 * Phase 1.6 of Stacks Improvement Roadmap
 * 
 * Dropdown button for exporting stacks in various formats.
 */

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { 
  DownloadIcon, 
  FileTextIcon, 
  BookOpenIcon,
  FileJsonIcon,
  Loader2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportButtonProps {
  stackId: string;
  stackName: string;
  className?: string;
}

type ExportFormat = "json" | "md" | "bibtex";

const exportFormats: {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  extension: string;
}[] = [
  {
    format: "json",
    label: "JSON",
    description: "Full data export for automation",
    icon: FileJsonIcon,
    extension: ".json",
  },
  {
    format: "md",
    label: "Markdown",
    description: "Readable document format",
    icon: FileTextIcon,
    extension: ".md",
  },
  {
    format: "bibtex",
    label: "BibTeX",
    description: "Academic citation format",
    icon: BookOpenIcon,
    extension: ".bib",
  },
];

export function ExportButton({ stackId, stackName, className }: ExportButtonProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    setError(null);

    try {
      const res = await fetch(`/api/stacks/${stackId}/export?format=${format}`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }

      // Get filename from Content-Disposition header or generate one
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const formatConfig = exportFormats.find((f) => f.format === format);
      const filename = filenameMatch?.[1] || `${stackName}${formatConfig?.extension || ".txt"}`;

      // Download the file
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export failed:", err);
      setError(err.message || "Export failed");
      // Show error briefly then clear
      setTimeout(() => setError(null), 3000);
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 text-sm bg-white/70 sendbutton rounded-md text-slate-900",
            className
          )}
          disabled={exporting !== null}
        >
          {exporting ? (
            <Loader2Icon className="h-4 w-4 animate-spin" />
          ) : (
            <DownloadIcon className="h-4 w-4" />
          )}
          Export
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-52 bg-white">
        {exportFormats.map((formatConfig) => {
          const Icon = formatConfig.icon;
          const isExporting = exporting === formatConfig.format;
          
          return (
            <DropdownMenuItem
              key={formatConfig.format}
              onClick={() => handleExport(formatConfig.format)}
              disabled={exporting !== null}
              className="flex items-start gap-3 py-2"
            >
              <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2">
                  {formatConfig.label}
                  {isExporting && (
                    <Loader2Icon className="h-3 w-3 animate-spin" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatConfig.description}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
        
        {error && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs text-red-600">
              {error}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportButton;
