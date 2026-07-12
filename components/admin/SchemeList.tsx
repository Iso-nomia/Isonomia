//components/admin/SchemeList.tsx
"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Loader2, Search, Filter, Network, List, ChevronDown, ChevronRight, PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import SchemeHierarchyView from "./SchemeHierarchyView";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SchemeCreator from "./SchemeCreator";

type ArgumentScheme = {
  id: string;
  key: string;
  name: string;
  summary: string;
  description?: string;
  purpose?: string;
  source?: string;
  materialRelation?: string;
  reasoningType?: string;
  ruleForm?: string;
  conclusionType?: string;
  clusterTag?: string;
  parentSchemeId?: string;
  premises?: any;
  conclusion?: any;
  cqs?: Array<{
    cqKey: string;
    text: string;
    attackType: string;
    targetScope: string;
  }>;
};

export default function SchemeList() {
  const [schemes, setSchemes] = useState<ArgumentScheme[]>([]);
  const [filteredSchemes, setFilteredSchemes] = useState<ArgumentScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showCreator, setShowCreator] = useState(false);
  const [editingScheme, setEditingScheme] = useState<ArgumentScheme | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMaterial, setFilterMaterial] = useState<string>("");
  const [viewMode, setViewMode] = useState<"list" | "hierarchy">("list"); // Phase 6D
  const [expandedSchemes, setExpandedSchemes] = useState<Set<string>>(new Set()); // For accordion

  const toggleSchemeExpanded = (schemeId: string) => {
    setExpandedSchemes((prev) => {
      const next = new Set(prev);
      if (next.has(schemeId)) {
        next.delete(schemeId);
      } else {
        next.add(schemeId);
      }
      return next;
    });
  };

  useEffect(() => {
    loadSchemes();
  }, []);

  useEffect(() => {
    // Apply filters
    let filtered = schemes;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.key.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query) ||
          s.summary.toLowerCase().includes(query)
      );
    }

    if (filterMaterial) {
      filtered = filtered.filter((s) => s.materialRelation === filterMaterial);
    }

    setFilteredSchemes(filtered);
  }, [schemes, searchQuery, filterMaterial]);

  const loadSchemes = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/schemes");
      if (!response.ok) throw new Error("Failed to load schemes");
      const data = await response.json();
      setSchemes(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (schemeId: string) => {
    if (!confirm("Are you sure you want to delete this scheme?")) return;

    try {
      const response = await fetch(`/api/schemes/${schemeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete scheme");
      }

      await loadSchemes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete scheme");
    }
  };

  const handleEdit = (scheme: ArgumentScheme) => {
    setEditingScheme(scheme);
    setShowCreator(true);
  };

  const handleCreatorClose = () => {
    setShowCreator(false);
    setEditingScheme(null);
  };

  const handleCreatorSuccess = () => {
    loadSchemes();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-md text-red-700">
        Error loading schemes: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Argumentation Schemes</h2>
          <p className="text-sm text-slate-600 mt-1">
            Manage and create custom argument schemes
          </p>
        </div>
        <div className="flex gap-2">
          {/* View Mode Toggle */}
          <div className="flex border rounded-lg overflow-hidden bg-white">
            <button
              className={`px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                viewMode === "list" 
                  ? "bg-slate-100 text-slate-900" 
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              className={`px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                viewMode === "hierarchy" 
                  ? "bg-slate-100 text-slate-900" 
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setViewMode("hierarchy")}
            >
              <Network className="h-4 w-4" />
              Hierarchy
            </button>
          </div>

          <button className="btnv2 text-sm bg-white" onClick={() => setShowCreator(true)}>
            <PlusCircle className="h-4 w-4" />
            Create Scheme
          </button>
        </div>
      </div>

      {/* Hierarchy View */}
      {viewMode === "hierarchy" ? (
        <SchemeHierarchyView />
      ) : (
        <>
          {/* Filters */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search schemes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-full articlesearchfield border-indigo-300 border py-2.5 rounded-lg"
              />
            </div>
            <div className="w-64">
              <Select value={filterMaterial || "all"} onValueChange={(value) => setFilterMaterial(value === "all" ? "" : value)}>
                <SelectTrigger className="rounded-lg menuv2--lite text-sm py-0 bg-white">
                  <SelectValue placeholder="Filter by material relation..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Relations</SelectItem>
                  <SelectItem value="cause">Cause & Effect</SelectItem>
                  <SelectItem value="definition">Definition/Classification</SelectItem>
                  <SelectItem value="analogy">Analogy/Similarity</SelectItem>
                  <SelectItem value="authority">Authority/Expertise</SelectItem>
                  <SelectItem value="practical">Practical/Means-End</SelectItem>
                  <SelectItem value="correlation">Correlation/Sign</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Schemes List */}
          {filteredSchemes.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          {searchQuery || filterMaterial
            ? "No schemes match your filters"
            : "No schemes yet. Create your first one!"}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredSchemes.map((scheme) => {
            const isExpanded = expandedSchemes.has(scheme.id);
            return (
              <div
                key={scheme.id}
                className="border rounded-lg bg-white/60 backdrop-blur-md shadow-md hover:shadow-slate-700/20 transition-shadow"
              >
                {/* Main Card Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSchemeExpanded(scheme.id)}
                          className="p-1 hover:bg-slate-100 rounded transition-colors"
                          title={isExpanded ? "Collapse details" : "Expand details"}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-slate-600" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-600" />
                          )}
                        </button>
                        <h3 className="font-semibold text-lg">{scheme.name}</h3>
                        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">
                          {scheme.key}
                        </code>
                      </div>
                      <p className="text-sm text-slate-600 mt-1 ml-8">{scheme.summary}</p>

                      {/* Taxonomy Badges */}
                      <div className="flex flex-wrap gap-2 mt-3 ml-8">
                        {scheme.materialRelation && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                            {scheme.materialRelation}
                          </span>
                        )}
                        {scheme.reasoningType && (
                          <span className="text-xs bg-sky-100 text-sky-700 px-2 py-1 rounded">
                            {scheme.reasoningType}
                          </span>
                        )}
                        {scheme.source && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            source: {scheme.source}
                          </span>
                        )}
                        {scheme.purpose && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded">
                            {scheme.purpose}
                          </span>
                        )}
                        {scheme.clusterTag && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                            {scheme.clusterTag}
                          </span>
                        )}
                      </div>

                      {/* CQ Count */}
                      {scheme.cqs && scheme.cqs.length > 0 && (
                        <div className="text-xs text-slate-500 mt-2 ml-8">
                          {scheme.cqs.length} critical question{scheme.cqs.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 ml-4">
                      <button
                        className="btnv2--ghost px-4 py-2 rounded-lg bg-white"
                        onClick={() => handleEdit(scheme)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="btnv2--ghost px-4 py-2 rounded-lg bg-white"
                        onClick={() => handleDelete(scheme.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Collapsible Details */}
                {isExpanded && (
                  <div className="border-t bg-slate-50/90 px-12 py-3 space-y-4">
                    {/* Description */}
                    {scheme.description && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-1">Description</h4>
                        <p className="text-sm text-slate-600">{scheme.description}</p>
                      </div>
                    )}

                    {/* Macagno Taxonomy Details */}
                    <div >
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Taxonomy (Macagno & Walton)</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-medium text-slate-600">Purpose:</span>{" "}
                          <span className="text-slate-800">{scheme.purpose || "not set"}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-600">Source:</span>{" "}
                          <span className="text-slate-800">{scheme.source || "not set"}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-600">Material Relation:</span>{" "}
                          <span className="text-slate-800">{scheme.materialRelation || "not set"}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-600">Reasoning Type:</span>{" "}
                          <span className="text-slate-800">{scheme.reasoningType || "not set"}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-600">Rule Form:</span>{" "}
                          <span className="text-slate-800">{scheme.ruleForm || "not set"}</span>
                        </div>
                        <div>
                          <span className="font-medium text-slate-600">Conclusion Type:</span>{" "}
                          <span className="text-slate-800">{scheme.conclusionType || "not set"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Hierarchy Info */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Clustering & Hierarchy</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-medium text-slate-600">Cluster Tag:</span>{" "}
                          <span className="text-slate-800">{scheme.clusterTag || "none"}</span>
                        </div>
                        {scheme.parentSchemeId && (
                          <div className="col-span-2">
                            <span className="font-medium text-slate-600">Parent Scheme ID:</span>{" "}
                            <code className="text-xs bg-slate-200 px-1.5 py-0.5 rounded">{scheme.parentSchemeId}</code>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Formal Structure (Premises & Conclusion) */}
                    {(scheme.premises || scheme.conclusion) && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Formal Structure (Walton-style)</h4>
                        
                        {/* Premises */}
                        {scheme.premises && Array.isArray(scheme.premises) && scheme.premises.length > 0 && (
                          <div className="mb-3">
                            <div className="text-sm font-medium text-slate-600 mb-2">Premises:</div>
                            <div className="space-y-2">
                              {scheme.premises.map((premise: any, idx: number) => (
                                <div key={idx} className="bg-white border rounded-lg px-3 py-1.5">
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs font-mono font-bold text-slate-700 mt-2 px-2">
                                      {premise.id}:
                                    </span>
                                    <div className="flex-1">
                                      <span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                        {premise.type}
                                      </span>
                                      <p className="text-sm text-slate-700 mt-1">{premise.text}</p>
                                      {premise.variables && premise.variables.length > 0 && (
                                        <div className="text-xs text-slate-500 mt-1">
                                          Variables: <code className="font-mono">{premise.variables.join(", ")}</code>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Conclusion */}
                        {scheme.conclusion && (
                          <div>
                            <div className="text-sm font-medium text-slate-600 mb-2">Conclusion:</div>
                            <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg px-3 py-2">
                              <div className="flex items-start gap-2">
                                <span className="text-sm font-mono px-2  font-bold text-indigo-700 mt-0.5">∴</span>
                                <div className="flex-1">
                                  <p className="text-sm text-slate-900">{scheme.conclusion.text}</p>
                                  {scheme.conclusion.variables && scheme.conclusion.variables.length > 0 && (
                                    <div className="text-xs text-slate-500 px-1 mt-1">
                                      Variables: <code className="font-mono">{scheme.conclusion.variables.join(", ")}</code>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Critical Questions */}
                    {scheme.cqs && scheme.cqs.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-1">
                          Critical Questions ({scheme.cqs.length})
                        </h4>
                        <div className="space-y-2">
                          {scheme.cqs.map((cq, idx) => (
                            <div key={idx} className="bg-white border  rounded-lg px-3 py-1.5">
                              <div className="flex items-start gap-2 px-2 py-1">
                                <span className="flex text-xs font-bold text-slate-600 mt-2">{idx + 1}.</span>
                                <div className="flex-1">
                                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                    {cq.cqKey}
                                  </code>
                                  <p className="text-sm text-slate-700 mt-1">{cq.text}</p>
                                  <div className="flex gap-2 mt-2">
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                      {cq.attackType}
                                    </span>
                                    <span className="text-xs bg-sky-100 text-blue-700 px-2 py-0.5 rounded">
                                      targets: {cq.targetScope}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </>
      )}

      {/* Creator Dialog */}
      <SchemeCreator
        open={showCreator}
        onOpenChange={handleCreatorClose}
        onSuccess={handleCreatorSuccess}
        editScheme={
          editingScheme
            ? {
                id: editingScheme.id,
                key: editingScheme.key,
                name: editingScheme.name,
                description: "",
                summary: editingScheme.summary,
                purpose: editingScheme.purpose || "",
                source: editingScheme.source || "",
                materialRelation: editingScheme.materialRelation || "",
                reasoningType: editingScheme.reasoningType || "",
                ruleForm: "",
                conclusionType: "",
                epistemicMode: (editingScheme as any).epistemicMode || "FACTUAL",
                tags: (editingScheme as any).tags || [],
                examples: (editingScheme as any).examples || [],
                difficulty: (editingScheme as any).difficulty || "intermediate",
                identificationConditions:
                  (editingScheme as any).identificationConditions || [],
                whenToUse: (editingScheme as any).whenToUse || "",
                premises: [],
                conclusion: null,
                cqs: (editingScheme.cqs || []).map((cq) => ({
                  cqKey: cq.cqKey,
                  text: cq.text,
                  attackType: cq.attackType as "REBUTS" | "UNDERCUTS" | "UNDERMINES",
                  targetScope: cq.targetScope as "conclusion" | "inference" | "premise",
                })),
                // Phase 6D clustering fields
                parentSchemeId: (editingScheme as any).parentSchemeId || "",
                clusterTag: (editingScheme as any).clusterTag || "",
              }
            : undefined
        }
      />
    </div>
  );
}
