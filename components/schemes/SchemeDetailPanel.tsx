/**
 * Scheme Detail Panel
 * 
 * Enhanced detail view for selected schemes with actions and related schemes.
 * 
 * Week 8, Task 8.3: User Preferences
 */

"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Star,
  Copy,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import type { ArgumentScheme } from "@prisma/client";
import { useNavigationStore } from "@/lib/schemes/navigation-state";
import { getRelatedSchemes, getSuggestedNavigationMode } from "@/lib/schemes/navigation-integration";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SchemeDetailPanelProps {
  scheme: ArgumentScheme;
  onClose: () => void;
  onSchemeSelect?: (scheme: ArgumentScheme) => void;
}

export default function SchemeDetailPanel({
  scheme,
  onClose,
  onSchemeSelect,
}: SchemeDetailPanelProps) {
  const { isFavorite, toggleFavorite, setMode } = useNavigationStore();
  const { data: allSchemes } = useSWR<ArgumentScheme[]>("/api/schemes/all", fetcher);

  const favorite = isFavorite(scheme.key);
  const suggestedMode = getSuggestedNavigationMode(scheme);

  const relatedSchemes = React.useMemo(() => {
    if (!allSchemes) return null;
    return getRelatedSchemes(scheme, allSchemes);
  }, [scheme, allSchemes]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(scheme.key);
  };

  const handleViewFull = () => {
    // For now, just copy the key since the full detail page doesn't exist yet
    navigator.clipboard.writeText(scheme.key);
    alert(`Scheme key "${scheme.key}" copied to clipboard!`);
  };

  const handleSwitchMode = () => {
    setMode(suggestedMode);
    onClose(); // Close the detail panel when switching modes
  };

  return (
    <Card className="fixed bottom-4 border border-slate-700 right-4 w-[500px] max-h-[87vh] rounded-none rounded-l-lg bg-white/60 p-2 shadow-lg shadow-slate-700/40 backdrop-blur-xl overflow-y-auto custom-scrollbar z-50">
      <div className="p-2 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center ">
              <h3 className="font-bold text-lg">{scheme.name}</h3>
             
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              {scheme.key}
            </p>
          </div>
          <div className="flex gap-3">
           <button
               
                onClick={() => toggleFavorite(scheme.key)}
                className="flex"
              >
                <Star
                  className={` flex w-4 h-4 ${
                    favorite ? "fill-yellow-400 text-yellow-400" : ""
                  }`}
                />
              </button>
          <button onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm mb-2 border  border-slate-600 rounded-lg px-2 py-1.5">{scheme.description}</p>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={handleCopyKey}
            className="flex-1 btnv2--ghost bg-indigo-100 text-xs px-3 py-1.5 rounded-xl font-medium flex items-center justify-center"
          >
            <Copy className="w-3 h-3 mr-1" />
            Copy Key
          </button>
          <button   
   
            onClick={handleViewFull}
            className="flex-1 btnv2--ghost font-medium bg-indigo-100 text-xs px-3 py-1.5 rounded-xl flex items-center justify-center"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Full Details
          </button>
        </div>

        {/* Premises & Conclusion */}
        {scheme.premises && Array.isArray(scheme.premises) && scheme.premises.length > 0 && (
          <div className="mb-2">
            <h4 className="text-md font-semibold mb-2 underline underline-offset-4">Premises</h4>
            <ul className="space-y-1">
              {(scheme.premises as any[]).map((premise: any, idx: number) => {
                const premiseText = typeof premise === "string" 
                  ? premise 
                  : premise?.text || JSON.stringify(premise);
                return (
                  <li key={idx} className="text-sm text-muted-foreground">
                    <span className="font-medium">P{idx + 1}:</span> {premiseText}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {scheme.conclusion && (
          <div className="mb-0">
            <h4 className="text-md font-semibold mb-2 underline underline-offset-4">Conclusion</h4>
            <p className="text-sm text-muted-foreground">
              {typeof scheme.conclusion === "string" 
                ? scheme.conclusion 
                : (scheme.conclusion as any)?.text || JSON.stringify(scheme.conclusion)}
            </p>
          </div>
        )}

        {/* Suggested Navigation */}
        <div className="flex py-1.5 px-2 my-1 bg-indigo-100 shadow-sm w-full shadow-slate-600/50 rounded-xl gap-3 items-center">
          <p className="flex text-sm tracking-wide items-center w-fit whitespace-nowrap font-medium ">Suggested Navigation:</p>
          <button
      
            onClick={handleSwitchMode}
                      className="w-full flex btnv2--ghost bg-white/50 text-sm px-4 py-1.5 rounded-xl flex gap-1 items-center justify-center"

          >
            {suggestedMode === "tree" && "Use Wizard"}
            {suggestedMode === "cluster" && "Browse Cluster"}
            {suggestedMode === "conditions" && "Filter by Conditions"}
            {suggestedMode === "search" && "Search Similar"}
            <ChevronRight className="w-3 h-3 " />
          </button>
        </div>

        {/* Related Schemes */}
        {relatedSchemes && onSchemeSelect && (
          <div className="space-y-3">
            {relatedSchemes.byCluster.length > 0 && (
              <div>
                <h4 className="flex text-md underline underline-offset-4 font-semibold mb-3 ">
                  Same Cluster
                  <Badge variant="secondary" className="ml-2">
                    {relatedSchemes.byCluster.length}
                  </Badge>
                </h4>
                <div className="space-y-3">
                  {relatedSchemes.byCluster.slice(0, 3).map((related) => (
                    <button
                      key={related.key}
                      onClick={() => onSchemeSelect(related)}
                      className="btnv2--ghost shadow-sm w-full text-left p-2 text-sm rounded-xl bg-indigo-100 hover:bg-slate-100 transition-colors"
                    >
                      <div className="font-medium">{related.name}</div>
                      <div className="text-muted-foreground truncate">
                        {related.key}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {relatedSchemes.byPurposeSource.length > 0 && (
              <div>
                <h4 className="flex text-base font-semibold mb-3 underline underline-offset-4">
                  Similar Purpose/Source
                  <Badge variant="secondary" className="ml-2">
                    {relatedSchemes.byPurposeSource.length}
                  </Badge>
                </h4>
                <div className="space-y-3">
                  {relatedSchemes.byPurposeSource.slice(0, 3).map((related) => (
                    <button
                      key={related.key}
                      onClick={() => onSchemeSelect(related)}
                      className="btnv2--ghost bg-indigo-100 shadow-sm w-full text-left p-2 text-sm rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <div className="font-medium">{related.name}</div>
                      <div className="text-muted-foreground truncate">
                        {related.key}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
