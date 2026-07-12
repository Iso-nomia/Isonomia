"use client";

/**
 * TypologyCandidateQueue — B3.2
 *
 * Cockpit tile that lists pending typology candidates for a facilitation
 * session. Promote → opens a tagger-prefilled dialog; Dismiss → opens a
 * reason dialog.
 *
 * Sort order is server-canonical: `[priority desc, createdAt asc]`.
 */

import * as React from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, Inbox, AlertCircle, Sparkles, CircleDot } from "lucide-react";

import { AxisBadge } from "./AxisBadge";
import {
  AXIS_CLASSES,
  AXIS_LABEL,
  typologyApi,
  useAxisIdToKey,
  useCandidates,
  type DisagreementAxisKey,
  type TypologyCandidateDTO,
} from "./hooks";

const SEED_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  INTERVENTION_SEED: "From intervention",
  METRIC_SEED: "From metric",
  REPEATED_ATTACK_SEED: "Repeated attack",
  VALUE_LEXICON_SEED: "Value lexicon",
  IMPORTED: "Imported",
};

export interface TypologyCandidateQueueProps {
  sessionId: string;
  /** Optional cap. Defaults to all pending. */
  limit?: number;
  className?: string;
}

export function TypologyCandidateQueue({
  sessionId,
  limit,
  className,
}: TypologyCandidateQueueProps) {
  const { data, error, isLoading } = useCandidates(sessionId, "pending");
  const all = React.useMemo(() => data?.candidates ?? [], [data]);
  const candidates = limit ? all.slice(0, limit) : all;
  const axisIdToKey = useAxisIdToKey();

  const distribution = React.useMemo(() => {
    const m: Record<DisagreementAxisKey, number> = {
      VALUE: 0,
      EMPIRICAL: 0,
      FRAMING: 0,
      INTEREST: 0,
    };
    for (const c of all) {
      const key = axisIdToKey.get(c.suggestedAxisId);
      if (key) m[key] += 1;
    }
    return m;
  }, [all, axisIdToKey]);

  const refresh = React.useCallback(() => {
    void mutate(
      (key) =>
        typeof key === "string" &&
        key.includes(`/api/facilitation/sessions/${sessionId}/typology/candidates`),
      undefined,
      { revalidate: true },
    );
  }, [sessionId]);

  return (
    <Card
      className={`space-y-3 p-3 ${className ?? ""}`}
      role="region"
      aria-labelledby="typology-candidates-heading"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="typology-candidates-heading"
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"
        >
          <CircleDot className="h-3.5 w-3.5 text-violet-500" />
          Typology candidates
        </h3>
        <div className="flex flex-wrap items-center gap-1">
          {(Object.keys(distribution) as DisagreementAxisKey[]).map((k) =>
            distribution[k] > 0 ? (
              <AxisBadge key={k} axisKey={k} count={distribution[k]} />
            ) : null,
          )}
        </div>
      </div>

      <ul role="feed" aria-busy={isLoading} aria-label="Pending typology candidates" className="space-y-2">
        {candidates.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            axisIdToKey={axisIdToKey}
            onMutated={refresh}
          />
        ))}
      </ul>

      {!isLoading && !error && candidates.length === 0 && (
        <div
          className="flex items-center gap-2 rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600"
          role="status"
        >
          <Inbox className="h-3.5 w-3.5 text-slate-400" />
          <span>
            No candidates yet — seeders will surface suggestions as facilitation
            events accumulate.
          </span>
        </div>
      )}
      {error && (
        <div
          className="flex items-center justify-between gap-2 rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
          role="alert"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />
            Couldn&apos;t load candidates (network error).
          </span>
          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}
    </Card>
  );
}

// ─── Per-candidate card ─────────────────────────────────────────────────

function CandidateCard({
  candidate,
  axisIdToKey,
  onMutated,
}: {
  candidate: TypologyCandidateDTO;
  axisIdToKey: Map<string, DisagreementAxisKey>;
  onMutated: () => void;
}) {
  const axis = axisIdToKey.get(candidate.suggestedAxisId) ?? null;
  const palette = axis ? AXIS_CLASSES[axis] : null;
  const [promoteOpen, setPromoteOpen] = React.useState(false);
  const [dismissOpen, setDismissOpen] = React.useState(false);
  const hasTarget = !!candidate.targetType && !!candidate.targetId;

  return (
    <li>
      <Card className={`space-y-2 p-2.5 ${palette ? `${palette.border}` : ""}`}>
        <div className="flex flex-wrap items-baseline gap-1.5">
          {axis && <AxisBadge axisKey={axis} />}
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {SEED_LABELS[candidate.seedSource] ?? candidate.seedSource}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            priority {candidate.priority}
          </Badge>
          {!hasTarget && (
            <Badge variant="outline" className="text-[10px] text-amber-700">
              needs target
            </Badge>
          )}
        </div>
        <p className="text-xs text-slate-700">{candidate.rationaleText}</p>
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="flex mt-4">
            {candidate.ruleName}@{candidate.ruleVersion} ·{" "}
            {new Date(candidate.createdAt).toLocaleString()}
          </span>
          <div className="flex gap-4">
            <Button

              variant="outline"
              className="h-7 px-2 text-xs btnv2--ghost"
              disabled={!hasTarget}
              title={hasTarget ? "Promote to a tag" : "Add a target before promoting"}
              onClick={() => setPromoteOpen(true)}
            >
              Promote
            </Button>
            <Button

              variant="outline"
              className="h-7 px-2 text-xs mb-1 text-rose-700 btnv2--ghost"
              onClick={() => setDismissOpen(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </Card>

      <PromoteDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        candidate={candidate}
        axis={axis}
        onPromoted={onMutated}
      />
      <DismissDialog
        open={dismissOpen}
        onOpenChange={setDismissOpen}
        candidate={candidate}
        onDismissed={onMutated}
      />
    </li>
  );
}

// ─── Promote dialog (mini-tagger pre-filled) ─────────────────────────────

function PromoteDialog({
  open,
  onOpenChange,
  candidate,
  axis,
  onPromoted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: TypologyCandidateDTO;
  axis: DisagreementAxisKey | null;
  onPromoted: () => void;
}) {
  const [confidence, setConfidence] = React.useState(0.5);
  const [evidence, setEvidence] = React.useState(candidate.rationaleText);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setConfidence(0.5);
      setEvidence(candidate.rationaleText);
    }
  }, [open, candidate]);

  const submit = async () => {
    setBusy(true);
    try {
      await typologyApi.promoteCandidate(candidate.id, {
        confidence,
        evidenceText: evidence.trim() || candidate.rationaleText,
      });
      toast.success("Candidate promoted");
      onOpenChange(false);
      onPromoted();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle>Promote candidate</DialogTitle>
          <DialogDescription>
            Promotion creates a confirmed disagreement tag and advances the meta-consensus chain.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {axis && <AxisBadge axisKey={axis} />}
            <Badge variant="outline" className="text-[10px]">
              priority {candidate.priority}
            </Badge>
          </div>
          <div>
            <label
              htmlFor="promote-confidence"
              className="flex items-center justify-between text-[11px] font-medium text-slate-700"
            >
              <span>Confidence</span>
              <span className="font-mono">{confidence.toFixed(2)}</span>
            </label>
            <Slider
              id="promote-confidence"
              value={[confidence]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={(v) => setConfidence(v[0] ?? 0.5)}
            />
          </div>
          <div>
            <label htmlFor="promote-evidence" className="text-[11px] font-medium text-slate-700">
              Evidence
            </label>
            <Textarea
              id="promote-evidence"
              rows={3}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              maxLength={4000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Promote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DismissDialog({
  open,
  onOpenChange,
  candidate,
  onDismissed,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidate: TypologyCandidateDTO;
  onDismissed: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const submit = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await typologyApi.dismissCandidate(candidate.id, { reasonText: reason });
      toast.success("Candidate dismissed");
      onOpenChange(false);
      onDismissed();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle>Dismiss candidate</DialogTitle>
          <DialogDescription>
            Dismissals are recorded on the chain for auditability. Reason is required.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this not a disagreement worth typing?"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !reason.trim()}>
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
