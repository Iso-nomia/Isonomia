// components/thesis/ThesisInspectorDrawer.tsx
//
// Living Thesis — Phase 2.1: right-side inspector drawer.
//
// Mounted once per view page inside `<ThesisLiveProvider>`. Subscribes to
// inspector-open requests broadcast by live nodes (Phase 1.3) via
// `useThesisLive().subscribeInspector`, fetches the joined detail blob
// from `/api/thesis/[id]/inspect/[kind]/[objectId]`, and renders tabs.
//
// Tabs (first cut):
//   • Overview     — text/label/scheme/createdAt/etc.
//   • Attacks      — list of inbound attacks (no filing yet — Phase 3).
//   • Provenance   — proposition→claim→argument lineage where applicable.
//   • Evidence     — citations / EvidenceLink entries.
//   • CQs          — arguments only.
//
// History tab is deferred (low value vs. scope cost; revisit in Phase 6).

"use client";

import React, { useEffect, useMemo, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import { Clock, ExternalLink, Shield, Swords } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type InspectorRequest,
  useThesisLive,
  useOpenInspector,
} from "@/lib/thesis/ThesisLiveContext";

type InspectorKind = InspectorRequest["kind"];
type InspectorTab = NonNullable<InspectorRequest["tab"]>;

interface OpenState {
  kind: InspectorKind;
  id: string;
  tab: InspectorTab;
}

const TAB_LABEL: Record<InspectorTab, string> = {
  overview: "Overview",
  attacks: "Attacks",
  provenance: "Provenance",
  evidence: "Evidence",
  cqs: "CQs",
  history: "History",
  nodes: "Nodes",
};

// Per-kind tab visibility. Citations get a slimmed-down set.
const TABS_BY_KIND: Record<InspectorKind, InspectorTab[]> = {
  claim: ["overview", "attacks", "provenance", "evidence"],
  argument: ["overview", "attacks", "provenance", "evidence", "cqs"],
  proposition: ["overview", "provenance"],
  citation: ["overview"],
  chain: ["overview", "nodes", "provenance"],
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Inspect fetch failed (${res.status})`);
  return res.json();
};

export function ThesisInspectorDrawer({ thesisId }: { thesisId: string }) {
  const live = useThesisLive();
  const [open, setOpen] = useState<OpenState | null>(null);

  // Subscribe to inspector-open requests from live nodes.
  useEffect(() => {
    if (!live) return;
    return live.subscribeInspector((req) => {
      const allowed = TABS_BY_KIND[req.kind] ?? [];
      const tab: InspectorTab =
        req.tab && allowed.includes(req.tab)
          ? req.tab
          : (allowed[0] ?? "overview");
      setOpen({ kind: req.kind, id: req.id, tab });
    });
  }, [live]);

  const swrKey = open
    ? `/api/thesis/${thesisId}/inspect/${open.kind}/${open.id}`
    : null;

  const { data, error, isLoading, mutate } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5_000,
  });

  // After a successful attack file, refresh both the inspector detail and
  // the live/register payloads so badges, register, and tab list catch up.
  const onAttackFiled = async () => {
    await Promise.all([
      mutate(),
      globalMutate(`/api/thesis/${thesisId}/live`),
      globalMutate(`/api/thesis/${thesisId}/attacks?status=all`),
    ]);
  };

  const tabs = open ? TABS_BY_KIND[open.kind] : [];

  return (
    <Sheet
      open={!!open}
      onOpenChange={(o) => {
        if (!o) setOpen(null);
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto p-0"
      >
        {open && (
          <>
            <SheetHeader className="px-6 pt-6 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                {open.kind}
              </div>
              <SheetTitle className="text-base font-semibold leading-snug pr-8">
                {data?.overview?.text ??
                  data?.overview?.name ??
                  data?.overview?.uri ??
                  (isLoading ? "Loading…" : "Object")}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500">
                <code className="text-[11px]">{open.id}</code>
              </SheetDescription>
            </SheetHeader>

            <div className="px-6 py-4">
              {error && (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-md p-3">
                  Failed to load inspector data.
                </div>
              )}
              {!error && (
                <Tabs
                  value={open.tab}
                  onValueChange={(t) =>
                    setOpen((s) =>
                      s ? { ...s, tab: t as InspectorTab } : s,
                    )
                  }
                  className="w-full"
                >
                  <TabsList className="mb-4">
                    {tabs.map((t) => (
                      <TabsTrigger key={t} value={t} className="text-xs">
                        {TAB_LABEL[t]}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {tabs.includes("overview") && (
                    <TabsContent value="overview">
                      <OverviewTab data={data} loading={isLoading} />
                    </TabsContent>
                  )}
                  {tabs.includes("attacks") && (
                    <TabsContent value="attacks">
                      <AttacksTab
                        data={data}
                        loading={isLoading}
                        target={open}
                        onAttackFiled={onAttackFiled}
                      />
                    </TabsContent>
                  )}
                  {tabs.includes("provenance") && (
                    <TabsContent value="provenance">
                      <ProvenanceTab
                        data={data}
                        loading={isLoading}
                        target={open}
                      />
                    </TabsContent>
                  )}
                  {tabs.includes("evidence") && (
                    <TabsContent value="evidence">
                      <EvidenceTab data={data} loading={isLoading} />
                    </TabsContent>
                  )}
                  {tabs.includes("cqs") && (
                    <TabsContent value="cqs">
                      <CqsTab data={data} loading={isLoading} />
                    </TabsContent>
                  )}
                  {tabs.includes("nodes") && (
                    <TabsContent value="nodes">
                      <ChainNodesTab data={data} loading={isLoading} />
                    </TabsContent>
                  )}
                </Tabs>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

function Loading() {
  return <div className="text-sm text-slate-400 italic">Loading…</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-slate-500 italic">{children}</div>;
}

function FieldRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex gap-3 text-sm py-1">
      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold w-28 flex-shrink-0 pt-0.5">
        {label}
      </div>
      <div className="text-slate-800 flex-1 min-w-0 break-words">{value}</div>
    </div>
  );
}

function fmtDate(v: string | Date | null | undefined) {
  if (!v) return null;
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function OverviewTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <Loading />;
  if (!data || data.missing)
    return <Empty>Object not found in current deliberation state.</Empty>;
  const o = data.overview ?? {};
  // D4 Week 1–2: chain-specific overview when the inspector is showing a
  // `chain` kind. Falls through to the generic field rows otherwise.
  if (data.kind === "chain") {
    return (
      <div className="space-y-1">
        <FieldRow label="Name" value={o.name ?? null} />
        <FieldRow label="Description" value={o.description ?? null} />
        <FieldRow label="Purpose" value={o.purpose ?? null} />
        <FieldRow label="Type" value={o.chainType ?? null} />
        <FieldRow label="Nodes" value={o.nodeCount ?? null} />
        <FieldRow label="Edges" value={o.edgeCount ?? null} />
        <FieldRow label="Created" value={fmtDate(o.createdAt)} />
        <FieldRow label="Updated" value={fmtDate(o.updatedAt)} />
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <FieldRow label="Text" value={o.text ?? o.uri ?? null} />
      <FieldRow label="Label" value={o.label ?? null} />
      <FieldRow label="Status" value={o.status ?? null} />
      <FieldRow label="Scheme" value={o.schemeId ?? null} />
      <FieldRow label="Confidence" value={o.confidence ?? null} />
      <FieldRow label="Created" value={fmtDate(o.createdAt)} />
      <FieldRow label="Updated" value={fmtDate(o.updatedAt)} />
      <FieldRow
        label="Label computed"
        value={fmtDate(o.labelComputedAt)}
      />
      <FieldRow
        label="Author"
        value={o.authorId ?? o.createdById ?? null}
      />
      {data.workshop && (
        <div className="pt-3 mt-3 border-t border-slate-200 space-y-1">
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">
            Workshop
          </div>
          <FieldRow label="↑ Up" value={data.workshop.voteUp} />
          <FieldRow label="↓ Down" value={data.workshop.voteDown} />
          <FieldRow label="Endorsements" value={data.workshop.endorsements} />
          <FieldRow label="Replies" value={data.workshop.replies} />
        </div>
      )}
    </div>
  );
}

function AttacksTab({
  data,
  loading,
  target,
  onAttackFiled,
}: {
  data: any;
  loading: boolean;
  target: OpenState;
  onAttackFiled: () => Promise<void> | void;
}) {
  if (loading) return <Loading />;
  const edges: any[] = data?.attacks?.edges ?? [];
  const records: any[] = data?.attacks?.records ?? [];
  const all = [...edges, ...records];
  const deliberationId: string | undefined = data?.overview?.deliberationId;

  return (
    <div className="space-y-3">
      {all.length === 0 && <Empty>No attacks recorded.</Empty>}
      {edges.map((e) => (
        <AttackRow
          key={`edge-${e.id}`}
          kind={e.attackType ?? e.type}
          subtype={e.attackSubtype ?? e.targetScope}
          attacker={e.attacker}
          createdAt={e.createdAt}
          defended={e.defended}
        />
      ))}
      {records.map((r) => (
        <AttackRow
          key={`rec-${r.id}`}
          kind={r.attackType}
          attacker={r.attacker}
          createdAt={r.createdAt}
        />
      ))}

      <div className="pt-3 mt-3 border-t border-slate-200">
        {target.kind === "claim" && deliberationId ? (
          <FileAttackForm
            deliberationId={deliberationId}
            targetClaimId={target.id}
            onFiled={onAttackFiled}
          />
        ) : target.kind === "argument" ? (
          <p className="text-xs text-slate-500 italic">
            Filing attacks against arguments from the inspector ships next
            — use the deliberation’s argument view for now.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FileAttackForm — Phase 3.3 reader-side attack filing for claim targets.
//
// Flow:
//   1. POST /api/claims  { text, deliberationId } → attacker claim id
//   2. POST /api/attacks { fromClaimId, toClaimId, kind, scope? } → ClaimEdge
//
// `kind` maps the user's choice to the existing attacks endpoint:
//   • REBUTS     → kind=rebut, scope=conclusion
//   • UNDERMINES → kind=rebut, scope=premise   (premise rebut ≡ undermine)
//   • UNDERCUTS  → kind=undercut
// ─────────────────────────────────────────────────────────────────────────────

type AttackChoice = "REBUTS" | "UNDERMINES" | "UNDERCUTS";

const ATTACK_OPTIONS: Array<{
  value: AttackChoice;
  label: string;
  hint: string;
}> = [
  {
    value: "REBUTS",
    label: "Rebut",
    hint: "Argue the conclusion is false.",
  },
  {
    value: "UNDERMINES",
    label: "Undermine",
    hint: "Argue a supporting premise fails.",
  },
  {
    value: "UNDERCUTS",
    label: "Undercut",
    hint: "Argue the inference doesn’t go through.",
  },
];

function FileAttackForm({
  deliberationId,
  targetClaimId,
  onFiled,
}: {
  deliberationId: string;
  targetClaimId: string;
  onFiled: () => Promise<void> | void;
}) {
  const [choice, setChoice] = useState<AttackChoice>("REBUTS");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (text.trim().length < 6) {
      setError("Please describe your objection in at least a few words.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Create the attacker claim.
      const claimRes = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), deliberationId }),
      });
      if (!claimRes.ok) {
        const body = await claimRes.text().catch(() => "");
        throw new Error(`Could not create attacker claim: ${body}`);
      }
      const claimData = await claimRes.json();
      const fromClaimId: string | undefined =
        claimData?.claim?.id ?? claimData?.claimId;
      if (!fromClaimId) throw new Error("Attacker claim id missing from response.");

      // 2. File the attack edge.
      const kind = choice === "UNDERCUTS" ? "undercut" : "rebut";
      const scope =
        choice === "UNDERMINES"
          ? "premise"
          : choice === "REBUTS"
            ? "conclusion"
            : undefined;
      const attackRes = await fetch("/api/attacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromClaimId,
          toClaimId: targetClaimId,
          kind,
          ...(scope ? { scope } : {}),
        }),
      });
      if (!attackRes.ok) {
        const body = await attackRes.text().catch(() => "");
        throw new Error(`Could not file attack: ${body}`);
      }

      setSuccess(true);
      setText("");
      await onFiled();
      // Hide success toast after a couple seconds so the form is reusable.
      setTimeout(() => setSuccess(false), 2_500);
    } catch (err: any) {
      setError(err?.message ?? "Failed to file attack.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
        File an attack
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ATTACK_OPTIONS.map((opt) => {
          const active = choice === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setChoice(opt.value)}
              title={opt.hint}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                active
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">
        {ATTACK_OPTIONS.find((o) => o.value === choice)?.hint}
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="State your objection as a claim…"
        rows={3}
        className="w-full text-sm rounded-md border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-700"
        disabled={submitting}
      />

      {error && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
          {error}
        </div>
      )}
      {success && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
          Attack filed. Badges and register will update on the next refresh.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || text.trim().length < 6}
          className="text-xs px-3 py-1.5 rounded-md bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          <Swords className="h-3.5 w-3.5" />
          {submitting ? "Filing…" : "File attack"}
        </button>
      </div>
    </form>
  );
}

function AttackRow({
  kind,
  subtype,
  attacker,
  createdAt,
  defended,
}: {
  kind?: string | null;
  subtype?: string | null;
  attacker?: { id: string; text?: string | null } | null;
  createdAt?: string | Date | null;
  defended?: boolean;
}) {
  const Icon = defended ? Shield : Swords;
  const color = defended
    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : "text-rose-700 bg-rose-50 border-rose-200";
  return (
    <div className={`rounded-md border p-3 ${color}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" />
        <span>{kind ?? "ATTACK"}</span>
        {subtype && (
          <span className="text-[10px] opacity-70">· {subtype}</span>
        )}
        {defended && <span className="ml-auto text-[10px]">defended</span>}
      </div>
      {attacker?.text && (
        <p className="text-sm mt-1.5 text-slate-800 break-words">
          {attacker.text}
        </p>
      )}
      <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-500">
        <Clock className="h-3 w-3" />
        <span>{fmtDate(createdAt)}</span>
      </div>
    </div>
  );
}

function ProvenanceTab({
  data,
  loading,
  target,
}: {
  data: any;
  loading: boolean;
  target: InspectorRequest | null;
}) {
  const openInspector = useOpenInspector();
  // Phase 6.3: lazily load "Used in" backlinks for the current object.
  const backlinksKey = target
    ? `/api/objects/${target.kind}/${target.id}/backlinks`
    : null;
  const { data: backlinks } = useSWR(backlinksKey, fetcher, {
    dedupingInterval: 30_000,
  });
  if (loading) return <Loading />;
  const p = data?.provenance ?? {};
  const sourceProp = p.sourceProposition;
  const promotedClaim = p.promotedClaim;
  const asConcl: any[] = p.asConclusionOf ?? [];
  const asPrem: any[] = p.asPremiseIn ?? [];
  const conclusion = p.conclusion;
  const premises: any[] = p.premises ?? [];

  // D4 Week 1–2: chain provenance carries deliberation, creator, and the list
  // of theses that embed this chain (from ThesisChainReference).
  const chainTheses: any[] = data?.kind === "chain" ? (p.theses ?? []) : [];
  const chainDeliberation = data?.kind === "chain" ? p.deliberation : null;
  const chainCreator = data?.kind === "chain" ? p.creator : null;

  const thesesBacklinks: any[] = backlinks?.theses ?? [];
  const argBacklinks: any[] = backlinks?.arguments ?? [];
  const claimBacklinks: any[] = backlinks?.claims ?? [];
  const hasBacklinks =
    thesesBacklinks.length + argBacklinks.length + claimBacklinks.length > 0;

  const empty =
    !sourceProp &&
    !promotedClaim &&
    !asConcl.length &&
    !asPrem.length &&
    !conclusion &&
    !premises.length &&
    !hasBacklinks &&
    !chainTheses.length &&
    !chainDeliberation &&
    !chainCreator;
  if (empty) return <Empty>No lineage recorded.</Empty>;

  return (
    <div className="space-y-4">
      {chainDeliberation && (
        <Section title="Deliberation">
          <ObjectRow text={chainDeliberation.title ?? chainDeliberation.id} />
        </Section>
      )}
      {chainCreator && (
        <Section title="Creator">
          <ObjectRow
            text={chainCreator.name ?? chainCreator.id}
            subtitle={chainCreator.id}
          />
        </Section>
      )}
      {chainTheses.length > 0 && (
        <Section title={`Embedded in theses (${chainTheses.length})`}>
          {chainTheses.slice(0, 25).map((t) => (
            <a
              key={t.thesisId}
              href={`/thesis/${t.slug ?? t.thesisId}`}
              className="block rounded-md border border-slate-200 bg-white p-2.5 hover:border-slate-400 hover:bg-slate-50 transition"
            >
              <p className="text-sm text-slate-800 break-words">
                {t.title ?? t.thesisId}
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  {t.role}
                  {t.status ? ` · ${t.status}` : ""}
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                  <ExternalLink className="h-3 w-3" />
                  open
                </span>
              </div>
              {t.caption && (
                <div className="mt-1 text-xs text-slate-500">{t.caption}</div>
              )}
            </a>
          ))}
        </Section>
      )}
      {sourceProp && (
        <Section title="Source proposition">
          <ObjectRow
            text={sourceProp.text}
            subtitle={sourceProp.status}
            onOpen={
              sourceProp.id
                ? () =>
                    openInspector({
                      kind: "proposition",
                      id: sourceProp.id,
                    })
                : undefined
            }
          />
        </Section>
      )}
      {promotedClaim && (
        <Section title="Promoted to claim">
          <ObjectRow
            text={promotedClaim.text}
            subtitle={promotedClaim.ClaimLabel?.label}
            onOpen={
              promotedClaim.id
                ? () =>
                    openInspector({ kind: "claim", id: promotedClaim.id })
                : undefined
            }
          />
        </Section>
      )}
      {conclusion && (
        <Section title="Conclusion">
          <ObjectRow
            text={conclusion.text}
            onOpen={
              conclusion.id
                ? () => openInspector({ kind: "claim", id: conclusion.id })
                : undefined
            }
          />
        </Section>
      )}
      {premises.length > 0 && (
        <Section title={`Premises (${premises.length})`}>
          {premises.map((pr, i) => (
            <ObjectRow
              key={i}
              text={pr.claim?.text ?? "—"}
              subtitle={pr.isImplicit ? "implicit" : null}
              onOpen={
                pr.claim?.id
                  ? () => openInspector({ kind: "claim", id: pr.claim.id })
                  : undefined
              }
            />
          ))}
        </Section>
      )}
      {asConcl.length > 0 && (
        <Section title={`Argued for in (${asConcl.length})`}>
          {asConcl.slice(0, 10).map((a) => (
            <ObjectRow
              key={a.id}
              text={a.text}
              subtitle={a.schemeId}
              onOpen={() => openInspector({ kind: "argument", id: a.id })}
            />
          ))}
        </Section>
      )}
      {asPrem.length > 0 && (
        <Section title={`Used as premise in (${asPrem.length})`}>
          {asPrem.slice(0, 10).map((a) => (
            <ObjectRow
              key={a.id}
              text={a.text}
              subtitle={a.schemeId}
              onOpen={() => openInspector({ kind: "argument", id: a.id })}
            />
          ))}
        </Section>
      )}
      {hasBacklinks && (
        <BacklinksSection
          theses={thesesBacklinks}
          argumentsList={argBacklinks}
          claims={claimBacklinks}
          openInspector={openInspector}
        />
      )}
    </div>
  );
}

function BacklinksSection({
  theses,
  argumentsList,
  claims,
  openInspector,
}: {
  theses: any[];
  argumentsList: any[];
  claims: any[];
  openInspector: (req: InspectorRequest) => void;
}) {
  return (
    <div className="space-y-3 pt-2 border-t border-slate-200">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
        Used in
      </div>
      {theses.length > 0 && (
        <Section title={`Theses (${theses.length})`}>
          {theses.slice(0, 10).map((t) => (
            <a
              key={t.thesisId}
              href={
                t.deliberationId
                  ? `/deliberations/${t.deliberationId}/thesis/${t.thesisId}/view`
                  : `/thesis/${t.slug}`
              }
              className="block rounded-md border border-slate-200 bg-white p-2.5 hover:border-slate-400 hover:bg-slate-50 transition"
            >
              <p className="text-sm text-slate-800 break-words">{t.title}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  via {t.via.join(", ")}
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
                  <ExternalLink className="h-3 w-3" />
                  open
                </span>
              </div>
            </a>
          ))}
        </Section>
      )}
      {argumentsList.length > 0 && (
        <Section title={`Arguments (${argumentsList.length})`}>
          {argumentsList.slice(0, 10).map((a) => (
            <ObjectRow
              key={a.id}
              text={a.text}
              subtitle={`as ${a.role}${a.schemeId ? ` · ${a.schemeId}` : ""}`}
              onOpen={() => openInspector({ kind: "argument", id: a.id })}
            />
          ))}
        </Section>
      )}
      {claims.length > 0 && (
        <Section title={`Claims (${claims.length})`}>
          {claims.slice(0, 10).map((c) => (
            <ObjectRow
              key={c.id}
              text={c.text}
              subtitle={c.ClaimLabel?.label}
              onOpen={() => openInspector({ kind: "claim", id: c.id })}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// D4 Week 1–2: Chain inspector — Nodes tab.
// Lists each member argument in nodeOrder; click → open argument inspector.
// ─────────────────────────────────────────────────────────────────────────────
function ChainNodesTab({ data, loading }: { data: any; loading: boolean }) {
  const openInspector = useOpenInspector();
  if (loading) return <Loading />;
  if (!data || data.missing) return <Empty>Chain not found.</Empty>;
  const nodes: any[] = data.nodes ?? [];
  const edges: any[] = data.edges ?? [];
  if (nodes.length === 0)
    return <Empty>This chain has no nodes yet.</Empty>;
  return (
    <div className="space-y-3">
      <Section title={`Nodes (${nodes.length})`}>
        {nodes.map((n) => (
          <ObjectRow
            key={n.id}
            text={n.text || "(no text)"}
            subtitle={
              [n.role, n.epistemicStatus]
                .filter((v) => v && v !== "ASSERTED")
                .join(" · ") || null
            }
            onOpen={() =>
              openInspector({ kind: "argument", id: n.argumentId })
            }
          />
        ))}
      </Section>
      {edges.length > 0 && (
        <Section title={`Edges (${edges.length})`}>
          <div className="space-y-1.5">
            {edges.slice(0, 30).map((e) => (
              <div
                key={e.id}
                className="text-xs text-slate-600 border border-slate-200 rounded-md px-2 py-1.5 bg-slate-50"
              >
                <span className="font-mono text-[10px] text-slate-400">
                  {e.sourceNodeId.slice(-6)} → {e.targetNodeId.slice(-6)}
                </span>{" "}
                <span className="ml-1 text-slate-700">{e.edgeType}</span>
                {e.description && (
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {e.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function EvidenceTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <Loading />;
  const cit: any[] = data?.evidence?.citations ?? [];
  const links: any[] = data?.evidence?.links ?? [];
  if (cit.length === 0 && links.length === 0)
    return <Empty>No evidence recorded.</Empty>;

  return (
    <div className="space-y-3">
      {cit.map((c) => (
        <div
          key={c.id}
          className="rounded-md border border-amber-200 bg-amber-50 p-3"
        >
          <div className="text-xs uppercase tracking-wide text-amber-700 font-semibold mb-1">
            Citation
          </div>
          {c.uri && (
            <a
              href={c.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-amber-900 underline break-all inline-flex items-center gap-1"
            >
              {c.uri}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {c.note && (
            <p className="text-xs text-amber-800 mt-1">{c.note}</p>
          )}
        </div>
      ))}
      {links.map((l) => (
        <div
          key={l.id}
          className="rounded-md border border-slate-200 bg-slate-50 p-3"
        >
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">
            Evidence link
          </div>
          {l.uri && (
            <a
              href={l.uri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-slate-800 underline break-all inline-flex items-center gap-1"
            >
              {l.uri}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {l.note && <p className="text-xs text-slate-600 mt-1">{l.note}</p>}
          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-400">
            <Clock className="h-3 w-3" />
            <span>{fmtDate(l.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CqsTab({ data, loading }: { data: any; loading: boolean }) {
  const cqs: any[] = data?.cqs ?? [];
  // Group by schemeKey for readability. Hook is called unconditionally to
  // satisfy rules-of-hooks; the early returns below are render-only.
  const grouped = useMemoGroup(cqs, "schemeKey");
  if (loading) return <Loading />;
  if (cqs.length === 0)
    return <Empty>No critical questions recorded for this argument.</Empty>;

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([scheme, items]) => (
        <Section key={scheme} title={scheme}>
          {items.map((c: any) => (
            <div
              key={c.id}
              className={`rounded-md border p-3 text-sm ${
                c.satisfied
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-amber-50 border-amber-200"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span
                  className={`uppercase tracking-wide ${
                    c.satisfied ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {c.cqKey}
                </span>
                <span className="ml-auto text-[10px] opacity-70">
                  {c.status}
                </span>
              </div>
              {c.groundsText && (
                <p className="mt-1 text-slate-800 text-xs">
                  {c.groundsText}
                </p>
              )}
            </div>
          ))}
        </Section>
      ))}
    </div>
  );
}

function useMemoGroup<T>(
  items: T[],
  key: keyof T,
): Record<string, T[]> {
  return useMemo(() => {
    const out: Record<string, T[]> = {};
    for (const item of items) {
      const k = String(item[key] ?? "—");
      (out[k] ??= []).push(item);
    }
    return out;
  }, [items, key]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Small layout primitives
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function ObjectRow({
  text,
  subtitle,
  onOpen,
  openLabel,
}: {
  text: string;
  subtitle?: string | null;
  onOpen?: () => void;
  openLabel?: string;
}) {
  const interactive = !!onOpen;
  const Wrapper: React.ElementType = interactive ? "button" : "div";
  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={onOpen}
      className={
        "w-full text-left rounded-md border border-slate-200 bg-white p-2.5 " +
        (interactive
          ? "hover:border-slate-400 hover:bg-slate-50 transition"
          : "")
      }
    >
      <p className="text-sm text-slate-800 break-words">{text}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        {subtitle ? (
          <div className="text-[11px] uppercase tracking-wide text-slate-500">
            {subtitle}
          </div>
        ) : (
          <span />
        )}
        {interactive && (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
            <ExternalLink className="h-3 w-3" />
            {openLabel ?? "open"}
          </span>
        )}
      </div>
    </Wrapper>
  );
}
