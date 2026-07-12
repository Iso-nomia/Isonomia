// components/discourse/panels/MyEngagementsPanel.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import { Swords, AlertCircle, MessageSquare, ThumbsUp } from "lucide-react";
import { 
  SubTabButton, 
  StatCard, 
  EngagementCard, 
  EmptyState, 
  VoteCard,
  SearchFilter,
  useSearchFilter 
} from "../shared";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type EngagementSubTab = "all" | "attacks" | "challenges" | "responses" | "votes";

interface MyEngagementsPanelProps {
  deliberationId: string;
  userId: string;
}

export function MyEngagementsPanel({ deliberationId, userId }: MyEngagementsPanelProps) {
  const [subTab, setSubTab] = React.useState<EngagementSubTab>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "week" | "month">("all");

  // Fetch user's attacks
  const { data: attacks } = useSWR(
    `/api/deliberations/${deliberationId}/attacks?attackerId=${userId}`,
    fetcher
  );

  // Fetch user's dialogue moves
  const { data: dialogueMoves } = useSWR(
    `/api/deliberations/${deliberationId}/dialogue-moves?actorId=${userId}`,
    fetcher
  );

  // Fetch user's votes
  const { data: votesData } = useSWR(
    `/api/deliberations/${deliberationId}/user-votes?userId=${userId}`,
    fetcher
  );

  // Ensure attacks is an array
  const attacksArray = Array.isArray(attacks) ? attacks : [];
  const whyMoves = dialogueMoves?.filter((m: any) => m.kind === "WHY") || [];
  const groundsMoves = dialogueMoves?.filter((m: any) => m.kind === "GROUNDS") || [];
  const votesArray = votesData?.votes || [];

  // Apply search and date filters
  const filteredAttacks = useSearchFilter(
    attacksArray,
    searchTerm,
    dateFilter,
    (attack: any) => `${attack.targetText || ""} ${attack.legacyAttackType || ""}`
  );

  const filteredWhyMoves = useSearchFilter(
    whyMoves,
    searchTerm,
    dateFilter,
    (move: any) => `${move.payload?.text || ""} ${move.kind}`
  );

  const filteredGroundsMoves = useSearchFilter(
    groundsMoves,
    searchTerm,
    dateFilter,
    (move: any) => `${move.payload?.text || ""} ${move.kind}`
  );

  const filteredVotes = useSearchFilter(
    votesArray,
    searchTerm,
    dateFilter,
    (vote: any) => `${vote.dialogueMoveText || ""} ${vote.targetText || ""} ${vote.actorName || ""}`
  );

  const totalAttacks = attacksArray.length;
  const totalChallenges = whyMoves.length;
  const totalResponses = groundsMoves.length;
  const totalVotes = votesArray.length;

  // Handle keyboard navigation for sub-tabs
  const handleKeyDown = (event: React.KeyboardEvent, tabs: EngagementSubTab[]) => {
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

  const tabs: EngagementSubTab[] = ["all", "attacks", "challenges", "responses", "votes"];

  return (
    <section 
      className="space-y-4"
      aria-labelledby="engagements-heading"
    >
      <h3 id="engagements-heading" className="sr-only">My Engagements</h3>

      {/* Sub-tabs */}
      <nav
        className="flex gap-2 border-b border-slate-200 pb-2"
        role="tablist"
        aria-label="Engagement categories"
        onKeyDown={(e) => handleKeyDown(e, tabs)}
      >
        <SubTabButton
          active={subTab === "all"}
          onClick={() => setSubTab("all")}
          label="All"
          count={totalAttacks + totalChallenges + totalResponses + totalVotes}
          aria-selected={subTab === "all"}
          role="tab"
        />
        <SubTabButton
          active={subTab === "attacks"}
          onClick={() => setSubTab("attacks")}
          label="Attacks"
          count={totalAttacks}
          aria-selected={subTab === "attacks"}
          role="tab"
        />
        <SubTabButton
          active={subTab === "challenges"}
          onClick={() => setSubTab("challenges")}
          label="Challenges (WHY)"
          count={totalChallenges}
          aria-selected={subTab === "challenges"}
          role="tab"
        />
        <SubTabButton
          active={subTab === "responses"}
          onClick={() => setSubTab("responses")}
          label="Responses (GROUNDS)"
          count={totalResponses}
          aria-selected={subTab === "responses"}
          role="tab"
        />
        <SubTabButton
          active={subTab === "votes"}
          onClick={() => setSubTab("votes")}
          label="Votes"
          count={totalVotes}
          aria-selected={subTab === "votes"}
          role="tab"
        />
      </nav>

      {/* Search and Filter */}
      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        placeholder="Search engagements..."
      />

      {/* Stats Overview */}
      <div 
        className="grid grid-cols-4 gap-4"
        role="region"
        aria-label="Engagement statistics"
      >
        <StatCard
          icon={Swords}
          label="Attacks Created"
          value={totalAttacks}
          color="red"
        />
        <StatCard
          icon={AlertCircle}
          label="Challenges (WHY)"
          value={totalChallenges}
          color="amber"
        />
        <StatCard
          icon={MessageSquare}
          label="Responses (GROUNDS)"
          value={totalResponses}
          color="sky"
        />
        <StatCard
          icon={ThumbsUp}
          label="Votes Cast"
          value={totalVotes}
          color="green"
        />
      </div>

      {/* Content */}
      <div 
        className="space-y-3"
        role="tabpanel"
        aria-label={`${subTab} engagements`}
      >
        {/* Attacks */}
        {(subTab === "all" || subTab === "attacks") && filteredAttacks.map((attack: any) => (
          <EngagementCard
            key={attack.id}
            type="attack"
            data={attack}
            deliberationId={deliberationId}
          />
        ))}

        {/* Challenges */}
        {(subTab === "all" || subTab === "challenges") && filteredWhyMoves.map((move: any) => (
          <EngagementCard
            key={move.id}
            type="challenge"
            data={move}
            deliberationId={deliberationId}
          />
        ))}

        {/* Responses */}
        {(subTab === "all" || subTab === "responses") && filteredGroundsMoves.map((move: any) => (
          <EngagementCard
            key={move.id}
            type="response"
            data={move}
            deliberationId={deliberationId}
          />
        ))}

        {/* Votes */}
        {(subTab === "all" || subTab === "votes") && filteredVotes.map((vote: any) => (
          <VoteCard
            key={vote.id}
            id={vote.id}
            voteType={vote.voteType}
            createdAt={vote.createdAt}
            dialogueMoveKind={vote.dialogueMoveKind}
            dialogueMoveText={vote.dialogueMoveText}
            actorName={vote.actorName}
            targetType={vote.targetType}
            targetText={vote.targetText}
          />
        ))}

        {/* Empty states */}
        {subTab === "all" && totalAttacks === 0 && totalChallenges === 0 && totalResponses === 0 && totalVotes === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="No engagements yet"
            description="Engage with others by creating attacks, challenges, responses, or voting."
          />
        )}

        {subTab === "attacks" && filteredAttacks.length === 0 && (
          <EmptyState
            icon={Swords}
            title={searchTerm ? "No matching attacks" : "No attacks created"}
            description={searchTerm ? "Try adjusting your search terms." : "Attack claims or arguments to challenge them."}
          />
        )}

        {subTab === "challenges" && filteredWhyMoves.length === 0 && (
          <EmptyState
            icon={AlertCircle}
            title={searchTerm ? "No matching challenges" : "No challenges created"}
            description={searchTerm ? "Try adjusting your search terms." : "Use WHY to ask for justification of claims."}
          />
        )}

        {subTab === "responses" && filteredGroundsMoves.length === 0 && (
          <EmptyState
            icon={MessageSquare}
            title={searchTerm ? "No matching responses" : "No responses created"}
            description={searchTerm ? "Try adjusting your search terms." : "Respond to challenges with GROUNDS."}
          />
        )}

        {subTab === "votes" && filteredVotes.length === 0 && (
          <EmptyState
            icon={ThumbsUp}
            title={searchTerm ? "No matching votes" : "No votes cast yet"}
            description={searchTerm ? "Try adjusting your search terms." : "Vote on dialogue moves to express your opinion."}
          />
        )}
      </div>
    </section>
  );
}

