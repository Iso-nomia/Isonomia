/**
 * ChainProseView Component
 * Renders an argument chain as a legal brief-style prose document
 * 
 * Features:
 * - Structured sections (Introduction, Analysis, Flow, Conclusion)
 * - Scheme-based argument elaboration
 * - Edge relationship narrative
 * - Export options (copy, download)
 */

"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import {
  FileText,
  Copy,
  Download,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Settings2,
  BookOpen,
  Scale,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateProse, ProseOptions, ProseResult } from "@/lib/chains/proseGenerator";
import { ArgumentChainWithRelations } from "@/lib/types/argumentChain";
import ChainRefusalBanner from "./ChainRefusalBanner";

// ===== Types =====

interface ChainProseViewProps {
  /** Chain ID to load */
  chainId: string;
  
  /** Pre-loaded chain data (skips fetch) */
  initialData?: ArgumentChainWithRelations;
  
  /** Compact mode for embedding */
  compact?: boolean;
  
  /** Maximum height before scrolling */
  maxHeight?: string;
  
  /** Callback to switch views */
  onViewThread?: () => void;
  onViewCanvas?: () => void;
}

type ProseStyle = "legal_brief" | "academic" | "summary";

// ===== Fetcher =====

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then(async (r) => {
    const json = await r.json().catch(() => ({}));
    if (!r.ok || json?.ok === false) {
      throw new Error(json?.error || `HTTP ${r.status}`);
    }
    return json.chain || json;
  });

// ===== Style Configuration =====

const STYLE_CONFIG: Record<ProseStyle, { icon: React.ReactNode; label: string; description: string }> = {
  legal_brief: {
    icon: <Scale className="w-4 h-4" />,
    label: "Legal Brief",
    description: "Formal legal briefing style"
  },
  academic: {
    icon: <GraduationCap className="w-4 h-4" />,
    label: "Academic",
    description: "Scholarly analysis style"
  },
  summary: {
    icon: <BookOpen className="w-4 h-4" />,
    label: "Summary",
    description: "Concise overview"
  }
};

// ===== Main Component =====

export function ChainProseView({
  chainId,
  initialData,
  compact = false,
  maxHeight = "calc(100vh - 200px)",
  onViewThread,
  onViewCanvas,
}: ChainProseViewProps) {
  const [copied, setCopied] = useState(false);
  const [style, setStyle] = useState<ProseStyle>("legal_brief");
  const [includeCQs, setIncludeCQs] = useState(false);
  const [includeNumbering, setIncludeNumbering] = useState(true);

  // Fetch chain data if not provided
  const {
    data: fetchedChain,
    error,
    isLoading,
    mutate,
  } = useSWR<ArgumentChainWithRelations>(
    !initialData ? `/api/argument-chains/${chainId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const chainData = initialData || fetchedChain;

  // Generate prose when data or options change
  const proseResult = useMemo<ProseResult | null>(() => {
    if (!chainData) return null;
    
    const options: ProseOptions = {
      style,
      includeSections: true,
      includeNumbering,
      includeCriticalQuestions: includeCQs,
      includeMetadata: true,
    };
    
    return generateProse(chainData, options);
  }, [chainData, style, includeNumbering, includeCQs]);

  // Copy to clipboard
  const handleCopy = async () => {
    if (!proseResult) return;
    
    try {
      await navigator.clipboard.writeText(proseResult.fullText);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  // Download as text file
  const handleDownload = () => {
    if (!proseResult) return;
    
    const blob = new Blob([proseResult.fullText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${proseResult.title.replace(/\s+/g, "_")}_brief.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Downloaded");
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">Loading chain...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-slate-600">Failed to load chain</p>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Empty state
  if (!chainData || !proseResult) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <FileText className="w-12 h-12 text-slate-300" />
        <p className="text-sm text-slate-500">No chain data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* T1.4 — surface deliberation refusalSurface for blocked conclusions */}
      {chainData.deliberation?.id && (
        <div className={cn(compact ? "mb-2" : "mb-3")}>
          <ChainRefusalBanner
            deliberationId={chainData.deliberation.id}
            chainConclusionClaimIds={chainData.nodes
              .map((n: any) => n.argument?.conclusion?.id)
              .filter((x: any): x is string => Boolean(x))}
            compact={compact}
          />
        </div>
      )}
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between gap-4 pb-4 border-b border-slate-200",
        compact ? "pb-2" : "pb-4"
      )}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <FileText className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h2 className={cn(
              "font-semibold text-slate-900",
              compact ? "text-base" : "text-lg"
            )}>
              {proseResult.title}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                {STYLE_CONFIG[style].icon}
                <span className="ml-1">{STYLE_CONFIG[style].label}</span>
              </Badge>
              <span className="text-xs text-slate-500">
                {proseResult.metadata.argumentCount} arguments
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Style Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Settings2 className="w-4 h-4 mr-1" />
                Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Document Style</DropdownMenuLabel>
              {(Object.keys(STYLE_CONFIG) as ProseStyle[]).map((s) => (
                <DropdownMenuItem
                  key={s}
                  onClick={() => setStyle(s)}
                  className={cn(style === s && "bg-slate-100")}
                >
                  {STYLE_CONFIG[s].icon}
                  <span className="ml-2">{STYLE_CONFIG[s].label}</span>
                  {style === s && <Check className="w-4 h-4 ml-auto" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Options</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={includeNumbering}
                onCheckedChange={setIncludeNumbering}
              >
                Number arguments
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={includeCQs}
                onCheckedChange={setIncludeCQs}
              >
                Include critical questions
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Copy */}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>

          {/* Download */}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Prose Content */}
      <div
        className={cn(
          "flex-1 overflow-y-auto mt-4 prose prose-slate prose-sm max-w-none",
          compact ? "text-sm" : "text-base"
        )}
        style={{ maxHeight }}
      >
        {proseResult.sections.map((section) => (
          <ProseSection key={section.id} section={section} />
        ))}
        
        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-400 text-center">
            Generated {new Date(proseResult.metadata.generatedAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== Prose Section Component =====

interface ProseSectionProps {
  section: {
    id: string;
    heading: string;
    content: string;
    type: "introduction" | "argument" | "transition" | "analysis" | "conclusion";
  };
}

function ProseSection({ section }: ProseSectionProps) {
  const typeStyles: Record<string, string> = {
    introduction: "border-l-4 border-l-blue-400 pl-4",
    argument: "",
    transition: "border-l-4 border-l-purple-400 pl-4 bg-purple-50/50 -mx-4 px-4 py-2 rounded-r",
    analysis: "border-l-4 border-l-amber-400 pl-4",
    conclusion: "border-l-4 border-l-green-400 pl-4 bg-green-50/50 -mx-4 px-4 py-2 rounded-r",
  };

  return (
    <div className={cn("mb-6", typeStyles[section.type] || "")}>
      <h3 className="text-base font-semibold text-slate-800 mb-3">
        {section.heading}
      </h3>
      <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
        {section.content.split("\n\n").map((paragraph, i) => {
          // Handle horizontal rules
          if (paragraph.trim() === "---") {
            return <hr key={i} className="my-4 border-slate-200" />;
          }
          
          // Handle bullet lists
          if (paragraph.includes("• ")) {
            const items = paragraph.split("\n").filter(l => l.startsWith("• "));
            return (
              <ul key={i} className="list-disc list-inside my-2 space-y-1">
                {items.map((item, j) => (
                  <li key={j} className="text-slate-600">
                    {item.replace("• ", "")}
                  </li>
                ))}
              </ul>
            );
          }
          
          // Regular paragraphs
          return (
            <p key={i} className="mb-3">
              {paragraph}
            </p>
          );
        })}
      </div>
    </div>
  );
}

export default ChainProseView;
