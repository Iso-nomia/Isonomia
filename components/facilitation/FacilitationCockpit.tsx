"use client";

/**
 * FacilitationCockpit — C3.1
 *
 * Three-column layout assembling EquityPanel, FacilitationTimeline,
 * InterventionQueue, plus session controls (open/close/handoff) and the
 * compact QuestionAuthoring card. Bootstraps via
 * GET /api/deliberations/:id/facilitation/sessions.
 */

import * as React from "react";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import { EquityPanel } from "@/components/facilitation/EquityPanel";
import { FacilitationTimeline } from "@/components/facilitation/FacilitationTimeline";
import { InterventionQueue } from "@/components/facilitation/InterventionQueue";
import { QuestionAuthoring } from "@/components/facilitation/QuestionAuthoring";
import {
  HandoffDialog,
  PendingHandoffsBanner,
} from "@/components/facilitation/HandoffDialog";
import {
  facilitationApi,
  type FacilitationQuestionDTO,
  type FacilitationSessionDTO,
} from "@/components/facilitation/hooks";
import { TypologyCandidateQueue } from "@/components/typology/TypologyCandidateQueue";
import { MetaConsensusEditor } from "@/components/typology/MetaConsensusEditor";
import { AxisBadge } from "@/components/typology/AxisBadge";
import {
  useAxes,
  useTags,
  type DisagreementAxisKey,
} from "@/components/typology/hooks";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Sparkles } from "lucide-react";

interface CockpitContext {
  session: FacilitationSessionDTO | null;
  question: FacilitationQuestionDTO | null;
  parentText: string | null;
  canManage: boolean;
}

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export interface FacilitationCockpitProps {
  deliberationId: string;
}

export function FacilitationCockpit({ deliberationId }: FacilitationCockpitProps) {
  const ctxKey = `/api/deliberations/${deliberationId}/facilitation/sessions`;
  const { data, error, isLoading } = useSWR<CockpitContext>(ctxKey, fetcher, {
    refreshInterval: 5000,
    revalidateOnFocus: false,
  });

  const session = data?.session ?? null;
  const question = data?.question ?? null;
  const canManage = data?.canManage ?? false;

  const [openSessionDialog, setOpenSessionDialog] = React.useState(false);
  const [closeDialog, setCloseDialog] = React.useState(false);
  const [handoffOpen, setHandoffOpen] = React.useState(false);

  const refetch = React.useCallback(() => {
    mutate(ctxKey);
  }, [ctxKey]);

  if (isLoading && !data) {
    return (
      <div className="p-6 text-sm text-slate-500">Loading facilitation dashboard…</div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-sm text-rose-600">
        Failed to load cockpit: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PendingHandoffsBanner deliberationId={deliberationId} />

      {/* Header bar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Facilitation dashboard
          </h2>
          <div className="text-xs text-slate-500">
            {session ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                Session active since {new Date(session.openedAt).toLocaleString()}
              </span>
            ) : (
              <span>No active session.</span>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {session?.isPublic && <Badge className="mt-2" variant="outline">Public read</Badge>}
          {!session && canManage && (
            <Button className="bg-indigo-50" onClick={() => setOpenSessionDialog(true)}>
              Open session
            </Button>
          )}
          {session && canManage && (
            <>
              <Button className="bg-indigo-50" variant="outline" onClick={() => setHandoffOpen(true)}>
                Handoff
              </Button>
              <Button
                className="bg-indigo-50"
                variant="outline"
                onClick={() => setCloseDialog(true)}
              >
                Close session
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Question authoring strip */}
      {canManage && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <QuestionAuthoring
            deliberationId={deliberationId}
            sessionId={session?.id ?? null}
            question={question}
            parentText={data?.parentText ?? null}
            onMutate={refetch}
          />
        </div>
      )}

      {/* Three-column layout */}
      <div className="grid flex-1 min-h-0 grid-cols-1 gap-px overflow-hidden bg-slate-200 md:grid-cols-[300px_1fr_360px]">
        <div className="min-h-0 overflow-hidden bg-white">
          <EquityPanel deliberationId={deliberationId} />
        </div>
        <div className="min-h-0 overflow-hidden bg-white">
          <FacilitationTimeline sessionId={session?.id ?? null} />
        </div>
        <div className="min-h-0 overflow-hidden bg-white">
          <InterventionQueue sessionId={session?.id ?? null} />
        </div>
      </div>

      {/* Typology / meta-consensus tile (default collapsed) */}
      <TypologySection
        deliberationId={deliberationId}
        sessionId={session?.id ?? null}
        canDraft={canManage}
      />

      {/* Session controls */}
      <OpenSessionDialog
        open={openSessionDialog}
        onOpenChange={setOpenSessionDialog}
        deliberationId={deliberationId}
        onDone={refetch}
      />
      <CloseSessionDialog
        open={closeDialog}
        onOpenChange={setCloseDialog}
        sessionId={session?.id ?? null}
        onDone={refetch}
      />
      {session && (
        <HandoffDialog
          open={handoffOpen}
          onOpenChange={setHandoffOpen}
          deliberationId={deliberationId}
          sessionId={session.id}
        />
      )}
    </div>
  );
}

function OpenSessionDialog({
  open,
  onOpenChange,
  deliberationId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  deliberationId: string;
  onDone: () => void;
}) {
  const [isPublic, setIsPublic] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await facilitationApi.openSession(deliberationId, {
        isPublic,
        summary: notes.trim() || undefined,
      });
      toast.success("Session opened");
      onOpenChange(false);
      setNotes("");
      setIsPublic(false);
      onDone();
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to open session");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open facilitation session</DialogTitle>
          <DialogDescription>
            You will be the active facilitator. The session is hash-chained
            from the first event.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              id="isPublic"
              checked={isPublic}
              onCheckedChange={(v) => setIsPublic(!!v)}
            />
            <Label htmlFor="isPublic">Allow public read (redacted)</Label>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Opening notes (optional)"
          />
        </div>
        <DialogFooter>
          <Button className="bg-white" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-indigo-50" onClick={submit} disabled={busy}>
            Open session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseSessionDialog({
  open,
  onOpenChange,
  sessionId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sessionId: string | null;
  onDone: () => void;
}) {
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const submit = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      await facilitationApi.closeSession(sessionId, {
        summary: notes.trim() || undefined,
      });
      toast.success("Session closed");
      onOpenChange(false);
      setNotes("");
      onDone();
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to close");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close session?</DialogTitle>
          <DialogDescription>
            Final metric snapshots and the report will be generated. The
            session cannot be reopened.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Closing summary (optional)"
        />
        <DialogFooter>
          <Button className="bg-white" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-indigo-50" onClick={submit} disabled={busy}>
            Close session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Typology section (B3.5) ────────────────────────────────────────────

function TypologySection({
  deliberationId,
  sessionId,
  canDraft,
}: {
  deliberationId: string;
  sessionId: string | null;
  canDraft: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [draftOpen, setDraftOpen] = React.useState(false);

  const axes = useAxes();
  const { data: tagsData } = useTags(deliberationId, { sessionId });
  const tags = React.useMemo(() => tagsData?.tags ?? [], [tagsData]);

  const distribution = React.useMemo(() => {
    const m: Record<DisagreementAxisKey, number> = {
      VALUE: 0,
      EMPIRICAL: 0,
      FRAMING: 0,
      INTEREST: 0,
    };
    const idToKey = new Map(
      (axes.data?.axes ?? []).map((a) => [a.id, a.key as DisagreementAxisKey]),
    );
    for (const t of tags) {
      const key = idToKey.get(t.axisId);
      if (key) m[key] += 1;
    }
    return m;
  }, [tags, axes.data]);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-t border-slate-200 bg-white"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50"
          aria-label="Toggle typology section"
        >
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="font-medium text-slate-800">Typology &amp; meta-consensus</span>
          <div className="ml-2 flex flex-wrap items-center gap-1">
            {(Object.keys(distribution) as DisagreementAxisKey[]).map((k) =>
              distribution[k] > 0 ? (
                <AxisBadge key={k} axisKey={k} count={distribution[k]} />
              ) : null,
            )}
          </div>
          <ChevronDown
            className={`ml-auto h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 bg-slate-50 p-3 md:grid-cols-2">
          <div>
            {sessionId ? (
              <TypologyCandidateQueue sessionId={sessionId} />
            ) : (
              <div className="rounded border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
                Open a session to view typology candidates.
              </div>
            )}
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <div className="rounded border border-slate-200 bg-white p-3 text-xs text-slate-600">
              <p className="mb-2">
                Draft a meta-consensus summary that freezes a canonical snapshot of
                agreed/disagreed points and supporting tags onto the chain.
              </p>
              {canDraft ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDraftOpen(true)}
                >
                  Draft summary…
                </Button>
              ) : (
                <p className="text-slate-500">Facilitator role required.</p>
              )}
            </div>
          </div>
        </div>
      </CollapsibleContent>

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Meta-consensus summary</DialogTitle>
            <DialogDescription>
              Capture the room&apos;s agreements and typed disagreements. Publishing
              freezes the snapshot on the meta-consensus chain.
            </DialogDescription>
          </DialogHeader>
          <MetaConsensusEditor
            deliberationId={deliberationId}
            sessionId={sessionId}
            onPublished={() => setDraftOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
