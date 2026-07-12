// components/discourse/panels/MyContributionsPanel.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import { FileText, MessageSquare, CheckCircle2, Lightbulb } from "lucide-react";
import { 
  SubTabButton, 
  StatCard, 
  ContributionCard, 
  EmptyState,
  SearchFilter,
  useSearchFilter 
} from "../shared";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ContributionSubTab = "all" | "claims" | "arguments" | "propositions";

interface MyContributionsPanelProps {
  deliberationId: string;
  userId: string;
}

export function MyContributionsPanel({ deliberationId, userId }: MyContributionsPanelProps) {
  const [subTab, setSubTab] = React.useState<ContributionSubTab>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "week" | "month">("all");

  // Fetch user's contributions
  const { data: claims, isLoading: loadingClaims } = useSWR(
    `/api/deliberations/${deliberationId}/claims?authorId=${userId}`,
    fetcher
  );

  const { data: args, isLoading: loadingArgs } = useSWR(
    `/api/deliberations/${deliberationId}/arguments?authorId=${userId}`,
    fetcher
  );

  // Fetch user's propositions
  const { data: propositions, isLoading: loadingPropositions } = useSWR(
    `/api/deliberations/${deliberationId}/propositions?authorId=${userId}`,
    fetcher
  );

  const claimsArray = claims?.items || [];
  const argsArray = args?.items || [];
  const propsArray = propositions?.items || [];

  // Apply search and date filters
  const filteredClaims = useSearchFilter(
    claimsArray,
    searchTerm,
    dateFilter,
    (claim: any) => claim.text || ""
  );

  const filteredArgs = useSearchFilter(
    argsArray,
    searchTerm,
    dateFilter,
    (arg: any) => arg.text || arg.claim?.text || ""
  );

  const filteredProps = useSearchFilter(
    propsArray,
    searchTerm,
    dateFilter,
    (prop: any) => prop.text || ""
  );

  const totalClaims = claimsArray.length;
  const totalArguments = argsArray.length;
  const totalPropositions = propsArray.length;

  const isLoading = loadingClaims || loadingArgs || loadingPropositions;

  // Handle keyboard navigation for sub-tabs
  const tabs: ContributionSubTab[] = ["all", "claims", "arguments", "propositions"];
  const handleKeyDown = (event: React.KeyboardEvent) => {
    const currentIndex = tabs.indexOf(subTab);
    
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % tabs.length;
      setSubTab(tabs[nextIndex]);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      setSubTab(tabs[prevIndex]);
    }
  };

  return (
    <section 
      className="space-y-4"
      aria-labelledby="contributions-heading"
    >
      <h3 id="contributions-heading" className="sr-only">My Contributions</h3>

      {/* Sub-tabs */}
      <nav
        className="flex gap-2 border-b border-slate-200 pb-2"
        role="tablist"
        aria-label="Contribution types"
        onKeyDown={handleKeyDown}
      >
        <SubTabButton
          active={subTab === "all"}
          onClick={() => setSubTab("all")}
          label="All"
          count={totalClaims + totalArguments + totalPropositions}
          aria-selected={subTab === "all"}
        />
        <SubTabButton
          active={subTab === "claims"}
          onClick={() => setSubTab("claims")}
          label="Claims"
          count={totalClaims}
          aria-selected={subTab === "claims"}
        />
        <SubTabButton
          active={subTab === "arguments"}
          onClick={() => setSubTab("arguments")}
          label="Arguments"
          count={totalArguments}
          aria-selected={subTab === "arguments"}
        />
        <SubTabButton
          active={subTab === "propositions"}
          onClick={() => setSubTab("propositions")}
          label="Propositions"
          count={totalPropositions}
          aria-selected={subTab === "propositions"}
        />
      </nav>

      {/* Search and Filter */}
      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        placeholder="Search contributions..."
      />

      {/* Stats Overview */}
      <div 
        className="grid grid-cols-4 gap-4"
        role="region"
        aria-label="Contribution statistics"
      >
        <StatCard
          icon={FileText}
          label="Claims Created"
          value={totalClaims}
          color="sky"
        />
        <StatCard
          icon={MessageSquare}
          label="Arguments Created"
          value={totalArguments}
          color="indigo"
        />
        <StatCard
          icon={Lightbulb}
          label="Propositions"
          value={totalPropositions}
          color="green"
        />
        <StatCard
          icon={CheckCircle2}
          label="Total"
          value={totalClaims + totalArguments + totalPropositions}
          color="purple"
        />
      </div>

      {/* Content */}
      <div 
        className="space-y-3"
        role="tabpanel"
        aria-label={`${subTab} contributions`}
      >
        {isLoading ? (
          <div 
            className="text-center py-8 text-slate-500"
            role="status"
            aria-label="Loading contributions"
          >
            Loading contributions...
          </div>
        ) : (
          <>
            {/* Claims */}
            {(subTab === "all" || subTab === "claims") && filteredClaims.map((claim: any) => (
              <ContributionCard
                key={claim.id}
                type="claim"
                id={claim.id}
                text={claim.text}
                createdAt={claim.createdAt}
                deliberationId={deliberationId}
              />
            ))}
            
            {/* Arguments */}
            {(subTab === "all" || subTab === "arguments") && filteredArgs.map((arg: any) => (
              <ContributionCard
                key={arg.id}
                type="argument"
                id={arg.id}
                text={arg.text || arg.claim?.text || "Untitled Argument"}
                createdAt={arg.createdAt}
                deliberationId={deliberationId}
              />
            ))}

            {/* Propositions */}
            {(subTab === "all" || subTab === "propositions") && filteredProps.map((prop: any) => (
              <ContributionCard
                key={prop.id}
                type="proposition"
                id={prop.id}
                text={prop.text}
                createdAt={prop.createdAt}
                deliberationId={deliberationId}
                voteUpCount={prop.voteUpCount}
                voteDownCount={prop.voteDownCount}
                endorseCount={prop.endorseCount}
                status={prop.status}
              />
            ))}
            
            {/* Empty states */}
            {subTab === "all" && totalClaims === 0 && totalArguments === 0 && totalPropositions === 0 && (
              <EmptyState
                icon={FileText}
                title="No contributions yet"
                description="Create your first claim, argument, or proposition to get started."
              />
            )}

            {subTab === "claims" && filteredClaims.length === 0 && (
              <EmptyState
                icon={FileText}
                title={searchTerm ? "No matching claims" : "No claims created"}
                description={searchTerm ? "Try adjusting your search terms." : "Create your first claim to get started."}
              />
            )}

            {subTab === "arguments" && filteredArgs.length === 0 && (
              <EmptyState
                icon={MessageSquare}
                title={searchTerm ? "No matching arguments" : "No arguments created"}
                description={searchTerm ? "Try adjusting your search terms." : "Create your first argument to get started."}
              />
            )}

            {subTab === "propositions" && filteredProps.length === 0 && (
              <EmptyState
                icon={Lightbulb}
                title={searchTerm ? "No matching propositions" : "No propositions created"}
                description={searchTerm ? "Try adjusting your search terms." : "Create a proposition to propose solutions."}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

