// components/glossary/ExportGlossaryButton.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileJson, FileText, Table, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportGlossaryButtonProps {
  deliberationId: string;
  terms: any[];
}

export function ExportGlossaryButton({ deliberationId, terms }: ExportGlossaryButtonProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    setExporting("json");
    
    const exportData = {
      exportDate: new Date().toISOString(),
      deliberationId,
      totalTerms: terms.length,
      terms: terms.map(term => ({
        term: term.term,
        status: term.status,
        proposedBy: term.proposedBy?.name || "Unknown",
        proposedAt: term.createdAt,
        definitions: term.definitions.map((def: any) => ({
          definition: def.definition,
          examples: def.examples,
          sources: def.sources,
          author: def.author?.name || "Unknown",
          endorsementCount: def.endorsementCount,
          isCanonical: def.isCanonical,
          createdAt: def.createdAt,
        })),
        usageCount: term.usages?.length || 0,
      })),
    };

    const json = JSON.stringify(exportData, null, 2);
    downloadFile(json, `glossary-${deliberationId}-${Date.now()}.json`, "application/json");
    
    setSuccess(true);
    setTimeout(() => {
      setExporting(null);
      setSuccess(false);
    }, 2000);
  };

  const exportToMarkdown = () => {
    setExporting("markdown");
    
    let markdown = `# Deliberation Glossary\n\n`;
    markdown += `**Exported:** ${new Date().toLocaleString()}\n`;
    markdown += `**Total Terms:** ${terms.length}\n\n`;
    markdown += `---\n\n`;

    // Group by status
    const byStatus = {
      CONSENSUS: terms.filter(t => t.status === "CONSENSUS"),
      CONTESTED: terms.filter(t => t.status === "CONTESTED"),
      PENDING: terms.filter(t => t.status === "PENDING"),
      ARCHIVED: terms.filter(t => t.status === "ARCHIVED"),
    };

    Object.entries(byStatus).forEach(([status, statusTerms]) => {
      if (statusTerms.length === 0) return;
      
      markdown += `## ${status} Terms (${statusTerms.length})\n\n`;
      
      statusTerms.forEach((term: any) => {
        markdown += `### ${term.term}\n\n`;
        markdown += `**Status:** ${term.status}\n`;
        markdown += `**Proposed by:** ${term.proposedBy?.name || "Unknown"}\n`;
        if (term.usages?.length > 0) {
          markdown += `**Usage count:** ${term.usages.length}\n`;
        }
        markdown += `\n`;

        // Canonical definition first
        const canonical = term.definitions.find((d: any) => d.isCanonical);
        if (canonical) {
          markdown += `#### ✅ Consensus Definition\n\n`;
          markdown += `${canonical.definition}\n\n`;
          if (canonical.examples) {
            markdown += `**Examples:** ${canonical.examples}\n\n`;
          }
          markdown += `*By ${canonical.author?.name || "Unknown"} • ${canonical.endorsementCount} endorsements*\n\n`;
        }

        // Competing definitions
        const competing = term.definitions.filter((d: any) => !d.isCanonical);
        if (competing.length > 0) {
          markdown += `#### Alternative Definitions (${competing.length})\n\n`;
          competing.forEach((def: any, idx: number) => {
            markdown += `**${idx + 1}.** ${def.definition}\n\n`;
            if (def.examples) {
              markdown += `   *Examples:* ${def.examples}\n\n`;
            }
            markdown += `   *By ${def.author?.name || "Unknown"} • ${def.endorsementCount} endorsements*\n\n`;
          });
        }

        markdown += `---\n\n`;
      });
    });

    downloadFile(markdown, `glossary-${deliberationId}-${Date.now()}.md`, "text/markdown");
    
    setSuccess(true);
    setTimeout(() => {
      setExporting(null);
      setSuccess(false);
    }, 2000);
  };

  const exportToCSV = () => {
    setExporting("csv");
    
    let csv = "Term,Status,Proposed By,Definition,Examples,Author,Endorsements,Is Canonical,Usage Count\n";
    
    terms.forEach(term => {
      term.definitions.forEach((def: any) => {
        const row = [
          `"${term.term.replace(/"/g, '""')}"`,
          term.status,
          `"${(term.proposedBy?.name || "Unknown").replace(/"/g, '""')}"`,
          `"${def.definition.replace(/"/g, '""')}"`,
          `"${(def.examples || "").replace(/"/g, '""')}"`,
          `"${(def.author?.name || "Unknown").replace(/"/g, '""')}"`,
          def.endorsementCount,
          def.isCanonical ? "Yes" : "No",
          term.usages?.length || 0,
        ];
        csv += row.join(",") + "\n";
      });
    });

    downloadFile(csv, `glossary-${deliberationId}-${Date.now()}.csv`, "text/csv");
    
    setSuccess(true);
    setTimeout(() => {
      setExporting(null);
      setSuccess(false);
    }, 2000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "btnv2 rounded-xl px-3 py-2 text-xs text-white flex items-center gap-2",
            success && "bg-emerald-500/30 border-emerald-400/50"
          )}
          disabled={exporting !== null}
        >
          {exporting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Exporting...
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Exported!
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              Export
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-slate-800/95 backdrop-blur-xl border-white/20 text-white">
        <DropdownMenuLabel className="text-slate-300">Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        
        <DropdownMenuItem
          onClick={exportToJSON}
          disabled={exporting !== null}
          className="flex items-center gap-2 cursor-pointer focus:bg-white/10 focus:text-white"
        >
          <FileJson className="w-4 h-4 text-cyan-400" />
          <div className="flex-1">
            <div className="font-medium">JSON</div>
            <div className="text-xs text-slate-400">Full data with metadata</div>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={exportToMarkdown}
          disabled={exporting !== null}
          className="flex items-center gap-2 cursor-pointer focus:bg-white/10 focus:text-white"
        >
          <FileText className="w-4 h-4 text-indigo-400" />
          <div className="flex-1">
            <div className="font-medium">Markdown</div>
            <div className="text-xs text-slate-400">Human-readable document</div>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={exportToCSV}
          disabled={exporting !== null}
          className="flex items-center gap-2 cursor-pointer focus:bg-white/10 focus:text-white"
        >
          <Table className="w-4 h-4 text-emerald-400" />
          <div className="flex-1">
            <div className="font-medium">CSV</div>
            <div className="text-xs text-slate-400">Spreadsheet compatible</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
