//components/claims/CQResponseCard.tsx
"use client";

import * as React from "react";
import { useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import {
  ThumbsUp,
  ThumbsDown,
  Award,
  FileText,
  Link2,
  CheckCircle2,
  Clock,
  Ban,
  Sparkles,
  MessageSquare,
  MoreVertical,
  Trash2,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ResponseStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANONICAL" | "SUPERSEDED" | "WITHDRAWN";

type CQResponse = {
  id: string;
  cqStatusId: string;
  contributorId: string;
  groundsText: string;
  evidenceClaimIds: string[];
  sourceUrls: string[];
  responseStatus: ResponseStatus;
  upvotes: number;
  downvotes: number;
  endorsements: Array<{
    id: string;
    userId: string;
    weight: number;
    comment?: string;
  }>;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
};

type CQResponseCardProps = {
  response: CQResponse;
  currentUserId?: string;
  canModerate?: boolean;
  onApprove?: (responseId: string, setAsCanonical: boolean) => void;
  onReject?: (responseId: string, reason: string) => void;
  onWithdraw?: (responseId: string) => void;
  onEndorse?: (responseId: string) => void;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statusConfig: Record<
  ResponseStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  PENDING: {
    label: "Pending Review",
    color: "text-amber-700 bg-amber-50 border-amber-300",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "text-emerald-700 bg-emerald-50 border-emerald-300",
    icon: CheckCircle2,
  },
  CANONICAL: {
    label: "Canonical Answer",
    color: "text-sky-700 bg-sky-50 border-sky-400",
    icon: Sparkles,
  },
  REJECTED: {
    label: "Rejected",
    color: "text-rose-700 bg-rose-50 border-rose-300",
    icon: Ban,
  },
  SUPERSEDED: {
    label: "Superseded",
    color: "text-slate-600 bg-slate-50 border-slate-300",
    icon: Clock,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    color: "text-slate-600 bg-slate-50 border-slate-300",
    icon: Trash2,
  },
};

export default function CQResponseCard({
  response,
  currentUserId,
  canModerate = false,
  onApprove,
  onReject,
  onWithdraw,
  onEndorse,
}: CQResponseCardProps) {
  const [voting, setVoting] = useState(false);
  const [showEndorsements, setShowEndorsements] = useState(false);

  // Fetch user's vote status
  const { data: voteData } = useSWR<{ userVote: number | null }>(
    currentUserId ? `/api/cqs/responses/${response.id}/vote` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const userVote = voteData?.userVote ?? null;
  const netVotes = response.upvotes - response.downvotes;
  const isContributor = currentUserId === response.contributorId;
  const config = statusConfig[response.responseStatus];
  const Icon = config.icon;

  const handleVote = async (value: number) => {
    if (voting || !currentUserId) return;

    setVoting(true);
    try {
      const res = await fetch(`/api/cqs/responses/${response.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: value.toString() }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Revalidate vote status and response list
      await globalMutate(`/api/cqs/responses/${response.id}/vote`);
      await globalMutate(`/api/cqs/responses?cqStatusId=${response.cqStatusId}`);
    } catch (err) {
      console.error("[CQResponseCard] Vote error:", err);
    } finally {
      setVoting(false);
    }
  };

  return (
    <div
      className={`
        group relative rounded-xl border-2 backdrop-blur-md shadow-lg overflow-hidden transition-all duration-300
        ${
          response.responseStatus === "CANONICAL"
            ? "border-sky-400/60 bg-gradient-to-br from-sky-400/20 to-cyan-400/20 shadow-sky-400/20"
            : response.responseStatus === "APPROVED"
            ? "border-emerald-300/60 bg-gradient-to-br from-emerald-400/10 to-green-400/10"
            : response.responseStatus === "PENDING"
            ? "border-amber-300/60 bg-gradient-to-br from-amber-400/10 to-yellow-400/10"
            : "border-slate-900/10 bg-slate-900/5"
        }
      `}
    >
      {/* Glass overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative p-5 space-y-4">
        {/* Header: Status & Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${config.color}`}>
            <Icon className="w-4 h-4" />
            {config.label}
          </div>

          {/* Actions Menu */}
          {(canModerate || isContributor) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-slate-900/10"
                >
                  <MoreVertical className="w-4 h-4 text-slate-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-slate-900/10">
                {canModerate && response.responseStatus === "PENDING" && (
                  <>
                    <DropdownMenuItem
                      onClick={() => onApprove?.(response.id, false)}
                      className="flex items-center gap-2 text-emerald-700 focus:text-emerald-800 focus:bg-emerald-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Approve Response
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onApprove?.(response.id, true)}
                      className="flex items-center gap-2 text-sky-700 focus:text-sky-800 focus:bg-sky-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      Approve as Canonical
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const reason = prompt("Reason for rejection:");
                        if (reason) onReject?.(response.id, reason);
                      }}
                      className="flex items-center gap-2 text-rose-700 focus:text-rose-800 focus:bg-rose-50"
                    >
                      <ShieldX className="w-4 h-4" />
                      Reject Response
                    </DropdownMenuItem>
                  </>
                )}
                {isContributor &&
                  response.responseStatus !== "CANONICAL" &&
                  response.responseStatus !== "WITHDRAWN" && (
                    <DropdownMenuItem
                      onClick={() => onWithdraw?.(response.id)}
                      className="flex items-center gap-2 text-slate-700 focus:text-slate-800 focus:bg-slate-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Withdraw Response
                    </DropdownMenuItem>
                  )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Response Text */}
        <div className="space-y-2">
          <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-wrap">
            {response.groundsText}
          </p>
        </div>

        {/* Evidence Claims */}
        {response.evidenceClaimIds.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-900">
              <FileText className="w-4 h-4" />
              Evidence Claims ({response.evidenceClaimIds.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {response.evidenceClaimIds.map((claimId) => (
                <div
                  key={claimId}
                  className="px-2 py-1 rounded-md bg-sky-100 border border-sky-300 text-xs text-sky-800 font-mono"
                >
                  {claimId}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Source URLs */}
        {response.sourceUrls.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-900">
              <Link2 className="w-4 h-4" />
              Sources ({response.sourceUrls.length})
            </div>
            <div className="space-y-1">
              {response.sourceUrls.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-cyan-700 hover:text-cyan-800 hover:underline truncate"
                >
                  {url}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Voting & Endorsements */}
        <div className="flex items-center gap-4 pt-3 border-t border-slate-900/10">
          {/* Voting */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleVote(1)}
              disabled={voting || !currentUserId || isContributor}
              className={`p-2 rounded-lg transition-all ${
                userVote === 1
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  : "bg-slate-900/5 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-900/10"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <span className={`text-sm font-semibold ${netVotes > 0 ? "text-emerald-700" : netVotes < 0 ? "text-rose-700" : "text-slate-600"}`}>
              {netVotes > 0 ? "+" : ""}{netVotes}
            </span>
            <button
              onClick={() => handleVote(-1)}
              disabled={voting || !currentUserId || isContributor}
              className={`p-2 rounded-lg transition-all ${
                userVote === -1
                  ? "bg-rose-100 text-rose-700 border border-rose-300"
                  : "bg-slate-900/5 text-slate-600 hover:bg-rose-50 hover:text-rose-600 border border-slate-900/10"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>

          {/* Endorsements */}
          <button
            onClick={() => setShowEndorsements(!showEndorsements)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/5 hover:bg-slate-900/10 border border-slate-900/10 transition-all"
          >
            <Award className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-slate-700">
              {response.endorsements.length} Endorsement{response.endorsements.length !== 1 ? "s" : ""}
            </span>
          </button>

          {/* Endorse Button */}
          {currentUserId && !isContributor && (
            <button
              onClick={() => onEndorse?.(response.id)}
              className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-400/30 transition-all"
            >
              <MessageSquare className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-semibold text-amber-800">Endorse</span>
            </button>
          )}
        </div>

        {/* Endorsements List */}
        {showEndorsements && response.endorsements.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-slate-900/10">
            <div className="text-xs font-semibold text-sky-900">Endorsements</div>
            {response.endorsements.map((endorsement) => (
              <div
                key={endorsement.id}
                className="p-3 rounded-lg bg-amber-50/50 border border-amber-200"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-3 h-3 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-900">
                    Weight: {endorsement.weight}
                  </span>
                </div>
                {endorsement.comment && (
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {endorsement.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Review Notes (if rejected) */}
        {response.reviewNotes && response.responseStatus === "REJECTED" && (
          <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-rose-400/10 to-red-400/10 backdrop-blur-md border border-rose-400/30 p-3">
            <div className="flex gap-2">
              <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-rose-900 mb-1">
                  Rejection Reason
                </p>
                <p className="text-xs text-rose-800 leading-relaxed">
                  {response.reviewNotes}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-900/10">
          <span>
            Submitted {new Date(response.createdAt).toLocaleDateString()}
          </span>
          {response.reviewedAt && (
            <span>
              Reviewed {new Date(response.reviewedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
