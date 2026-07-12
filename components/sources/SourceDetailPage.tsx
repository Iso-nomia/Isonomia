"use client";

/**
 * SourceDetailPage - Full Source Detail View with Claims
 * 
 * Phase 1.1: Paper-to-Claim Pipeline
 * 
 * Displays source metadata, extracted claims, and provides
 * claim extraction/management UI.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AcademicClaimType, SourceIdentifierType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Filter,
  GitFork,
  GraduationCap,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
  User,
  Users,
  Verified,
} from "lucide-react";
import { ClaimExtractionPanel } from "@/components/claims/ClaimExtractionPanel";
import { ClaimTypeBadge, CLAIM_TYPE_INFO } from "@/components/claims/ClaimTypeSelector";
import { SourceCrossReferences } from "./SourceCrossReferences";
import { SourceUsageStats } from "./SourceUsageStats";
import { ProvenanceChain } from "./ProvenanceChain";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

interface Source {
  id: string;
  name: string;
  identifierType: SourceIdentifierType;
  identifierValue?: string;
  url?: string;
  openAlexId?: string;
  authors?: string[];
  authorOrcids?: string[];
  publicationDate?: string;
  journal?: string;
  abstractText?: string;
  keywords?: string[];
  pdfUrl?: string;
  createdAt: string;
  _count?: {
    claims: number;
  };
}

interface Claim {
  id: string;
  text: string;
  academicClaimType?: AcademicClaimType;
  supportingQuote?: string;
  pageNumber?: number;
  sectionName?: string;
  extractedByAI: boolean;
  aiConfidence?: number;
  humanVerified: boolean;
  verifiedAt?: string;
  verifiedBy?: {
    id: string;
    username: string;
  };
  createdAt: string;
}

interface SourceDetailPageProps {
  sourceId: string;
  onBack?: () => void;
}

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

export function SourceDetailPage({ sourceId, onBack }: SourceDetailPageProps) {
  const [activeTab, setActiveTab] = useState<"claims" | "extract" | "analytics">("claims");
  const queryClient = useQueryClient();

  // Fetch source details
  const sourceQuery = useQuery({
    queryKey: ["source", sourceId],
    queryFn: async () => {
      const response = await fetch(`/api/sources/${sourceId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch source");
      }
      const data = await response.json();
      return data.source as Source;
    },
  });

  // Fetch claims for this source
  const claimsQuery = useQuery({
    queryKey: ["claims", sourceId],
    queryFn: async () => {
      const response = await fetch(`/api/sources/${sourceId}/claims`);
      if (!response.ok) {
        throw new Error("Failed to fetch claims");
      }
      const data = await response.json();
      return data.claims as Claim[];
    },
    enabled: !!sourceId,
  });

  const handleClaimsCreated = (claimIds: string[]) => {
    // Refresh claims list
    queryClient.invalidateQueries({ queryKey: ["claims", sourceId] });
    // Switch to claims tab to show the new claims
    setActiveTab("claims");
  };

  // Loading state
  if (sourceQuery.isLoading) {
    return <SourceDetailSkeleton />;
  }

  // Error state
  if (sourceQuery.isError) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <div>
            <h3 className="font-semibold text-lg">Failed to load source</h3>
            <p className="text-muted-foreground">
              {sourceQuery.error instanceof Error
                ? sourceQuery.error.message
                : "An error occurred"}
            </p>
          </div>
          <Button onClick={() => sourceQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  const source = sourceQuery.data!;

  return (
    <div className="space-y-6">
      {/* Header */}
      {onBack && (
        <Button variant="ghost" onClick={onBack} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Sources
        </Button>
      )}

      {/* Source Metadata Card */}
      <SourceMetadataCard source={source} />

      {/* Tabs: Claims / Extract / Analytics */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="claims" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Claims ({claimsQuery.data?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="extract" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Extract Claims
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="mt-4">
          <ClaimsListSection
            claims={claimsQuery.data || []}
            isLoading={claimsQuery.isLoading}
            sourceId={sourceId}
          />
        </TabsContent>

        <TabsContent value="extract" className="mt-4">
          <ClaimExtractionPanel
            sourceId={sourceId}
            sourceTitle={source.name}
            hasAbstract={!!source.abstractText}
            abstractText={source.abstractText}
            onClaimsCreated={handleClaimsCreated}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <div className="space-y-6">
            {/* Usage Statistics */}
            <SourceUsageStats sourceId={sourceId} variant="card" />
            
            {/* Cross-Platform References */}
            <SourceCrossReferences sourceId={sourceId} variant="full" />
            
            {/* Evidence Provenance Chain */}
            <ProvenanceChain sourceId={sourceId} variant="timeline" maxEvents={15} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Source Metadata Card
// ─────────────────────────────────────────────────────────

function SourceMetadataCard({ source }: { source: Source }) {
  const identifierLabel = {
    DOI: "DOI",
    ISBN: "ISBN",
    ARXIV: "arXiv",
    PMID: "PubMed",
    URL: "URL",
    MANUAL: "Manual",
  }[source.identifierType];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">{source.name}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              {source.identifierValue && (
                <Badge variant="outline">
                  {identifierLabel}: {source.identifierValue}
                </Badge>
              )}
              {source.journal && (
                <span className="flex items-center gap-1 text-sm">
                  <BookOpen className="h-3 w-3" />
                  {source.journal}
                </span>
              )}
              {source.publicationDate && (
                <span className="flex items-center gap-1 text-sm">
                  <Calendar className="h-3 w-3" />
                  {new Date(source.publicationDate).toLocaleDateString()}
                </span>
              )}
            </CardDescription>
          </div>
          {source.url && (
            <Button variant="outline" size="sm" asChild>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                View Source
              </a>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Authors */}
        {source.authors && source.authors.length > 0 && (
          <div className="flex items-start gap-2">
            <Users className="h-4 w-4 mt-1 text-muted-foreground" />
            <div className="flex flex-wrap gap-2">
              {source.authors.map((author, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {author}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Abstract */}
        {source.abstractText && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Abstract
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {source.abstractText}
            </p>
          </div>
        )}

        {/* Keywords */}
        {source.keywords && source.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {source.keywords.map((keyword, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {keyword}
              </Badge>
            ))}
          </div>
        )}

        {/* OpenAlex ID link */}
        {source.openAlexId && (
          <div className="text-xs text-muted-foreground">
            <a
              href={`https://openalex.org/${source.openAlexId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <GraduationCap className="h-3 w-3" />
              View on OpenAlex
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// Claims List Section
// ─────────────────────────────────────────────────────────

interface ClaimsListSectionProps {
  claims: Claim[];
  isLoading: boolean;
  sourceId: string;
}

function ClaimsListSection({ claims, isLoading, sourceId }: ClaimsListSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<AcademicClaimType | "ALL">("ALL");
  const [verifiedFilter, setVerifiedFilter] = useState<"ALL" | "VERIFIED" | "UNVERIFIED">("ALL");
  const queryClient = useQueryClient();

  // Verify claim mutation
  const verifyMutation = useMutation({
    mutationFn: async (claimId: string) => {
      const response = await fetch("/api/claims/academic", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, verify: true }),
      });
      if (!response.ok) throw new Error("Failed to verify claim");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claims", sourceId] });
    },
  });

  // Filtered claims
  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !claim.text.toLowerCase().includes(query) &&
          !(claim.supportingQuote?.toLowerCase().includes(query))
        ) {
          return false;
        }
      }
      // Type filter
      if (typeFilter !== "ALL" && claim.academicClaimType !== typeFilter) {
        return false;
      }
      // Verified filter
      if (verifiedFilter === "VERIFIED" && !claim.humanVerified) return false;
      if (verifiedFilter === "UNVERIFIED" && claim.humanVerified) return false;
      
      return true;
    });
  }, [claims, searchQuery, typeFilter, verifiedFilter]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  // Empty state
  if (claims.length === 0) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Tag className="h-12 w-12 text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-lg">No claims yet</h3>
            <p className="text-muted-foreground">
              Extract claims from this source using AI or add them manually.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search claims..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Type: {typeFilter === "ALL" ? "All" : CLAIM_TYPE_INFO[typeFilter].label}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setTypeFilter("ALL")}>
              All Types
            </DropdownMenuItem>
            <Separator className="my-1" />
            {Object.entries(CLAIM_TYPE_INFO).map(([type, info]) => (
              <DropdownMenuItem
                key={type}
                onClick={() => setTypeFilter(type as AcademicClaimType)}
              >
                {info.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Verified className="mr-2 h-4 w-4" />
              Status: {verifiedFilter === "ALL" ? "All" : verifiedFilter.toLowerCase()}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setVerifiedFilter("ALL")}>
              All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setVerifiedFilter("VERIFIED")}>
              Verified
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setVerifiedFilter("UNVERIFIED")}>
              Unverified
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredClaims.length} of {claims.length} claims
      </p>

      {/* Claims List */}
      <div className="space-y-3">
        {filteredClaims.map((claim) => (
          <ClaimCard
            key={claim.id}
            claim={claim}
            onVerify={() => verifyMutation.mutate(claim.id)}
            isVerifying={verifyMutation.isPending}
          />
        ))}
      </div>

      {/* Empty filtered state */}
      {filteredClaims.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No claims match your filters.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Claim Card
// ─────────────────────────────────────────────────────────

interface ClaimCardProps {
  claim: Claim;
  onVerify: () => void;
  isVerifying: boolean;
}

function ClaimCard({ claim, onVerify, isVerifying }: ClaimCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={cn(claim.humanVerified && "border-green-200 bg-green-50/30")}>
      <CardContent className="pt-4">
        <div className="space-y-3">
          {/* Claim text */}
          <p className="text-sm">{claim.text}</p>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            {claim.academicClaimType && (
              <ClaimTypeBadge type={claim.academicClaimType} size="sm" />
            )}
            
            {claim.extractedByAI && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                <Sparkles className="mr-1 h-3 w-3" />
                AI Extracted
                {claim.aiConfidence && ` (${Math.round(claim.aiConfidence * 100)}%)`}
              </Badge>
            )}

            {claim.humanVerified ? (
              <Badge className="text-xs bg-green-100 text-green-700">
                <Verified className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                Unverified
              </Badge>
            )}

            {claim.sectionName && (
              <Badge variant="outline" className="text-xs">
                {claim.sectionName}
              </Badge>
            )}
            {claim.pageNumber && (
              <Badge variant="outline" className="text-xs">
                p. {claim.pageNumber}
              </Badge>
            )}
          </div>

          {/* Supporting quote (expandable) */}
          {claim.supportingQuote && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Hide" : "Show"} supporting quote
                <ChevronDown className={cn("ml-1 h-3 w-3 transition-transform", expanded && "rotate-180")} />
              </Button>
              {expanded && (
                <blockquote className="mt-2 pl-4 border-l-2 border-muted text-sm italic text-muted-foreground">
                  "{claim.supportingQuote}"
                </blockquote>
              )}
            </div>
          )}

          {/* Actions */}
          {!claim.humanVerified && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onVerify}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Verify Claim
              </Button>
            </div>
          )}

          {/* Verification info */}
          {claim.humanVerified && claim.verifiedBy && claim.verifiedAt && (
            <p className="text-xs text-muted-foreground">
              Verified by {claim.verifiedBy.username} on{" "}
              {new Date(claim.verifiedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// Loading Skeleton
// ─────────────────────────────────────────────────────────

function SourceDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────

export default SourceDetailPage;
