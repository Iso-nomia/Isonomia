// components/discourse/panels/ActionsOnMyWorkPanel.tsx
"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";
import { 
  Swords, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2,
  RefreshCw 
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClaimDetailPanel } from "@/components/claims/ClaimDetailPanel";
import { SubTabButton, StatCard, EmptyState, SearchFilter, useSearchFilter } from "../shared";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Polling interval for real-time updates (30 seconds)
const POLLING_INTERVAL = 30000;

type ActionSubTab = "all" | "attacks" | "challenges" | "responses" | "pending";

interface ActionsOnMyWorkPanelProps {
  deliberationId: string;
  userId: string;
}

export function ActionsOnMyWorkPanel({ deliberationId, userId }: ActionsOnMyWorkPanelProps) {
  const [subTab, setSubTab] = React.useState<ActionSubTab>("pending");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState<"all" | "today" | "week" | "month">("all");

  // Fetch attacks on user's work with polling
  const { data: attacksOnMe, mutate: mutateAttacks } = useSWR(
    `/api/deliberations/${deliberationId}/attacks-on-user?userId=${userId}`,
    fetcher,
    {
      refreshInterval: POLLING_INTERVAL,
      revalidateOnFocus: true,
    }
  );

  // Fetch challenges on user's work with polling
  const { data: challengesOnMe, mutate: mutateChallenges } = useSWR(
    `/api/deliberations/${deliberationId}/challenges-on-user?userId=${userId}`,
    fetcher,
    {
      refreshInterval: POLLING_INTERVAL,
      revalidateOnFocus: true,
    }
  );

  const attacksArray = attacksOnMe || [];
  const challengesArray = challengesOnMe || [];

  // Apply search and date filters
  const filteredAttacks = useSearchFilter(
    attacksArray,
    searchTerm,
    dateFilter,
    (attack: any) => `${attack.targetText || ""} ${attack.attackerName || ""} ${attack.legacyAttackType || ""}`
  );

  const filteredChallenges = useSearchFilter(
    challengesArray,
    searchTerm,
    dateFilter,
    (challenge: any) => `${challenge.targetText || ""} ${challenge.challengerName || ""} ${challenge.payload?.text || ""}`
  );

  const totalAttacks = attacksArray.length;
  const totalChallenges = challengesArray.length;
  const pendingActions = attacksArray.filter((a: any) => !a.responded).concat(
    challengesArray.filter((c: any) => !c.responded)
  );

  // Filtered pending (for search)
  const filteredPendingAttacks = filteredAttacks.filter((a: any) => !a.responded);
  const filteredPendingChallenges = filteredChallenges.filter((c: any) => !c.responded);

  const handleRefresh = () => {
    mutateAttacks();
    mutateChallenges();
  };

  // Handle keyboard navigation for sub-tabs
  const tabs: ActionSubTab[] = ["pending", "all", "attacks", "challenges", "responses"];
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
      aria-labelledby="actions-heading"
    >
      <h3 id="actions-heading" className="sr-only">Actions on My Work</h3>

      {/* Header with refresh */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400" aria-hidden="true">
            Auto-refreshes every 30s
          </span>
        </div>
        <button 
          onClick={handleRefresh}
          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Refresh actions"
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" />
          Refresh
        </button>
      </header>

      {/* Sub-tabs */}
      <nav
        className="flex gap-2 border-b border-slate-200 pb-2"
        role="tablist"
        aria-label="Action categories"
        onKeyDown={handleKeyDown}
      >
        <SubTabButton
          active={subTab === "pending"}
          onClick={() => setSubTab("pending")}
          label="Pending Response"
          count={pendingActions.length}
          highlight
          aria-selected={subTab === "pending"}
        />
        <SubTabButton
          active={subTab === "all"}
          onClick={() => setSubTab("all")}
          label="All"
          count={totalAttacks + totalChallenges}
          aria-selected={subTab === "all"}
        />
        <SubTabButton
          active={subTab === "attacks"}
          onClick={() => setSubTab("attacks")}
          label="Attacks"
          count={totalAttacks}
          aria-selected={subTab === "attacks"}
        />
        <SubTabButton
          active={subTab === "challenges"}
          onClick={() => setSubTab("challenges")}
          label="Challenges"
          count={totalChallenges}
          aria-selected={subTab === "challenges"}
        />
        <SubTabButton
          active={subTab === "responses"}
          onClick={() => setSubTab("responses")}
          label="Responses Received"
          count={0}
          aria-selected={subTab === "responses"}
        />
      </nav>

      {/* Search and Filter */}
      <SearchFilter
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        placeholder="Search actions..."
      />

      {/* Alert Banner */}
      {pendingActions.length > 0 && (
        <div 
          className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg"
          role="alert"
          aria-live="polite"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-amber-900">
              {pendingActions.length} {pendingActions.length === 1 ? "action requires" : "actions require"} your response
            </h4>
            <p className="text-sm text-amber-700 mt-1">
              Your arguments or claims have been challenged/attacked. Review and respond below.
            </p>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div 
        className="grid grid-cols-3 gap-4"
        role="region"
        aria-label="Action statistics"
      >
        <StatCard
          icon={AlertTriangle}
          label="Pending Response"
          value={pendingActions.length}
          color="amber"
        />
        <StatCard
          icon={Swords}
          label="Attacks Received"
          value={totalAttacks}
          color="red"
        />
        <StatCard
          icon={AlertCircle}
          label="Challenges Received"
          value={totalChallenges}
          color="orange"
        />
      </div>

      {/* Content */}
      <div 
        className="space-y-3"
        role="tabpanel"
        aria-label={`${subTab} actions`}
      >
        {/* Filter attacks based on sub-tab selection */}
        {(subTab === "all" || subTab === "attacks") && 
          filteredAttacks.map((attack: any) => (
            <ActionOnMeCard
              key={attack.id}
              type="attack"
              data={attack}
              deliberationId={deliberationId}
              userId={userId}
            />
          ))
        }
        
        {/* Show only unresponded attacks in pending tab */}
        {subTab === "pending" && 
          filteredPendingAttacks.map((attack: any) => (
            <ActionOnMeCard
              key={attack.id}
              type="attack"
              data={attack}
              deliberationId={deliberationId}
              userId={userId}
            />
          ))
        }

        {/* Filter challenges based on sub-tab selection */}
        {(subTab === "all" || subTab === "challenges") && 
          filteredChallenges.map((challenge: any) => (
            <ActionOnMeCard
              key={challenge.id}
              type="challenge"
              data={challenge}
              deliberationId={deliberationId}
              userId={userId}
            />
          ))
        }
        
        {/* Show only unresponded challenges in pending tab */}
        {subTab === "pending" && 
          filteredPendingChallenges.map((challenge: any) => (
            <ActionOnMeCard
              key={challenge.id}
              type="challenge"
              data={challenge}
              deliberationId={deliberationId}
              userId={userId}
            />
          ))
        }

        {/* Empty state for pending tab when all caught up */}
        {subTab === "pending" && pendingActions.length === 0 && (totalAttacks > 0 || totalChallenges > 0) && (
          <EmptyState
            icon={CheckCircle2}
            title="All caught up!"
            description="You've responded to all attacks and challenges on your work."
          />
        )}

        {/* Empty state for pending tab when search returns no results */}
        {subTab === "pending" && pendingActions.length > 0 && filteredPendingAttacks.length === 0 && filteredPendingChallenges.length === 0 && searchTerm && (
          <EmptyState
            icon={Swords}
            title="No matching pending actions"
            description="Try adjusting your search terms."
          />
        )}

        {/* Empty state for attacks tab */}
        {subTab === "attacks" && filteredAttacks.length === 0 && (
          <EmptyState
            icon={Swords}
            title={searchTerm ? "No matching attacks" : "No attacks received"}
            description={searchTerm ? "Try adjusting your search terms." : "Your work hasn't been attacked yet."}
          />
        )}

        {/* Empty state for challenges tab */}
        {subTab === "challenges" && filteredChallenges.length === 0 && (
          <EmptyState
            icon={AlertCircle}
            title={searchTerm ? "No matching challenges" : "No challenges received"}
            description={searchTerm ? "Try adjusting your search terms." : "Your work hasn't been challenged yet."}
          />
        )}

        {/* Empty state when no actions at all */}
        {totalAttacks === 0 && totalChallenges === 0 && (
          <EmptyState
            icon={CheckCircle2}
            title="No actions on your work"
            description="Your contributions haven't been challenged or attacked yet."
          />
        )}
      </div>
    </section>
  );
}

// ============================================================================
// ActionOnMeCard - Complex card with response actions
// ============================================================================

interface ActionOnMeCardProps {
  type: "attack" | "challenge";
  data: any;
  deliberationId: string;
  userId: string;
}

function ActionOnMeCard({ type, data, deliberationId, userId }: ActionOnMeCardProps) {
  const [responding, setResponding] = React.useState(false);
  const [responseType, setResponseType] = React.useState<"GROUNDS" | "CONCEDE" | "RETRACT">("GROUNDS");
  const [groundsText, setGroundsText] = React.useState("");
  const [showGroundsInput, setShowGroundsInput] = React.useState(false);
  const [showDetailsModal, setShowDetailsModal] = React.useState(false);

  const handleRespond = async () => {
    // Validate GROUNDS text if GROUNDS is selected
    if (responseType === "GROUNDS" && !groundsText.trim()) {
      alert("Please provide grounds for your response");
      return;
    }

    setResponding(true);
    try {
      if (responseType === "GROUNDS") {
        // Use answer-and-commit API for GROUNDS with text
        await fetch("/api/dialogue/answer-and-commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            targetType: data.targetType,
            targetId: data.targetId,
            cqKey: "default",
            locusPath: "0",
            expression: groundsText,
            original: groundsText,
            commitOwner: "Proponent",
            commitPolarity: "pos",
          }),
        });
      } else if (responseType === "CONCEDE") {
        // Create CONCEDE dialogue move (accepts the challenge/attack)
        await fetch("/api/dialogue/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            targetType: data.targetType,
            targetId: data.targetId,
            kind: "ASSERT",
            actorId: userId,
            payload: { 
              locusPath: "0",
              as: "CONCEDE",
              expression: "I accept this challenge",
            },
          }),
        });
      } else {
        // Create simple dialogue move for RETRACT
        await fetch("/api/dialogue/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliberationId,
            targetType: data.targetType,
            targetId: data.targetId,
            kind: responseType,
            actorId: userId,
            payload: { locusPath: "0" },
          }),
        });
      }
      
      // Refresh data using SWR mutate
      mutate((key) => typeof key === "string" && key.includes(`/api/deliberations/${deliberationId}`));
      
      // Reset state
      setShowGroundsInput(false);
      setGroundsText("");
    } catch (err) {
      console.error("Failed to respond:", err);
      alert("Failed to submit response. Please try again.");
    } finally {
      setResponding(false);
    }
  };

  const typeConfig = {
    attack: { icon: Swords, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
    challenge: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  // Check if already responded
  const hasResponded = data.responded === true;
  const responseTypeText = data.responseType === "GROUNDS" ? "defended" : 
                           data.responseType === "CONCEDE" ? "accepted" :
                           data.responseType === "RETRACT" ? "retracted" : "";

  return (
    <div className={`p-4 border-2 rounded-lg ${hasResponded ? "border-green-200 bg-green-50" : `${config.border} ${config.bg}`}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-white">
          {hasResponded ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <Icon className={`w-5 h-5 ${config.color}`} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-sm font-semibold ${hasResponded ? "text-green-700" : config.color}`}>
              {type === "attack" ? "Attack Received" : "Challenge Received"}
            </span>
            {hasResponded && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                ✓ Responded ({responseTypeText})
              </span>
            )}
            <span className="text-xs text-slate-500">
              {new Date(data.createdAt || Date.now()).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-slate-700 mb-3">
            {type === "attack" && (
              <>
                <strong>{data.attackerName || "Someone"}</strong> created a{" "}
                <span className="font-semibold">{data.legacyAttackType}</span> attack on your{" "}
                {data.targetType}
              </>
            )}
            {type === "challenge" && (
              <>
                <strong>{data.challengerName || "Someone"}</strong> asked <strong>WHY</strong>:{" "}
                &quot;{data.payload?.text || "Why do you assert this?"}&quot;
              </>
            )}
          </p>

          {/* Response Actions - only show if not already responded */}
          {!hasResponded && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={responseType}
                  onChange={(e) => {
                    const newType = e.target.value as "GROUNDS" | "CONCEDE" | "RETRACT";
                    setResponseType(newType);
                    setShowGroundsInput(newType === "GROUNDS");
                  }}
                  className="text-xs border border-slate-300 rounded px-2 py-1"
                >
                  <option value="GROUNDS">Provide GROUNDS (Defend)</option>
                  <option value="CONCEDE">CONCEDE (Accept)</option>
                  <option value="RETRACT">RETRACT (Withdraw)</option>
                </select>
                {!showGroundsInput && (
                  <button
                    onClick={() => {
                      if (responseType === "GROUNDS") {
                        setShowGroundsInput(true);
                      } else {
                        handleRespond();
                      }
                    }}
                    disabled={responding}
                    className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {responding ? "Responding..." : "Respond"}
                  </button>
                )}
                <button 
                  onClick={() => setShowDetailsModal(true)}
                  className="text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-2 py-1 rounded"
                >
                  View Details
                </button>
              </div>

              {/* GROUNDS text input */}
              {showGroundsInput && responseType === "GROUNDS" && (
                <div className="space-y-2 mt-2">
                  <textarea
                    value={groundsText}
                    onChange={(e) => setGroundsText(e.target.value)}
                    placeholder="Provide your grounds/justification..."
                    className="w-full text-sm border border-slate-300 rounded px-3 py-2 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleRespond}
                      disabled={responding || !groundsText.trim()}
                      className="text-xs bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {responding ? "Submitting..." : "Submit GROUNDS"}
                    </button>
                    <button
                      onClick={() => {
                        setShowGroundsInput(false);
                        setGroundsText("");
                      }}
                      className="text-xs text-slate-600 hover:text-slate-800 px-3 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* View Details button for already responded items */}
          {hasResponded && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowDetailsModal(true)}
                className="text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 px-2 py-1 rounded"
              >
                View Details
              </button>
              <span className="text-xs text-slate-500">
                Responded on {data.respondedAt ? new Date(data.respondedAt).toLocaleDateString() : "N/A"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-3xl bg-white max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {type === "attack" ? "Attack Details" : "Challenge Details"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Target Information */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Target {data.targetType === "claim" ? "Claim" : "Argument"}
              </h3>
              <p className="text-sm text-slate-600 mb-3">
                {data.targetText || "No text available"}
              </p>
              
              {/* Show ClaimDetailPanel if target is a claim */}
              {data.targetType === "claim" && data.targetId && (
                <ClaimDetailPanel
                  claimId={data.targetId}
                  deliberationId={deliberationId}
                  claimText={data.targetText}
                  claimAuthorId={data.targetAuthorId}
                  createdById={data.targetAuthorId}
                  currentUserId={userId}
                  className="mt-3"
                />
              )}
            </div>

            {/* Attack/Challenge Information */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                {type === "attack" ? "Attack Information" : "Challenge Information"}
              </h3>
              {type === "attack" && (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-600">Type:</span>{" "}
                    <span className="text-slate-700">{data.legacyAttackType}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Attacker:</span>{" "}
                    <span className="text-slate-700">{data.attackerName || "Unknown"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Created:</span>{" "}
                    <span className="text-slate-700">
                      {new Date(data.createdAt || Date.now()).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
              {type === "challenge" && (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-600">Question:</span>{" "}
                    <span className="text-slate-700">
                      {data.payload?.text || "Why do you assert this?"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Challenger:</span>{" "}
                    <span className="text-slate-700">{data.challengerName || "Unknown"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Created:</span>{" "}
                    <span className="text-slate-700">
                      {new Date(data.createdAt || Date.now()).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
