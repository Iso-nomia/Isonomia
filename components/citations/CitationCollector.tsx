"use client";

import * as React from "react";
import LibrarySearchModal from "@/components/citations/LibrarySearchModal";
import ResolvedCitationChip from "@/components/citations/ResolvedCitationChip";
import { Badge } from "@/components/ui/badge";
import { FileText, Link as LinkIcon, BookOpen } from "lucide-react";

/** Simplified citation data for collection before target exists */
export type PendingCitation = {
  type: "url" | "doi" | "library";
  value: string;
  locator?: string;
  quote?: string;
  note?: string;
  title?: string; // for display
  quality?: "strong" | "moderate" | "weak"; // estimated quality
};

type Props = {
  citations: PendingCitation[];
  onChange: (citations: PendingCitation[]) => void;
  className?: string;
  showQualityHints?: boolean; // Show quality guidance for citations
};

// Helper to get citation icon
function getCitationIcon(type: "url" | "doi" | "library") {
  switch (type) {
    case "url":
      return <LinkIcon className="h-3 w-3" />;
    case "doi":
      return <FileText className="h-3 w-3" />;
    case "library":
      return <BookOpen className="h-3 w-3" />;
  }
}

// Helper to estimate citation quality (basic heuristic)
function estimateCitationQuality(citation: PendingCitation): "strong" | "moderate" | "weak" {
  // DOIs and library items tend to be more reliable
  if (citation.type === "doi") return "strong";
  if (citation.type === "library") return "strong";
  
  // URLs: check domain quality (basic heuristic)
  if (citation.type === "url") {
    const url = citation.value.toLowerCase();
    // Academic/institutional domains
    if (url.includes(".edu") || url.includes(".gov") || url.includes("scholar.google") || 
        url.includes("arxiv.org") || url.includes(".ac.")) {
      return "strong";
    }
    // News/established media
    if (url.includes("wikipedia.org") || url.includes("britannica.com")) {
      return "moderate";
    }
    // General web
    return "moderate";
  }
  
  return "moderate";
}

// Helper to get quality badge color
function getQualityBadgeClass(quality: "strong" | "moderate" | "weak"): string {
  switch (quality) {
    case "strong":
      return "bg-green-100 text-green-800 border-green-200";
    case "moderate":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "weak":
      return "bg-orange-100 text-orange-800 border-orange-200";
  }
}

/**
 * CitationCollector - Collects citation metadata before the target entity exists
 * This allows users to add evidence during composition, which gets attached after creation
 */
export default function CitationCollector({ 
  citations, 
  onChange, 
  className,
  showQualityHints = true 
}: Props) {
  const [tab, setTab] = React.useState<"url" | "doi" | "library">("url");
  const [showForm, setShowForm] = React.useState(false);

  // Form state
  const [url, setUrl] = React.useState("");
  const [doi, setDoi] = React.useState("");
  const [libraryId, setLibraryId] = React.useState("");
  const [libraryTitle, setLibraryTitle] = React.useState("");
  const [locator, setLocator] = React.useState("");
  const [quote, setQuote] = React.useState("");
  const [note, setNote] = React.useState("");
  const [libOpen, setLibOpen] = React.useState(false);

  function resetForm() {
    setUrl("");
    setDoi("");
    setLibraryId("");
    setLibraryTitle("");
    setLocator("");
    setQuote("");
    setNote("");
  }

  function addCitation() {
    let newCitation: PendingCitation | null = null;

    if (tab === "url" && url.trim()) {
      newCitation = {
        type: "url",
        value: url.trim(),
        locator: locator || undefined,
        quote: quote || undefined,
        note: note || undefined,
        title: url.trim(),
      };
    } else if (tab === "doi" && doi.trim()) {
      newCitation = {
        type: "doi",
        value: doi.trim(),
        locator: locator || undefined,
        quote: quote || undefined,
        note: note || undefined,
        title: `DOI: ${doi.trim()}`,
      };
    } else if (tab === "library" && libraryId.trim()) {
      newCitation = {
        type: "library",
        value: libraryId.trim(),
        locator: locator || undefined,
        quote: quote || undefined,
        note: note || undefined,
        title: libraryTitle || `Library item ${libraryId}`,
      };
    }

    if (newCitation) {
      onChange([...citations, newCitation]);
      resetForm();
      setShowForm(false);
    }
  }

  function removeCitation(index: number) {
    onChange(citations.filter((_, i) => i !== index));
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-start gap-3  mb-2">
        <label className="text-sm font-medium text-slate-700">Evidence & Citations</label>
        <button
          type="button"
          className="btnv2 text-xs px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Hide" : "Add citation"}
        </button>
      </div>

      {showForm && (
        <div className="border rounded-lg px-3 bg-white/70 w-full py-3 mb-2">
          {/* Tabs */}
          <div className="flex gap-2 mb-2">
            {(["url", "doi", "library"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`text-[11px] px-2 py-1 rounded border ${tab === t ? "bg-slate-300" : "bg-white"}`}
                onClick={() => setTab(t)}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tab bodies */}
          {tab === "url" && (
            <div className="mb-2 space-y-1">
              <div className="flex items-center gap-2">
                <input
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="https://…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                {!!url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] underline text-slate-600"
                    title="Open link"
                  >
                    Open
                  </a>
                )}
              </div>
              <ResolvedCitationChip url={url} />
            </div>
          )}

          {tab === "doi" && (
            <div className="mb-2 space-y-1">
              <div className="flex items-center gap-2">
                <input
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="10.xxxx/xxxxxxx"
                  value={doi}
                  onChange={(e) => setDoi(e.target.value)}
                />
                {!!doi && (
                  <a
                    href={`https://doi.org/${doi}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] underline text-slate-600"
                    title="Open DOI"
                  >
                    Open
                  </a>
                )}
              </div>
              <ResolvedCitationChip url={doi.trim() ? `https://doi.org/${doi.trim()}` : ""} />
            </div>
          )}

          {tab === "library" && (
            <div className="mb-2">
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 border rounded px-2 py-1 text-sm"
                  placeholder="LibraryPost ID (or browse)"
                  value={libraryId}
                  onChange={(e) => setLibraryId(e.target.value)}
                />
                <LibrarySearchModal
                  open={libOpen}
                  onOpenChange={setLibOpen}
                  onPick={(id, item) => {
                    setLibraryId(id);
                    setLibraryTitle(item?.title || item?.linkUrl || item?.file_url || "");
                    setLibOpen(false);
                  }}
                  trigger={
                    <button
                      type="button"
                      className="px-2 py-1 text-[11px] rounded border bg-white/80"
                      onClick={() => setLibOpen(true)}
                    >
                      Browse…
                    </button>
                  }
                />
              </div>
              {!!libraryId && (
                <div className="mt-1 text-[11px] text-slate-600 truncate">
                  Selected: {libraryTitle || libraryId}
                </div>
              )}
            </div>
          )}

          {/* Common fields */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Locator (p. 13, 08:14, fig. 2)"
              value={locator}
              onChange={(e) => setLocator(e.target.value)}
            />
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm commentfield"
            rows={2}
            placeholder="Quote (optional, <280 chars)"
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
          />

          {/* Actions */}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="text-xs px-2 py-1 rounded bg-emerald-600 text-white"
              onClick={addCitation}
              title="Add citation to list"
            >
              Add to list
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border bg-white"
              onClick={resetForm}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Display collected citations */}
      {citations.length > 0 && (
        <div className="space-y-2 mt-2 ">
                <div className="text-[11px] px-2 text-slate-600">
            {citations.length} citation(s) will be attached after posting
          </div>
          <div className="flex flex-wrap  gap-2 ">
    
          {citations.map((cit, idx) => {
            const quality = cit.quality || estimateCitationQuality(cit);
            const icon = getCitationIcon(cit.type);
            
            return (
            <div
              key={idx}
              className="flex  items-start w-fit max-w-[50%] gap-2 text-xs bg-white shadow-md border
               border-indigo-200  rounded-lg px-2 py-1.5 "
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="truncate font-medium flex items-center gap-1">
                    {icon}
                    {cit.type.toUpperCase()}: {cit.title || cit.value}
                  </div>
                </div>
                {showQualityHints && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] h-4 ${getQualityBadgeClass(quality)}`}>
                      {quality} source
                    </Badge>
                    {quality === "weak" && (
                      <span className="text-[10px] text-orange-700">
                        Consider stronger sources
                      </span>
                    )}
                  </div>
                )}
                {cit.locator && (
                  <div className="text-[10px] text-slate-500">Locator: {cit.locator}</div>
                )}
                {cit.quote && (
                  <div className="text-[10px] text-slate-500 truncate max-w-full">
                    Quote: {cit.quote}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="text-rose-600 hover:text-rose-800 flex-shrink-0"
                onClick={() => removeCitation(idx)}
                title="Remove citation"
              >
                ×
              </button>
            </div>
          )})}
        </div>
        </div>
      )}
      
    </div>

  );
}
