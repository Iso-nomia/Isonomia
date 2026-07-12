"use client";

/**
 * DOIInput - DOI Resolution Input Component
 * 
 * Phase 1.1: Paper-to-Claim Pipeline
 * 
 * Allows users to paste a DOI and automatically resolve metadata
 * from Crossref/OpenAlex.
 */

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  Check, 
  Loader2, 
  Search, 
  BookOpen, 
  ExternalLink,
  Users,
  Calendar,
  Building2,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface ResolvedSource {
  id: string;
  title: string;
  authorsJson?: Array<{ family?: string; given?: string }>;
  year?: number;
  container?: string;
  doi?: string;
  url?: string;
  abstractText?: string;
  keywords?: string[];
  _count?: {
    claims: number;
  };
}

interface DOIInputProps {
  onSourceCreated?: (source: ResolvedSource) => void;
  onNavigateToSource?: (sourceId: string) => void;
  showPreview?: boolean;
  className?: string;
}

// ─────────────────────────────────────────────────────────
// DOI Validation
// ─────────────────────────────────────────────────────────

function isValidDOIFormat(input: string): boolean {
  const trimmed = input.trim();
  return /^(10\.\d{4,}\/[^\s]+|doi:|https?:\/\/(dx\.)?doi\.org\/)/i.test(trimmed);
}

// ─────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────

export function DOIInput({ 
  onSourceCreated, 
  onNavigateToSource,
  showPreview = true,
  className,
}: DOIInputProps) {
  const [doi, setDoi] = useState("");
  const [resolvedSource, setResolvedSource] = useState<ResolvedSource | null>(null);
  const router = useRouter();

  const resolveMutation = useMutation({
    mutationFn: async (doiValue: string) => {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doi: doiValue }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.details || "Failed to resolve DOI");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setResolvedSource(data.source);
      onSourceCreated?.(data.source);
    },
  });

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (doi.trim()) {
      resolveMutation.mutate(doi.trim());
    }
  }, [doi, resolveMutation]);

  const handleNavigate = useCallback(() => {
    if (resolvedSource) {
      if (onNavigateToSource) {
        onNavigateToSource(resolvedSource.id);
      } else {
        router.push(`/sources/${resolvedSource.id}`);
      }
    }
  }, [resolvedSource, onNavigateToSource, router]);

  const handleReset = useCallback(() => {
    setDoi("");
    setResolvedSource(null);
    resolveMutation.reset();
  }, [resolveMutation]);

  const isValid = isValidDOIFormat(doi);
  const isLoading = resolveMutation.isPending;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-blue-600" />
          Add Source by DOI
        </CardTitle>
        <CardDescription>
          Paste a DOI to automatically import paper metadata from Crossref
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doi-input">DOI</Label>
            <div className="flex gap-2">
              <Input
                id="doi-input"
                type="text"
                placeholder="10.1234/example or https://doi.org/10.1234/example"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={!doi.trim() || isLoading}
                className="shrink-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resolving...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Resolve
                  </>
                )}
              </Button>
            </div>
            {doi && !isValid && (
              <p className="text-sm text-muted-foreground">
                Enter a valid DOI (e.g., 10.1234/abc or https://doi.org/10.1234/abc)
              </p>
            )}
          </div>

          {/* Error State */}
          {resolveMutation.isError && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Failed to resolve DOI</p>
                <p className="text-red-600">
                  {resolveMutation.error?.message || "Please check the DOI and try again."}
                </p>
              </div>
            </div>
          )}

          {/* Success State with Preview */}
          {resolveMutation.isSuccess && resolvedSource && showPreview && (
            <div className="rounded-lg border p-4 bg-green-50/50 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-green-700">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">
                    {resolveMutation.data.created ? "Source imported!" : "Source already exists"}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleReset}
                  className="text-muted-foreground"
                >
                  Add another
                </Button>
              </div>

              {/* Source Preview */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm line-clamp-2">
                  {resolvedSource.title}
                </h4>

                {/* Authors */}
                {resolvedSource.authorsJson && resolvedSource.authorsJson.length > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="line-clamp-1">
                      {resolvedSource.authorsJson
                        .slice(0, 3)
                        .map((a) => a.given ? `${a.given} ${a.family}` : a.family)
                        .join(", ")}
                      {resolvedSource.authorsJson.length > 3 && 
                        ` +${resolvedSource.authorsJson.length - 3} more`}
                    </span>
                  </div>
                )}

                {/* Venue & Year */}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  {resolvedSource.container && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      <span className="line-clamp-1">{resolvedSource.container}</span>
                    </div>
                  )}
                  {resolvedSource.year && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{resolvedSource.year}</span>
                    </div>
                  )}
                </div>

                {/* Keywords */}
                {resolvedSource.keywords && resolvedSource.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {resolvedSource.keywords.slice(0, 4).map((keyword) => (
                      <Badge 
                        key={keyword} 
                        variant="secondary" 
                        className="text-xs"
                      >
                        {keyword}
                      </Badge>
                    ))}
                    {resolvedSource.keywords.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{resolvedSource.keywords.length - 4}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={handleNavigate}
                  >
                    View Source & Extract Claims
                  </Button>
                  {resolvedSource.url && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      asChild
                    >
                      <a 
                        href={resolvedSource.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Original
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// Compact Variant
// ─────────────────────────────────────────────────────────

interface DOIInputCompactProps {
  onSourceCreated?: (source: ResolvedSource) => void;
  placeholder?: string;
  className?: string;
}

export function DOIInputCompact({ 
  onSourceCreated, 
  placeholder = "Paste DOI...",
  className,
}: DOIInputCompactProps) {
  const [doi, setDoi] = useState("");

  const resolveMutation = useMutation({
    mutationFn: async (doiValue: string) => {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doi: doiValue }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to resolve DOI");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      onSourceCreated?.(data.source);
      setDoi("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (doi.trim()) {
      resolveMutation.mutate(doi.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
      <Input
        type="text"
        placeholder={placeholder}
        value={doi}
        onChange={(e) => setDoi(e.target.value)}
        disabled={resolveMutation.isPending}
        className="flex-1"
      />
      <Button 
        type="submit" 
        size="sm"
        disabled={!doi.trim() || resolveMutation.isPending}
      >
        {resolveMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </Button>
    </form>
  );
}
