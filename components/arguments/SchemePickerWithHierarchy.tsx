// components/arguments/SchemePickerWithHierarchy.tsx
"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Info, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type Scheme = {
  id: string;
  key: string;
  name: string;
  summary?: string;
  parentSchemeId?: string | null;
  clusterTag?: string | null;
  cqs?: any[];
  // Enhanced fields for hierarchy
  ownCQCount?: number;
  totalCQCount?: number;
};

type Props = {
  schemes: Scheme[];
  selectedKey: string;
  onSelect: (key: string) => void;
  className?: string;
};

export function SchemePickerWithHierarchy({
  schemes,
  selectedKey,
  onSelect,
  className = "",
}: Props) {
  const [expandedClusters, setExpandedClusters] = React.useState<Set<string>>(
    new Set()
  );
  const [isOpen, setIsOpen] = React.useState(false);

  // Build hierarchy structure
  const { rootSchemes, childrenMap, clusterMap } = React.useMemo(() => {
    const roots: Scheme[] = [];
    const children = new Map<string, Scheme[]>();
    const clusters = new Map<string, Scheme[]>();

    schemes.forEach((scheme) => {
      // Build parent-child map
      if (!scheme.parentSchemeId) {
        roots.push(scheme);
      } else {
        const siblings = children.get(scheme.parentSchemeId) || [];
        siblings.push(scheme);
        children.set(scheme.parentSchemeId, siblings);
      }

      // Build cluster map
      if (scheme.clusterTag) {
        const clusterSchemes = clusters.get(scheme.clusterTag) || [];
        clusterSchemes.push(scheme);
        clusters.set(scheme.clusterTag, clusterSchemes);
      }
    });

    return {
      rootSchemes: roots,
      childrenMap: children,
      clusterMap: clusters,
    };
  }, [schemes]);

  const toggleCluster = (clusterTag: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterTag)) {
        next.delete(clusterTag);
      } else {
        next.add(clusterTag);
      }
      return next;
    });
  };

  const selectedScheme = schemes.find((s) => s.key === selectedKey);

  const renderScheme = (scheme: Scheme, depth: number = 0) => {
    const children = childrenMap.get(scheme.id) || [];
    const hasChildren = children.length > 0;
    const isSelected = scheme.key === selectedKey;
    const ownCQs = scheme.ownCQCount ?? scheme.cqs?.length ?? 0;
    const totalCQs = scheme.totalCQCount ?? ownCQs;
    const inherited = totalCQs - ownCQs;

    return (
      <div key={scheme.id}>
        <button
          className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
            isSelected
              ? "bg-indigo-100 text-indigo-900 font-medium"
              : "hover:bg-slate-100 text-slate-700"
          }`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => {
            onSelect(scheme.key);
            setIsOpen(false);
          }}
        >
          {hasChildren && (
            <ChevronRight className="h-3 w-3 text-slate-400 flex-shrink-0" />
          )}
          <span className="flex-1 truncate text-sm">{scheme.name}</span>
          
          {/* CQ Count Badge */}
          {totalCQs > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                {totalCQs} CQ{totalCQs !== 1 ? "s" : ""}
              </span>
              {inherited > 0 && (
                <span
                  className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded"
                  title={`${inherited} inherited from parent`}
                >
                  +{inherited}
                </span>
              )}
            </div>
          )}

          {/* Inherit indicator for child schemes (Phase 3 step 13: inheritance
              is now unconditional when a parent edge exists) */}
          {scheme.parentSchemeId && (
            <span className="text-xs text-slate-500" title="Inherits parent CQs">
              ⬆️
            </span>
          )}
        </button>

        {/* Render children */}
        {hasChildren &&
          children.map((child) => renderScheme(child, depth + 1))}
      </div>
    );
  };

  const renderByCluster = () => {
    const clusteredSchemes = new Set<string>();
    const elements: JSX.Element[] = [];

    // Render clusters
    Array.from(clusterMap.entries()).forEach(([clusterTag, schemesList]) => {
      const isExpanded = expandedClusters.has(clusterTag);
      const rootSchemesInCluster = schemesList.filter((s) => !s.parentSchemeId);

      elements.push(
        <div key={`cluster-${clusterTag}`} className="mb-2">
          <button
            className="w-full text-left px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 rounded flex items-center gap-2"
            onClick={() => toggleCluster(clusterTag)}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <span className="uppercase tracking-wider">
              {clusterTag.replace(/_/g, " ")}
            </span>
            <span className="text-xs text-slate-400">
              ({schemesList.length})
            </span>
          </button>

          {isExpanded && (
            <div className="mt-1">
              {rootSchemesInCluster.map((scheme) => {
                clusteredSchemes.add(scheme.id);
                return renderScheme(scheme, 0);
              })}
            </div>
          )}
        </div>
      );
    });

    // Render unclustered root schemes
    const unclustered = rootSchemes.filter(
      (s) => !s.clusterTag && !clusteredSchemes.has(s.id)
    );
    if (unclustered.length > 0) {
      elements.push(
        <div key="unclustered" className="mb-2">
          <div className="px-2 py-1.5 text-xs font-medium text-slate-600 uppercase tracking-wider">
            Other Schemes
          </div>
          <div className="mt-1">
            {unclustered.map((scheme) => renderScheme(scheme, 0))}
          </div>
        </div>
      );
    }

    return elements;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={`w-full text-left px-3 py-2 rounded-lg text-sm menuv2--lite bg-white border flex items-center justify-between ${className}`}
        >
          <span className="truncate text-slate-700">
            {selectedScheme ? selectedScheme.name : "(Choose scheme)"}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 ml-2" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-[400px] max-h-[500px] overflow-y-auto p-2"
        align="start"
      >
        <div className="space-y-1">
          {/* Freeform option */}
          <button
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
              !selectedKey
                ? "bg-indigo-100 text-indigo-900 font-medium"
                : "hover:bg-slate-100 text-slate-700"
            }`}
            onClick={() => {
              onSelect("");
              setIsOpen(false);
            }}
          >
            (No scheme - Freeform)
          </button>

          <div className="border-t my-2" />

          {/* Render schemes by cluster */}
          {clusterMap.size > 0 ? (
            renderByCluster()
          ) : (
            // Fallback: render flat list with hierarchy
            rootSchemes.map((scheme) => renderScheme(scheme, 0))
          )}
        </div>

        {/* Info footer */}
        {selectedScheme && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-start gap-2 text-xs text-slate-600">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">{selectedScheme.name}</div>
                {selectedScheme.summary && (
                  <div className="mt-1 text-slate-500">
                    {selectedScheme.summary}
                  </div>
                )}
                {selectedScheme.clusterTag && (
                  <div className="mt-1">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded">
                      {selectedScheme.clusterTag.replace(/_/g, " ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
