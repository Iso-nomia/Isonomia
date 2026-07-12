"use client";

/**
 * HandoffDialog — C3.6
 *
 * Initiator side: pick a target facilitator (host + facilitator role
 * members), preview outstanding interventions and live metrics, supply a
 * brief reason. The receiving facilitator's accept flow lives in the
 * dedicated "Pending handoffs" surface (see `PendingHandoffsBanner` below).
 */

import * as React from "react";
import {
  facilitationApi,
  useFacilitationCurrentMetrics,
  useFacilitationInterventions,
} from "@/components/facilitation/hooks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { mutate } from "swr";
import useSWR from "swr";
import { METRIC_SPECS } from "@/components/facilitation/EquityPanel";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) =>
    r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
  );

interface FacilitatorOption {
  userId: string;
  displayName: string;
  role: "host" | "facilitator";
}

export interface HandoffDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deliberationId: string;
  sessionId: string;
}

export function HandoffDialog({
  open,
  onOpenChange,
  deliberationId,
  sessionId,
}: HandoffDialogProps) {
  // Facilitator/host roster — relies on a generic endpoint surface
  // (`/api/deliberations/:id/facilitators`). If the endpoint is absent the
  // dialog gracefully degrades to a free-text user-id input.
  const { data: roster } = useSWR<{ items: FacilitatorOption[] }>(
    open ? `/api/deliberations/${deliberationId}/facilitators` : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const { data: pending } = useFacilitationInterventions(open ? sessionId : null, "PENDING");
  const { data: metrics } = useFacilitationCurrentMetrics(open ? deliberationId : null);

  const [toUserId, setToUserId] = React.useState("");
  const [notesText, setNotesText] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setToUserId("");
      setNotesText("");
    }
  }, [open]);

  const submit = async () => {
    if (!toUserId.trim() || !notesText.trim()) {
      toast.error("Recipient and notes are required");
      return;
    }
    setBusy(true);
    try {
      await facilitationApi.initiateHandoff(sessionId, {
        toUserId: toUserId.trim(),
        notesText: notesText.trim(),
      });
      toast.success("Handoff requested");
      mutate(`/api/facilitation/sessions/${sessionId}/events?limit=200`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to initiate handoff");
    } finally {
      setBusy(false);
    }
  };

  const snapshotsByKind = new Map(
    (metrics?.snapshots ?? []).filter(Boolean).map((s) => [s!.metricKind, s!]),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white">
        <DialogHeader>
          <DialogTitle>Hand off facilitation</DialogTitle>
          <DialogDescription>
            The recipient will accept or decline. Until then your session
            remains active but locked from new interventions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Recipient
            </label>
            {roster && roster.items.length > 0 ? (
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a facilitator…" />
                </SelectTrigger>
                <SelectContent>
                  {roster.items.map((f) => (
                    <SelectItem key={f.userId} value={f.userId}>
                      {f.displayName} · {f.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <input
                value={toUserId}
                onChange={(e) => setToUserId(e.target.value)}
                placeholder="user id"
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Notes
            </label>
            <Textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={2}
              placeholder="Brief notes — recorded in the audit chain."
            />
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-2">
            <h4 className="mb-1 text-xs font-medium text-slate-700">
              Snapshot at handoff
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {METRIC_SPECS.map((spec) => {
                const s = snapshotsByKind.get(spec.kind);
                return (
                  <Badge key={spec.kind} variant="outline" className="text-[10px]">
                    {spec.label}: {s ? spec.format(s.value) : "—"}
                  </Badge>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-slate-600">
              {pending?.items?.length ?? 0} pending intervention(s) will carry
              over.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button className="bg-white" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-indigo-50"
            onClick={submit}
            disabled={busy || !toUserId.trim() || !notesText.trim()}
          >
            Request handoff
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Receiver-side accept/decline banner ─────────────────────────────────

export interface PendingHandoff {
  id: string;
  fromSessionId: string;
  fromUserId: string;
  toUserId: string;
  notesText: string | null;
  createdAt: string;
}

export function PendingHandoffsBanner({
  deliberationId,
}: {
  deliberationId: string;
}) {
  const { data, mutate: refresh } = useSWR<{ items: PendingHandoff[] }>(
    `/api/deliberations/${deliberationId}/facilitation/handoffs?status=PENDING&forMe=1`,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  const accept = async (id: string) => {
    try {
      await facilitationApi.acceptHandoff(id);
      toast.success("Handoff accepted");
      refresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Failed");
    }
  };
  const decline = async (id: string) => {
    try {
      await facilitationApi.declineHandoff(id, { notesText: "declined" });
      toast.success("Handoff declined");
      refresh();
    } catch (e) {
      toast.error((e as Error).message ?? "Failed");
    }
  };

  return (
    <div
      role="region"
      aria-label="Pending handoffs"
      className="flex flex-col gap-1 border-b border-amber-300 bg-amber-50 px-3 py-2"
    >
      {items.map((h) => (
        <div key={h.id} className="flex items-center gap-2 text-sm">
          <Badge className="bg-amber-200 text-amber-900 hover:bg-amber-200">
            Handoff
          </Badge>
          <span className="flex-1 text-amber-900">
            {h.notesText || "Facilitator requests a handoff."}
          </span>
          <Button className="bg-white" variant="outline" onClick={() => decline(h.id)}>
            Decline
          </Button>
          <Button className="bg-indigo-50" onClick={() => accept(h.id)}>
            Accept
          </Button>
        </div>
      ))}
    </div>
  );
}
