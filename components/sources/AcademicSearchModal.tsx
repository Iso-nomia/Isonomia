"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SearchIcon,
  Loader2Icon,
  BookOpenIcon,
  ExternalLinkIcon,
  FileTextIcon,
  CheckIcon,
  PlusIcon,
  CalendarIcon,
  UsersIcon,
  QuoteIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AcademicSearchResult {
  externalId: string;
  source: "semantic_scholar" | "openalex" | "crossref";
  title: string;
  authors: string[];
  abstract?: string;
  publicationDate?: string;
  year?: number;
  doi?: string;
  venue?: string;
  journal?: string;
  url?: string;
  pdfUrl?: string;
  isOpenAccess?: boolean;
  citationCount?: number;
}

interface AcademicSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport?: (sources: AcademicSearchResult[]) => void;
  stackId?: string;
}

const DATABASE_OPTIONS = [
  { id: "semantic_scholar", label: "Semantic Scholar", color: "bg-blue-100 text-blue-800" },
  { id: "openalex", label: "OpenAlex", color: "bg-green-100 text-green-800" },
  { id: "crossref", label: "CrossRef", color: "bg-orange-100 text-orange-800" },
] as const;

export function AcademicSearchModal({
  open,
  onOpenChange,
  onImport,
  stackId,
}: AcademicSearchModalProps) {
  const [query, setQuery] = React.useState("");
  const [databases, setDatabases] = React.useState<string[]>([
    "semantic_scholar",
    "openalex",
    "crossref",
  ]);
  const [results, setResults] = React.useState<AcademicSearchResult[]>([]);
  const [selectedResults, setSelectedResults] = React.useState<Set<string>>(new Set());
  const [isSearching, setIsSearching] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);

  // Year filter
  const [yearFrom, setYearFrom] = React.useState<string>("");
  const [yearTo, setYearTo] = React.useState<string>("");

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!query.trim() || query.trim().length < 2) {
      setError("Please enter at least 2 characters");
      return;
    }

    if (databases.length === 0) {
      setError("Please select at least one database");
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults([]);
    setSelectedResults(new Set());

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        databases: databases.join(","),
        limit: "30",
      });

      if (yearFrom) params.set("yearFrom", yearFrom);
      if (yearTo) params.set("yearTo", yearTo);

      const res = await fetch(`/api/sources/search?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.results || []);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const toggleDatabase = (dbId: string) => {
    setDatabases((prev) =>
      prev.includes(dbId)
        ? prev.filter((d) => d !== dbId)
        : [...prev, dbId]
    );
  };

  const toggleResult = (resultId: string) => {
    setSelectedResults((prev) => {
      const next = new Set(prev);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedResults.size === results.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(results.map((r) => `${r.source}:${r.externalId}`)));
    }
  };

  const handleImport = async () => {
    const selected = results.filter((r) =>
      selectedResults.has(`${r.source}:${r.externalId}`)
    );

    if (selected.length === 0) {
      setError("Please select at least one result to import");
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/sources/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchResults: selected,
          stackId,
          skipIfExists: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }

      if (onImport) {
        onImport(selected);
      }

      // Reset and close
      setQuery("");
      setResults([]);
      setSelectedResults(new Set());
      setHasSearched(false);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setQuery("");
    setResults([]);
    setSelectedResults(new Set());
    setError(null);
    setHasSearched(false);
    setYearFrom("");
    setYearTo("");
    onOpenChange(false);
  };

  const getSourceBadgeStyle = (source: string) => {
    const db = DATABASE_OPTIONS.find((d) => d.id === source);
    return db?.color || "bg-gray-100 text-gray-800";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpenIcon className="h-5 w-5" />
            Search Academic Databases
          </DialogTitle>
          <DialogDescription>
            Search Semantic Scholar, OpenAlex, and CrossRef for academic papers
          </DialogDescription>
        </DialogHeader>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search by title, author, or keywords..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" disabled={isSearching}>
              {isSearching ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <SearchIcon className="h-4 w-4" />
              )}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Database selection */}
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Databases:</Label>
              {DATABASE_OPTIONS.map((db) => (
                <button
                  key={db.id}
                  type="button"
                  onClick={() => toggleDatabase(db.id)}
                  className={cn(
                    "px-2 py-1 text-xs rounded-md border transition-colors",
                    databases.includes(db.id)
                      ? db.color
                      : "bg-gray-50 text-gray-400 border-gray-200"
                  )}
                >
                  {db.label}
                </button>
              ))}
            </div>

            {/* Year filter */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="From"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                className="w-20 h-8 text-sm"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="number"
                placeholder="To"
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
                className="w-20 h-8 text-sm"
              />
            </div>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 min-h-0">
          {hasSearched && results.length === 0 && !isSearching && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <FileTextIcon className="h-12 w-12 mb-4 opacity-50" />
              <p>No results found</p>
              <p className="text-sm">Try different search terms or databases</p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {results.length} results found
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                >
                  {selectedResults.size === results.length ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <ScrollArea className="h-[350px] border rounded-md">
                <div className="divide-y">
                  {results.map((result) => {
                    const resultKey = `${result.source}:${result.externalId}`;
                    const isSelected = selectedResults.has(resultKey);

                    return (
                      <div
                        key={resultKey}
                        className={cn(
                          "p-3 cursor-pointer transition-colors hover:bg-muted/50",
                          isSelected && "bg-primary/5"
                        )}
                        onClick={() => toggleResult(resultKey)}
                      >
                        <div className="flex gap-3">
                          <div className="pt-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleResult(resultKey)}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 mb-1">
                              <h4 className="font-medium text-sm leading-tight line-clamp-2">
                                {result.title}
                              </h4>
                              <Badge
                                variant="secondary"
                                className={cn("shrink-0 text-[10px]", getSourceBadgeStyle(result.source))}
                              >
                                {result.source.replace("_", " ")}
                              </Badge>
                            </div>

                            {/* Authors */}
                            {result.authors.length > 0 && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                <UsersIcon className="h-3 w-3" />
                                {result.authors.slice(0, 3).join(", ")}
                                {result.authors.length > 3 && ` +${result.authors.length - 3} more`}
                              </p>
                            )}

                            {/* Venue and Year */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {result.venue && (
                                <span className="truncate max-w-[200px]">{result.venue}</span>
                              )}
                              {result.year && (
                                <span className="flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3" />
                                  {result.year}
                                </span>
                              )}
                              {result.citationCount !== undefined && (
                                <span className="flex items-center gap-1">
                                  <QuoteIcon className="h-3 w-3" />
                                  {result.citationCount} citations
                                </span>
                              )}
                              {result.isOpenAccess && (
                                <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
                                  Open Access
                                </Badge>
                              )}
                            </div>

                            {/* Abstract preview */}
                            {result.abstract && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {result.abstract}
                              </p>
                            )}

                            {/* Links */}
                            <div className="flex gap-2 mt-2">
                              {result.doi && (
                                <a
                                  href={`https://doi.org/${result.doi}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <ExternalLinkIcon className="h-3 w-3" />
                                  DOI
                                </a>
                              )}
                              {result.pdfUrl && (
                                <a
                                  href={result.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-green-600 hover:underline flex items-center gap-1"
                                >
                                  <FileTextIcon className="h-3 w-3" />
                                  PDF
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              {selectedResults.size} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedResults.size === 0 || isImporting}
              >
                {isImporting ? (
                  <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <PlusIcon className="h-4 w-4 mr-2" />
                )}
                Import {selectedResults.size > 0 ? `(${selectedResults.size})` : ""}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
