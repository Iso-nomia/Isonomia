"use client";

/**
 * Typology features demo — Scope B exit surface (B3.8).
 *
 * Static showcase of every Scope B typology component in isolation, plus a
 * read-only inspector for the Phase B2 export endpoint. Mirrors
 * `app/test/facilitation-features/page.tsx` in spirit.
 *
 * The page accepts a deliberation id either via `?deliberationId=<cuid>` or
 * via the inline input below — the input persists to localStorage so a
 * reviewer can refresh without retyping. Pass `?sessionId=` to focus the
 * candidate queue on a specific facilitation session.
 *
 * Accessible at: /test/typology-features
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
import { Toaster, toast } from "sonner";
import {
  Activity,
  Download,
  FileCheck,
  Hash,
  ListChecks,
  Tag,
  Link,
  Sparkles,
  CircleDot,
  Circle,
  CircleDotIcon,
} from "lucide-react";

import { ChainValidityBadge } from "@/components/facilitation/ChainValidityBadge";
import { AxisBadge } from "@/components/typology/AxisBadge";
import { DisagreementTagger } from "@/components/typology/DisagreementTagger";
import { TypologyCandidateQueue } from "@/components/typology/TypologyCandidateQueue";
import { MetaConsensusEditor } from "@/components/typology/MetaConsensusEditor";
import { MetaConsensusSummaryCard } from "@/components/typology/MetaConsensusSummaryCard";
import {
  AXIS_LABEL,
  useAxes,
  useSummaries,
  useTags,
  useTypologyEvents,
  type DisagreementAxisKey,
} from "@/components/typology/hooks";

// ─── Deliberation id wiring ─────────────────────────────────────────────

const STORAGE_KEY = "typology-demo:deliberationId";
const SESSION_STORAGE_KEY = "typology-demo:sessionId";

function useUrlState(
  paramName: string,
  storageKey: string,
): [string | null, (s: string | null) => void] {
  const [value, setValue] = React.useState<string | null>(null);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQs = params.get(paramName);
    const fromLs =
      typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    setValue(fromQs || fromLs || null);
  }, [paramName, storageKey]);

  const update = React.useCallback(
    (next: string | null) => {
      setValue(next);
      if (typeof window === "undefined") return;
      if (next) window.localStorage.setItem(storageKey, next);
      else window.localStorage.removeItem(storageKey);
      const url = new URL(window.location.href);
      if (next) url.searchParams.set(paramName, next);
      else url.searchParams.delete(paramName);
      window.history.replaceState({}, "", url.toString());
    },
    [paramName, storageKey],
  );

  return [value, update];
}

// ─── Page ───────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });

export default function TypologyFeaturesPage() {
  const [deliberationId, setDeliberationId] = useUrlState("deliberationId", STORAGE_KEY);
  const [sessionId, setSessionId] = useUrlState("sessionId", SESSION_STORAGE_KEY);
  const [delibInput, setDelibInput] = React.useState("");
  const [sessInput, setSessInput] = React.useState("");

  React.useEffect(() => {
    setDelibInput(deliberationId ?? "");
    setSessInput(sessionId ?? "");
  }, [deliberationId, sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-sky-50/40">
      <Toaster richColors closeButton />

      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-violet-200 bg-indigo-50/50 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Circle className="h-5 w-5 text-violet-500" />
          <h1 className="text-base font-semibold text-slate-800">
            Typology features
          </h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Scope B · B3 demo
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <Input
              value={delibInput}
              onChange={(e) => setDelibInput(e.target.value)}
              placeholder="deliberationId"
              className="h-full py-3 w-56 text-xs articlesearchfield"
            />
            <Input
              value={sessInput}
              onChange={(e) => setSessInput(e.target.value)}
              placeholder="sessionId (optional)"
              className="h-full py-3 w-56 text-xs articlesearchfield"
            />
            {delibInput.trim() && (
              <Button
                className="bg-indigo-50 text-xs mb-2 btnv2--ghost"
                variant="outline"
                onClick={async () => {
                  try {
                    const r = await fetch(
                      `/api/deliberations/${delibInput.trim()}/facilitation/sessions`,
                      { cache: "no-store" },
                    );
                    const j = await r.json();
                    const id = j?.session?.id ?? null;
                    if (id) {
                      setSessInput(id);
                      toast.success("Loaded current open session");
                    } else {
                      toast.info("No open session for this deliberation");
                    }
                  } catch {
                    toast.error("Couldn't fetch current session");
                  }
                }}
                title="Fetch the deliberation's current OPEN facilitation session"
              >
                Use open session
              </Button>
            )}
            <Button
                className="bg-indigo-50 border-indigo-400 mb-2 text-xs btnv2--ghost"

              onClick={() => {
                setDeliberationId(delibInput.trim() || null);
                setSessionId(sessInput.trim() || null);
              }}
            >
              Load
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {!deliberationId ? (
          <ContextBanner />
        ) : (
          <>
            <SnapshotStrip deliberationId={deliberationId} sessionId={sessionId} />
            <Tabs defaultValue="tagger" className="space-y-3">
              <TabsList className="bg-white">
                <TabsTrigger value="tagger" className="gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  Tagger
                </TabsTrigger>
                <TabsTrigger value="candidates" className="gap-1">
                  <CircleDot className="h-3.5 w-3.5" />
                  Candidates
                </TabsTrigger>
                <TabsTrigger value="editor" className="gap-1">
                  <FileCheck className="h-3.5 w-3.5" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="summaries" className="gap-1">
                  <ListChecks className="h-3.5 w-3.5" />
                  Summaries
                </TabsTrigger>
                <TabsTrigger value="chain" className="gap-1">
                  <Link className="h-3.5 w-3.5" />
                  Chain
                </TabsTrigger>
                <TabsTrigger value="export" className="gap-1">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tagger" className="space-y-3">
                <TaggerDemo deliberationId={deliberationId} sessionId={sessionId} />
              </TabsContent>

              <TabsContent value="candidates" className="space-y-3">
                {sessionId ? (
                  <TypologyCandidateQueue sessionId={sessionId} />
                ) : (
                  <Card className="p-4 text-xs text-slate-600">
                    Pass a <code>sessionId</code> in the URL or input to view candidates for
                    a specific session.
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="editor">
                <MetaConsensusEditor
                  deliberationId={deliberationId}
                  sessionId={sessionId}
                />
              </TabsContent>

              <TabsContent value="summaries" className="space-y-3">
                <SummariesPanel deliberationId={deliberationId} sessionId={sessionId} />
              </TabsContent>

              <TabsContent value="chain">
                <ChainPanel deliberationId={deliberationId} sessionId={sessionId} />
              </TabsContent>

              <TabsContent value="export">
                <ExportPanel deliberationId={deliberationId} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Context banner / no-deliberation state ────────────────────────────

function ContextBanner() {
  const seedCmd = "npx tsx scripts/seed-typology-demo.ts";
  const [copied, setCopied] = React.useState(false);

  const onCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(seedCmd);
      setCopied(true);
      toast.success("Seed command copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }, [seedCmd]);

  return (
    <Card className="space-y-3 p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-slate-800">No deliberation selected</h2>
        <p className="text-sm text-slate-600">
          Provide a <code>deliberationId</code> via the URL (e.g.
          <code className="ml-1 rounded bg-slate-100 px-1">?deliberationId=…</code>) or via
          the input above. Then press <strong>Load</strong>.
        </p>
      </div>
      <div className="space-y-1 rounded border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-600">
          Need data fast? Run the demo seeder; it creates four confirmed tags, four
          pending candidates, and a published meta-consensus summary against the most
          recent OPEN facilitation session it can find:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100">
            {seedCmd}
          </code>
          <Button size="sm" variant="outline" onClick={onCopy} aria-label="Copy seed command">
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Snapshot strip ─────────────────────────────────────────────────────

function SnapshotStrip({
  deliberationId,
  sessionId,
}: {
  deliberationId: string;
  sessionId: string | null;
}) {
  const axes = useAxes();
  const tags = useTags(deliberationId, { sessionId });
  const events = useTypologyEvents(deliberationId, sessionId);
  const summaries = useSummaries(deliberationId, { sessionId, all: true });

  const totals = (tags.data?.tags ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.axisId] = (acc[t.axisId] ?? 0) + 1;
    return acc;
  }, {});

  const eventsList = events.data?.events ?? [];
  // An empty chain returns `valid: false` from the verifier (semantic
  // "EMPTY" reason). For demo display that's misleading—show pending instead.
  const chainValid =
    eventsList.length === 0 ? null : events.data?.hashChainValid ?? null;
  const loadError = tags.error || events.error || summaries.error;
  // Pull the most informative error (auth/forbidden/not-found vs generic).
  const errStatus =
    (tags.error as { status?: number })?.status ??
    (events.error as { status?: number })?.status ??
    (summaries.error as { status?: number })?.status ??
    null;
  const errMessage = (() => {
    if (!loadError) return null;
    if (errStatus === 401)
      return "Sign in to view typology data for this deliberation.";
    if (errStatus === 403)
      return "You don't have a role on this deliberation. Ask the host for access.";
    if (errStatus === 404)
      return "Deliberation not found, or you have no role on it (the API returns NOT_FOUND for both, by design).";
    return "Couldn't load typology data — check the deliberation id.";
  })();

  return (
    <Card className="flex flex-wrap items-center gap-3 p-3">
      <Badge variant="outline" className="gap-1">
        <Hash className="h-3 w-3" />
        delib {deliberationId.slice(0, 8)}…
      </Badge>
      {sessionId && (
        <Badge variant="outline" className="gap-1">
          <Hash className="h-3 w-3" />
          session {sessionId.slice(0, 8)}…
        </Badge>
      )}
      <Separator orientation="vertical" className="h-4" />
      {loadError ? (
        <span className="text-xs text-rose-600" role="alert">
          {errMessage}
        </span>
      ) : (
        <>
          <span className="text-xs text-slate-600">
            {(tags.data?.tags ?? []).length} tags
          </span>
          <span className="text-xs text-slate-600">
            {(summaries.data?.summaries ?? []).length} summaries
          </span>
          <span className="text-xs text-slate-600">
            {eventsList.length} events
          </span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1">
            {(axes.data?.axes ?? []).map((a) => {
              const count = totals[a.id] ?? 0;
              if (!count) return null;
              return <AxisBadge key={a.id} axisKey={a.key} count={count} />;
            })}
          </div>
        </>
      )}
      <ChainValidityBadge
        valid={chainValid}
        failedIndex={null}
        chainLabel="meta-consensus chain"
        className="ml-auto"
      />
    </Card>
  );
}

// ─── Tagger demo (per-target inspector) ─────────────────────────────────

function TaggerDemo({
  deliberationId,
  sessionId,
}: {
  deliberationId: string;
  sessionId: string | null;
}) {
  const [targetType, setTargetType] = React.useState<"CLAIM" | "ARGUMENT" | "EDGE">("CLAIM");
  const [targetId, setTargetId] = React.useState<string>("");

  const claims = useSWR<{ items: Array<{ id: string; text: string }> }>(
    targetType === "CLAIM"
      ? `/api/deliberations/${deliberationId}/claims?limit=20`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const args = useSWR<{ items: Array<{ id: string; text: string | null }> }>(
    targetType === "ARGUMENT"
      ? `/api/deliberations/${deliberationId}/arguments?limit=20`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const recent = React.useMemo(() => {
    if (targetType === "CLAIM")
      return (claims.data?.items ?? []).map((c) => ({ id: c.id, text: c.text }));
    if (targetType === "ARGUMENT")
      return (args.data?.items ?? []).map((a) => ({
        id: a.id,
        text: a.text ?? "— (no text)",
      }));
    return [];
  }, [targetType, claims.data, args.data]);

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-semibold text-slate-800">DisagreementTagger</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={targetType}
          onChange={(e) => {
            setTargetType(e.target.value as typeof targetType);
            setTargetId("");
          }}
          className="h-8 rounded border border-slate-300 px-2 text-xs"
          aria-label="Target type"
        >
          <option value="CLAIM">CLAIM</option>
          <option value="ARGUMENT">ARGUMENT</option>
          <option value="EDGE">EDGE</option>
        </select>
        <Input
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="targetId"
          className="h-8 w-72 font-mono text-xs"
        />
        {targetType !== "EDGE" && recent.length > 0 && (
          <select
            value={""}
            onChange={(e) => {
              if (e.target.value) setTargetId(e.target.value);
            }}
            className="h-8 max-w-[18rem] truncate rounded border border-slate-300 px-2 text-xs"
            aria-label={`Pick a recent ${targetType.toLowerCase()}`}
          >
            <option value="">Pick recent {targetType.toLowerCase()}…</option>
            {recent.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id.slice(0, 6)}… — {r.text.slice(0, 60)}
              </option>
            ))}
          </select>
        )}
        {targetType !== "EDGE" && (claims.isLoading || args.isLoading) && (
          <span className="text-[11px] text-slate-500">Loading…</span>
        )}
      </div>
      {targetId ? (
        <DisagreementTagger
          deliberationId={deliberationId}
          targetType={targetType}
          targetId={targetId}
          sessionId={sessionId}
        />
      ) : (
        <p className="text-xs text-slate-500">
          Enter a target id or pick one from the dropdown to render the tagger.
        </p>
      )}
    </Card>
  );
}

// ─── Summaries panel ────────────────────────────────────────────────────

function SummariesPanel({
  deliberationId,
  sessionId,
}: {
  deliberationId: string;
  sessionId: string | null;
}) {
  const { data, error, isLoading } = useSummaries(deliberationId, { sessionId, all: true });
  const summaries = data?.summaries ?? [];
  if (isLoading) return <Card className="p-4 text-xs text-slate-500">Loading summaries…</Card>;
  if (error)
    return (
      <Card className="p-4 text-xs text-rose-700" role="alert">
        Couldn&apos;t load summaries.
      </Card>
    );
  if (summaries.length === 0)
    return <Card className="p-4 text-xs text-slate-500">No summaries yet.</Card>;
  return (
    <div className="space-y-3">
      {summaries.map((s) => (
        <MetaConsensusSummaryCard key={s.id} summary={s} hydrate />
      ))}
    </div>
  );
}

// ─── Chain panel ────────────────────────────────────────────────────────

function ChainPanel({
  deliberationId,
  sessionId,
}: {
  deliberationId: string;
  sessionId: string | null;
}) {
  const { data, error, isLoading } = useTypologyEvents(deliberationId, sessionId);
  if (isLoading) return <Card className="p-4 text-xs text-slate-500">Loading events…</Card>;
  if (error)
    return (
      <Card className="p-4 text-xs text-rose-700" role="alert">
        Couldn&apos;t load events.
      </Card>
    );
  const events = data?.events ?? [];
  const chainValid = events.length === 0 ? null : data?.hashChainValid ?? null;
  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Meta-consensus events</h2>
        <ChainValidityBadge
          valid={chainValid}
          failedIndex={null}
          chainLabel="meta-consensus chain"
        />
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-slate-500">No events yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-xs">
          {events.map((e) => (
            <li key={e.id} className="flex items-baseline gap-2 py-1.5">
              <span className="font-mono text-slate-500">
                {new Date(e.createdAt).toLocaleTimeString()}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase">
                {e.eventType}
              </Badge>
              <span className="font-mono text-slate-400">
                {e.hashChainSelf.slice(0, 8)}…
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Export panel ───────────────────────────────────────────────────────

function ExportPanel({ deliberationId }: { deliberationId: string }) {
  const { data, error, isLoading } = useSWR(
    `/api/deliberations/${deliberationId}/typology/export`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const downloadJson = React.useCallback(() => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `typology-export-${deliberationId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export downloaded");
  }, [data, deliberationId]);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Canonical export (read-only)</h2>
        <Button size="sm" onClick={downloadJson} disabled={!data}>
          <Download className="mr-1 h-3 w-3" />
          Download JSON
        </Button>
      </div>
      {isLoading && <p className="text-xs text-slate-500">Loading export…</p>}
      {error && (
        <p className="text-xs text-rose-700" role="alert">
          Couldn&apos;t load export.
        </p>
      )}
      {data && (
        <pre className="max-h-96 overflow-auto rounded bg-slate-900 p-3 font-mono text-[10px] leading-tight text-slate-100">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </Card>
  );
}
