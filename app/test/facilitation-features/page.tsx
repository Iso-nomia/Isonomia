"use client";

/**
 * Facilitation features demo — Scope C exit surface.
 *
 * Static showcase of every Scope C facilitation component in isolation, plus
 * read-only inspectors for the Phase C4 service surfaces (analytics + canonical
 * export). Mirrors `app/test/pathways-features/page.tsx` in spirit.
 *
 * The page accepts a deliberation id either via `?deliberationId=<cuid>` or
 * via the inline input below — the input persists to localStorage so a
 * reviewer can refresh without retyping.
 *
 * Phase coverage:
 *   C2  — services + APIs (consumed indirectly)
 *   C3  — UI components (Cockpit, Equity, Timeline, Interventions,
 *         Question authoring, Handoff dialog, Pending banner, Report)
 *   C4  — analytics endpoint + canonical export endpoint inspectors
 *
 * Accessible at: /test/facilitation-features
 */

import * as React from "react";
import useSWR from "swr";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  AlertCircle,
  Check,
  Circle,
  Download,
  GitBranch,
  Hash,
  ListChecks,
  MessageSquare,
  Radio,
  Scale,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { Toaster, toast } from "sonner";

import { ChainValidityBadge } from "@/components/facilitation/ChainValidityBadge";
import { EquityPanel } from "@/components/facilitation/EquityPanel";
import { FacilitationTimeline } from "@/components/facilitation/FacilitationTimeline";
import { InterventionQueue } from "@/components/facilitation/InterventionQueue";
import { FacilitationCockpit } from "@/components/facilitation/FacilitationCockpit";
import { FacilitationReport } from "@/components/facilitation/FacilitationReport";
import { EquityWarningChip } from "@/components/facilitation/EquityWarningChip";
import { QuestionAuthoring } from "@/components/facilitation/QuestionAuthoring";
import {
  HandoffDialog,
  PendingHandoffsBanner,
} from "@/components/facilitation/HandoffDialog";
import type { FacilitationQuestionDTO } from "@/components/facilitation/hooks";

// ─── Deliberation id wiring ─────────────────────────────────────────────

const STORAGE_KEY = "facilitation-demo:deliberationId";

function useDeliberationIdState(): [string | null, (s: string | null) => void] {
  const [id, setId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQs = params.get("deliberationId");
    const fromLs =
      typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    setId(fromQs || fromLs || null);
  }, []);

  const update = React.useCallback((next: string | null) => {
    setId(next);
    if (typeof window === "undefined") return;
    if (next) window.localStorage.setItem(STORAGE_KEY, next);
    else window.localStorage.removeItem(STORAGE_KEY);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("deliberationId", next);
    else url.searchParams.delete("deliberationId");
    window.history.replaceState({}, "", url.toString());
  }, []);

  return [id, update];
}

// ─── Cockpit context fetch ──────────────────────────────────────────────

interface CockpitContext {
  session: { id: string; status: string; openedAt: string } | null;
  question: FacilitationQuestionDTO | null;
  parentText: string | null;
  canManage: boolean;
}

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });

function useCockpitContext(deliberationId: string | null) {
  return useSWR<CockpitContext>(
    deliberationId
      ? `/api/deliberations/${deliberationId}/facilitation/sessions`
      : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
}

// ─── Page ───────────────────────────────────────────────────────────────

export default function FacilitationFeaturesPage() {
  const [deliberationId, setDeliberationId] = useDeliberationIdState();
  const [draft, setDraft] = React.useState("");
  React.useEffect(() => {
    if (deliberationId) setDraft(deliberationId);
  }, [deliberationId]);

  const { data: ctx, error: ctxError, mutate: refreshCtx } = useCockpitContext(deliberationId);
  const sessionId = ctx?.session?.id ?? null;

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(145deg, #f5faff 0%, #eef5ff 25%, #f0f8f4 60%, #f5fff8 100%)",
      }}
    >
      <Toaster position="top-right" />

      <StickyHeader />

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <ContextBanner
          deliberationId={deliberationId}
          draft={draft}
          setDraft={setDraft}
          onApply={() => setDeliberationId(draft.trim() || null)}
          onClear={() => {
            setDraft("");
            setDeliberationId(null);
          }}
        />

        <PhaseLegend />

        {deliberationId && (
          <>
            {ctxError && <ContextErrorBanner error={ctxError as Error} />}
            <PendingHandoffsBanner deliberationId={deliberationId} />
            <SessionStatusStrip
              deliberationId={deliberationId}
              ctx={ctx ?? null}
            />
          </>
        )}

        <PrimitivesRow deliberationId={deliberationId} />

        <Tabs defaultValue="cockpit" className="space-y-4">
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList className="bg-white border shadow-sm">
              <TabsTrigger value="cockpit" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="equity" className="gap-1.5">
                <Scale className="h-3.5 w-3.5" />
                Equity
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5">
                <Hash className="h-3.5 w-3.5" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="interventions" className="gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                Interventions
              </TabsTrigger>
              <TabsTrigger value="question" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Question
              </TabsTrigger>
              <TabsTrigger value="handoff" className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Handoff
              </TabsTrigger>
              <TabsTrigger value="report" className="gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                Report
              </TabsTrigger>
              <TabsTrigger value="c4" className="gap-1.5">
                <Radio className="h-3.5 w-3.5" />
                C4 surfaces
              </TabsTrigger>
            </TabsList>
          </div>

        <TabsContent value="cockpit">
          <FullHeightCard>
            {deliberationId ? (
              <FacilitationCockpit deliberationId={deliberationId} />
            ) : (
              <EmptyHint />
            )}
          </FullHeightCard>
        </TabsContent>

        <TabsContent value="equity">
          <FullHeightCard tall={false}>
            {deliberationId ? (
              <EquityPanel deliberationId={deliberationId} />
            ) : (
              <EmptyHint />
            )}
          </FullHeightCard>
        </TabsContent>

        <TabsContent value="timeline">
          <FullHeightCard tall={false}>
            {!deliberationId ? (
              <EmptyHint />
            ) : sessionId ? (
              <div className="p-4">
                <FacilitationTimeline sessionId={sessionId} />
              </div>
            ) : (
              <NoActiveSessionHint />
            )}
          </FullHeightCard>
        </TabsContent>

        <TabsContent value="interventions">
          <FullHeightCard tall={false}>
            {!deliberationId ? (
              <EmptyHint />
            ) : sessionId ? (
              <div className="p-4">
                <InterventionQueue sessionId={sessionId} />
              </div>
            ) : (
              <NoActiveSessionHint />
            )}
          </FullHeightCard>
        </TabsContent>

        <TabsContent value="question">
          <FullHeightCard tall={false}>
            {deliberationId ? (
              <div className="p-4">
                <QuestionAuthoring
                  deliberationId={deliberationId}
                  sessionId={sessionId}
                  question={ctx?.question ?? null}
                  parentText={ctx?.parentText ?? null}
                  onMutate={() => void refreshCtx()}
                />
              </div>
            ) : (
              <EmptyHint />
            )}
          </FullHeightCard>
        </TabsContent>

        <TabsContent value="handoff">
          <FullHeightCard tall={false}>
            {!deliberationId ? (
              <EmptyHint />
            ) : sessionId ? (
              <HandoffDemo
                deliberationId={deliberationId}
                sessionId={sessionId}
              />
            ) : (
              <NoActiveSessionHint />
            )}
          </FullHeightCard>
        </TabsContent>

        <TabsContent value="report">
          {deliberationId ? (
            <FacilitationReport deliberationId={deliberationId} />
          ) : (
            <EmptyHint />
          )}
        </TabsContent>

          <TabsContent value="c4">
            <C4Surfaces deliberationId={deliberationId} sessionId={sessionId} />
          </TabsContent>
        </Tabs>

        <DemoFooter />
      </main>
    </div>
  );
}

// ─── Sticky header + context banner ─────────────────────────────────────

function StickyHeader() {
  return (
    <div
      className="sticky top-0 z-40 border-b border-slate-900/[0.07] bg-white/85 px-6 py-4 backdrop-blur-xl"
      style={{
        boxShadow:
          "0 1px 3px rgba(56,189,248,0.06), 0 4px 16px -8px rgba(56,189,248,0.08)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <div className="rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 p-1.5">
              <Activity className="h-5 w-5 text-white" />
            </div>
            Facilitation features
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Scope C exit surface ·{" "}
        
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600 text-white shadow-sm hover:bg-emerald-600">
            <Check className="mr-1 h-3 w-3" />
            Scope C ready
          </Badge>
          <Badge variant="outline" className="text-slate-500">
            8 surfaces
          </Badge>
          <Badge variant="outline" className="text-slate-500">
            C4.3 deferred
          </Badge>
        </div>
      </div>
    </div>
  );
}

function DemoFooter() {
  return (
    <footer className="flex items-center justify-between border-t border-slate-900/[0.06] py-6 text-xs text-slate-400">
      <span className="font-medium text-slate-500">
        Facilitation features — Scope C demo
      </span>
      <div className="flex items-center gap-3">
        <a
          href="/test/pathways-features"
          className="text-indigo-500 hover:underline"
        >
          Pathways demo →
        </a>
        <span className="text-slate-300">·</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
          C4.3 broadcast deferred
        </span>
        <span className="text-slate-300">·</span>
        <span>April 2026</span>
      </div>
    </footer>
  );
}

// ─── Context banner (id picker) ─────────────────────────────────────────

function ContextBanner({
  deliberationId,
  draft,
  setDraft,
  onApply,
  onClear,
}: {
  deliberationId: string | null;
  draft: string;
  setDraft: (s: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <section className="rounded-xl border border-sky-100/80 bg-gradient-to-r from-sky-100 via-indigo-50 to-sky-100 p-5">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 p-2.5 text-white">
          <Circle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="mb-1 text-base font-semibold text-slate-900">
            Pick a deliberation to wake the surfaces.
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Each tab renders a Scope C component against the deliberation
            below. With no id selected, components render their empty /
            loading states so layout can be reviewed in isolation. The
            selection persists to localStorage and the URL — refresh-safe.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="deliberationId (cuid, not slug)"
              className="max-w-xs border-white/80 bg-white/80 font-mono text-xs articlesearchfield mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") onApply();
              }}
            />
            <Button

              className="bg-blue-500 text-white shadow-sm hover:bg-slate-400"
              onClick={onApply}
              disabled={!draft.trim()}
            >
              Use
            </Button>
            <Button

              variant="ghost"
              onClick={onClear}
              disabled={!deliberationId}
            >
              Clear
            </Button>
            <DeliberationPickerButton onPick={(id) => setDraft(id)} />
            {deliberationId && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 font-mono text-[11px] mt-2 font-medium text-emerald-700">
                <Check className="h-3 w-3" />
                {deliberationId}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DeliberationPickerButton({ onPick }: { onPick: (id: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const { data, error, isLoading } = useSWR<{
    items: Array<{ id: string; title: string | null; hostType: string; updatedAt: string }>;
  }>(open ? "/api/deliberations?mine=1&pageSize=20" : null, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  return (
    <div className="relative">
      <Button className="bg-slate-200" variant="outline" onClick={() => setOpen((o) => !o)}>
        Browse mine
      </Button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-80 rounded border border-slate-200 bg-white p-2 shadow-lg">
          {isLoading && <div className="text-xs text-slate-500">Loading…</div>}
          {error && (
            <div className="text-xs text-rose-600">
              {(error as Error).message} — sign in first.
            </div>
          )}
          {data && data.items.length === 0 && (
            <div className="text-xs text-slate-500">
              You haven&apos;t created any deliberations yet.
            </div>
          )}
          <ul className="max-h-72 space-y-0.5 overflow-y-auto">
            {data?.items.map((d) => (
              <li key={d.id}>
                <button
                  className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                  onClick={() => {
                    onPick(d.id);
                    setOpen(false);
                  }}
                >
                  <div className="font-mono text-[10px] text-slate-700">
                    {d.id}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {d.hostType} · updated {new Date(d.updatedAt).toLocaleDateString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PhaseLegend() {
  const phases: Array<{
    code: string;
    label: string;
    chip: string;
    dot: string;
  }> = [
    {
      code: "C2",
      label: "Services + REST surfaces (consumed by every tab)",
      chip: "bg-sky-100 text-sky-700 border-sky-200",
      dot: "bg-sky-400",
    },
    {
      code: "C3",
      label:
        "Dashboard, Equity, Timeline, Interventions, Question, Handoff, Report",
      chip: "bg-emerald-100 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-400",
    },
    {
      code: "C4",
      label: "Analytics + canonical export (read-only inspectors)",
      chip: "bg-violet-100 text-violet-700 border-violet-200",
      dot: "bg-violet-400",
    },
  ];
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Users className="h-3.5 w-3.5" /> Phase coverage
      </h2>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {phases.map((p) => (
          <div
            key={p.code}
            className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-100/60 p-2.5"
          >
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${p.chip}`}
            >
              {p.code}
            </span>
            <span className="text-xs leading-snug text-slate-600">
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Status strip ───────────────────────────────────────────────────────

function SessionStatusStrip({
  deliberationId: _deliberationId,
  ctx,
}: {
  deliberationId: string;
  ctx: CockpitContext | null;
}) {
  const session = ctx?.session ?? null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatusTile
          label="Active session"
          icon={<Activity className="h-3.5 w-3.5 text-emerald-600" />}
        >
          {session ? (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                {session.status}
              </Badge>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                {session.id}
              </code>
              <span className="text-slate-500">
                opened {new Date(session.openedAt).toLocaleString()}
              </span>
            </div>
          ) : (
            <span className="text-xs text-slate-500">
              none — open one from the Dashboard tab
            </span>
          )}
        </StatusTile>
        <StatusTile
          label="Question"
          icon={<MessageSquare className="h-3.5 w-3.5 text-sky-600" />}
        >
          {ctx?.question ? (
            <Badge variant="outline" className="text-xs">
              v{ctx.question.version} ·{" "}
              {ctx.question.lockedAt ? "locked" : "draft"}
            </Badge>
          ) : (
            <span className="text-xs text-slate-500">none</span>
          )}
        </StatusTile>
        <StatusTile
          label="Manage permission"
          icon={<Users className="h-3.5 w-3.5 text-violet-600" />}
        >
          {ctx?.canManage ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px]  font-semibold text-emerald-700">
              <Check className="h-3 w-3" />
              yes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500">
              no
            </span>
          )}
        </StatusTile>
      </div>
    </section>
  );
}

function StatusTile({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Primitives row ─────────────────────────────────────────────────────

function PrimitivesRow({ deliberationId }: { deliberationId: string | null }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <GitBranch className="h-3.5 w-3.5" /> Primitives
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <ChainValidityBadge valid={true} chainLabel="demo chain" />
        <ChainValidityBadge
          valid={false}
          failedIndex={3}
          chainLabel="demo chain"
        />
        <ChainValidityBadge valid={null} chainLabel="demo chain" />
        {deliberationId && (
          <>
            <Separator orientation="vertical" className="h-5" />
            <span className="text-xs text-slate-500">EquityWarningChip:</span>
            <EquityWarningChip
              deliberationId={deliberationId}
              targetType="claim"
              targetId="demo-claim"
            />
            <EquityWarningChip
              deliberationId={deliberationId}
              targetType="author"
              targetId="demo-author"
            />
            <span className="text-[10px] text-slate-400">
              (silent unless a real metric breakdown lists the demo id)
            </span>
          </>
        )}
      </div>
    </section>
  );
}

// ─── Tab helpers ────────────────────────────────────────────────────────

function FullHeightCard({
  children,
  tall = true,
}: {
  children: React.ReactNode;
  tall?: boolean;
}) {
  return (
    <Card
      className={`${
        tall ? "h-[80vh]" : "h-[60vh]"
      } overflow-hidden border-slate-200 bg-white p-0 shadow-sm`}
    >
      {children}
    </Card>
  );
}

function EmptyHint() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Enter a deliberation id above to render this component.
      </div>
    </div>
  );
}

function NoActiveSessionHint() {
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        No OPEN session — open one from the Dashboard tab.
      </div>
    </div>
  );
}

function ContextErrorBanner({ error }: { error: Error }) {
  const msg = error.message ?? "";
  const is403 = msg.startsWith("403");
  const is404 = msg.startsWith("404");
  return (
    <Card className="flex items-start gap-2 rounded-xl border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 shadow-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">
        <div className="font-medium">
          Dashboard context request failed: {msg || "unknown error"}
        </div>
        {is403 && (
          <div>
            You need a deliberation role on this id (host or facilitator) to
            read facilitation state. Sign in as a facilitator or use a
            deliberation you manage.
          </div>
        )}
        {is404 && (
          <div>
            No deliberation exists with that id. The input expects a
            primary-key cuid, not a slug.
          </div>
        )}
        {!is403 && !is404 && (
          <div>Tabs that depend on session/question state will be empty.</div>
        )}
      </div>
    </Card>
  );
}

// ─── Handoff demo ───────────────────────────────────────────────────────

function HandoffDemo({
  deliberationId,
  sessionId,
}: {
  deliberationId: string;
  sessionId: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="space-y-3 p-6">
      <p className="text-sm text-slate-600">
        Trigger the handoff dialog with the active session. The dialog reads
        the facilitator roster, current metric snapshot, and pending
        intervention count from live endpoints.
      </p>
      <Button onClick={() => setOpen(true)}>
        <Send className="mr-1.5 h-3.5 w-3.5" />
        Open handoff dialog
      </Button>
      <HandoffDialog
        open={open}
        onOpenChange={setOpen}
        deliberationId={deliberationId}
        sessionId={sessionId}
      />
    </div>
  );
}

// ─── C4 surfaces inspector ──────────────────────────────────────────────

function C4Surfaces({
  deliberationId,
  sessionId,
}: {
  deliberationId: string | null;
  sessionId: string | null;
}) {
  if (!deliberationId) return <EmptyHint />;
  return (
    <div className="space-y-4">
      <AnalyticsInspector deliberationId={deliberationId} />
      <ExportInspector sessionId={sessionId} />
    </div>
  );
}

function AnalyticsInspector({ deliberationId }: { deliberationId: string }) {
  const { data, error, isLoading } = useSWR<{ analytics: unknown }>(
    `/api/deliberations/${deliberationId}/facilitation/analytics`,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  return (
    <Card className="p-4">
      <header className="mb-2 flex items-center gap-2">
        <Activity className="h-4 w-4 text-slate-600" />
        <h3 className="text-sm font-medium text-slate-800">
          C4.1 — Deliberation analytics
        </h3>
        <Badge variant="outline" className="text-[10px]">
          GET /facilitation/analytics
        </Badge>
      </header>
      {isLoading && <div className="text-xs text-slate-500">Loading…</div>}
      {error && (
        <div className="text-xs text-rose-600">
          {(error as Error).message} — facilitator role required.
        </div>
      )}
      {data && (
        <pre className="max-h-72 overflow-auto rounded bg-slate-900 p-3 text-[11px] leading-snug text-slate-100">
          {JSON.stringify(data.analytics, null, 2)}
        </pre>
      )}
    </Card>
  );
}

function ExportInspector({ sessionId }: { sessionId: string | null }) {
  const url = sessionId
    ? `/api/facilitation/sessions/${sessionId}/export`
    : null;
  const { data, error, isLoading } = useSWR<unknown>(url, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const download = async () => {
    if (!url) return;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const blob = await r.blob();
      const a = document.createElement("a");
      const objUrl = URL.createObjectURL(blob);
      a.href = objUrl;
      a.download = `facilitation-${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error((e as Error).message ?? "Export failed");
    }
  };

  return (
    <Card className="p-4">
      <header className="mb-2 flex items-center gap-2">
        <Download className="h-4 w-4 text-slate-600" />
        <h3 className="text-sm font-medium text-slate-800">
          C4.2 — Canonical export
        </h3>
        <Badge variant="outline" className="text-[10px]">
          GET /facilitation/sessions/:id/export
        </Badge>
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={download} disabled={!url}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Download JSON
          </Button>
        </div>
      </header>
      {!sessionId && (
        <div className="text-xs text-slate-500">
          Open a session to enable export.
        </div>
      )}
      {sessionId && isLoading && (
        <div className="text-xs text-slate-500">Loading…</div>
      )}
      {error && (
        <div className="text-xs text-rose-600">{(error as Error).message}</div>
      )}
      {data ? (
        <pre className="max-h-72 overflow-auto rounded bg-slate-900 p-3 text-[11px] leading-snug text-slate-100">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </Card>
  );
}
