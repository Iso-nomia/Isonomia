"use client";

/**
 * InterventionCard + InterventionQueue — C3.4
 *
 * Right column of the cockpit. Renders pending interventions as actionable
 * cards (Apply / Dismiss) with a collapsible history drawer for resolved
 * cards. Dismissal requires a reason; reason tag is optional (decision #4).
 */

import * as React from "react";
import {
  facilitationApi,
  useFacilitationInterventions,
  type FacilitationInterventionDTO,
} from "@/components/facilitation/hooks";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { mutate } from "swr";
import { toast } from "sonner";

const KIND_LABELS: Record<string, string> = {
  PROMPT_QUIET_AUTHORS: "Prompt quiet authors",
  REQUEST_RESPONSES: "Request responses to stale claims",
  REFRAME_QUESTION: "Reframe the question",
  PAUSE_AND_SUMMARIZE: "Pause & summarize",
  ROTATE_FACILITATOR: "Rotate facilitator",
};

const REASON_TAGS = [
  { value: "not_relevant", label: "Not relevant" },
  { value: "already_addressed", label: "Already addressed" },
  { value: "wrong_target", label: "Wrong target" },
  { value: "other", label: "Other" },
];

function priorityFromKind(kind: string): "low" | "med" | "high" {
  if (kind === "PAUSE_AND_SUMMARIZE" || kind === "ROTATE_FACILITATOR") return "high";
  if (kind === "REFRAME_QUESTION") return "med";
  return "low";
}

function PriorityPip({ kind }: { kind: string }) {
  const p = priorityFromKind(kind);
  const cls =
    p === "high"
      ? "bg-rose-500"
      : p === "med"
        ? "bg-amber-500"
        : "bg-slate-400";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${cls}`}
      aria-label={`priority ${p}`}
    />
  );
}

interface DismissDialogState {
  intervention: FacilitationInterventionDTO | null;
  reasonText: string;
  reasonTag: string;
}

export interface InterventionCardProps {
  intervention: FacilitationInterventionDTO;
  sessionId: string;
  onApply: () => Promise<void> | void;
  onDismiss: () => void;
  busy?: boolean;
}

export function InterventionCard({
  intervention,
  onApply,
  onDismiss,
  busy,
}: InterventionCardProps) {
  const i = intervention;
  const headline = i.rationaleJson?.headline ?? KIND_LABELS[i.kind] ?? i.kind;
  return (
    <Card className="space-y-2 p-3" role="article" aria-label={headline}>
      <div className="flex items-start gap-2">
        <PriorityPip kind={i.kind} />
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <h4 className="text-sm font-medium text-slate-800">{headline}</h4>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {i.kind.toLowerCase().replace(/_/g, " ")}
            </Badge>
          </div>
          {i.rationaleJson?.details && (
            <p className="mt-1 text-xs text-slate-600">{i.rationaleJson.details}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span>target: {i.targetType.toLowerCase()}</span>
            <span>· {new Date(i.recommendedAt).toLocaleTimeString()}</span>
            {i.triggeredByMetric && (
              <Badge variant="outline" className="text-[10px]">
                {i.triggeredByMetric.toLowerCase()}
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button className="bg-white" variant="outline" onClick={onDismiss} disabled={busy}>
          Dismiss
        </Button>
        <Button className="bg-indigo-50" onClick={onApply} disabled={busy}>
          Apply
        </Button>
      </div>
    </Card>
  );
}

function HistoryRow({ i }: { i: FacilitationInterventionDTO }) {
  const status = i.appliedAt ? "applied" : i.dismissedAt ? "dismissed" : "pending";
  const headline = i.rationaleJson?.headline ?? KIND_LABELS[i.kind] ?? i.kind;
  return (
    <li className="flex items-baseline gap-2 py-1 text-xs">
      <Badge
        variant="outline"
        className={
          status === "applied"
            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
            : status === "dismissed"
              ? "border-slate-300 bg-slate-50 text-slate-600"
              : "border-amber-300 bg-amber-50 text-amber-700"
        }
      >
        {status}
      </Badge>
      <span className="flex-1 truncate text-slate-700">{headline}</span>
      <span className="text-slate-400">
        {new Date(i.appliedAt ?? i.dismissedAt ?? i.recommendedAt).toLocaleTimeString()}
      </span>
    </li>
  );
}

export interface InterventionQueueProps {
  sessionId: string | null;
  className?: string;
}

export function InterventionQueue({ sessionId, className }: InterventionQueueProps) {
  const { data, error, isLoading } = useFacilitationInterventions(sessionId, "PENDING");
  const { data: applied } = useFacilitationInterventions(sessionId, "APPLIED");
  const { data: dismissed } = useFacilitationInterventions(sessionId, "DISMISSED");

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [dismissState, setDismissState] = React.useState<DismissDialogState>({
    intervention: null,
    reasonText: "",
    reasonTag: "other",
  });

  const refresh = React.useCallback(() => {
    if (!sessionId) return;
    mutate(`/api/facilitation/sessions/${sessionId}/interventions?status=PENDING`);
    mutate(`/api/facilitation/sessions/${sessionId}/interventions?status=APPLIED`);
    mutate(`/api/facilitation/sessions/${sessionId}/interventions?status=DISMISSED`);
    mutate(`/api/facilitation/sessions/${sessionId}/events?limit=200`);
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="text-sm text-slate-500 italic">No active session.</div>
    );
  }

  const pending = data?.items ?? [];
  const history = [...(applied?.items ?? []), ...(dismissed?.items ?? [])].sort(
    (a, b) =>
      new Date(b.appliedAt ?? b.dismissedAt ?? b.recommendedAt).getTime() -
      new Date(a.appliedAt ?? a.dismissedAt ?? a.recommendedAt).getTime(),
  );

  const handleApply = async (i: FacilitationInterventionDTO) => {
    setBusyId(i.id);
    try {
      await facilitationApi.applyIntervention(i.id);
      toast.success("Intervention applied");
      refresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to apply");
    } finally {
      setBusyId(null);
    }
  };

  const handleDismissSubmit = async () => {
    const i = dismissState.intervention;
    if (!i) return;
    if (!dismissState.reasonText.trim()) {
      toast.error("Reason required");
      return;
    }
    setBusyId(i.id);
    try {
      await facilitationApi.dismissIntervention(i.id, {
        reasonText: dismissState.reasonText.trim(),
        reasonTag: dismissState.reasonTag,
      });
      toast.success("Intervention dismissed");
      setDismissState({ intervention: null, reasonText: "", reasonTag: "other" });
      refresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to dismiss");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      className={`flex h-full flex-col ${className ?? ""}`}
      aria-label="Intervention queue"
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h3 className="text-sm font-medium text-slate-800">Interventions</h3>
        <Badge variant="outline">{pending.length} pending</Badge>
      </header>
      <div role="feed" aria-busy={isLoading} className="flex-1 space-y-2 overflow-auto p-3">
        {isLoading && !data && <div className="text-sm text-slate-500">Loading…</div>}
        {error && (
          <div className="text-sm text-rose-600">
            Failed: {(error as Error).message}
          </div>
        )}
        {!isLoading && !error && pending.length === 0 && (
          <div className="text-sm text-slate-500 italic">No recommendations right now.</div>
        )}
        {pending.map((i) => (
          <InterventionCard
            key={i.id}
            intervention={i}
            sessionId={sessionId}
            busy={busyId === i.id}
            onApply={() => handleApply(i)}
            onDismiss={() =>
              setDismissState({ intervention: i, reasonText: "", reasonTag: "other" })
            }
          />
        ))}
      </div>
      <Collapsible className="border-t border-slate-200">
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
          <ChevronDown className="h-3.5 w-3.5" />
          History ({history.length})
        </CollapsibleTrigger>
        <CollapsibleContent className="max-h-48 overflow-auto px-3 pb-2">
          <ul>
            {history.length === 0 && (
              <li className="py-2 text-xs italic text-slate-500">No history.</li>
            )}
            {history.map((i) => (
              <HistoryRow key={i.id} i={i} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>

      <Dialog
        open={!!dismissState.intervention}
        onOpenChange={(o) =>
          !o && setDismissState({ intervention: null, reasonText: "", reasonTag: "other" })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss intervention</DialogTitle>
            <DialogDescription>
              Provide a brief reason. This is recorded in the audit chain.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Select
              value={dismissState.reasonTag}
              onValueChange={(v) =>
                setDismissState((s) => ({ ...s, reasonTag: v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Reason tag" />
              </SelectTrigger>
              <SelectContent>
                {REASON_TAGS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              autoFocus
              placeholder="Why are you dismissing this?"
              value={dismissState.reasonText}
              onChange={(e) =>
                setDismissState((s) => ({ ...s, reasonText: e.target.value }))
              }
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDismissState({ intervention: null, reasonText: "", reasonTag: "other" })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={handleDismissSubmit}
              disabled={!dismissState.reasonText.trim()}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
