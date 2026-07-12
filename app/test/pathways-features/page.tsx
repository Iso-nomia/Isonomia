"use client";

/**
 * Institutional Pathways — Demo Page (Scope A · WS1)
 *
 * Static visual showcase of the deliberative-democracy "Institutional
 * Pathways" surface delivered in Scope A:
 *
 * SECTION 1 — REGISTRY & ROLES
 *   1.1 Institution Registry            (lib + API + InstitutionProfile)
 *   1.2 Role Gating & Public Redaction  (lib/pathways/auth)
 *
 * SECTION 2 — PATHWAY LIFECYCLE
 *   2.1 Open Pathway                    (POST /api/deliberations/[id]/pathways)
 *   2.2 Hash-Chained Audit Log          (PathwayTimeline + verifyPathwayChain)
 *
 * SECTION 3 — PACKETS & SUBMISSION
 *   3.1 Recommendation Packets          (PacketBuilder)
 *   3.2 Submission Channels             (in_platform / email / api / manual)
 *
 * SECTION 4 — RESPONSE & PLEXUS
 *   4.1 Institutional Responses         (ResponseIntake)
 *   4.2 Plexus Visualization            (institution nodes + pathway edges)
 *
 * Accessible at: /test/pathways-features
 */

import * as React from "react";
import { Toaster } from "sonner";
import {
  Building2,
  Landmark,
  ScrollText,
  Send,
  Inbox,
  Network,
  ShieldCheck,
  Hash,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PauseCircle,
  Circle,
  ChevronRight,
  ListChecks,
  FileText,
  Mail,
  Plug,
  PenLine,
  Eye,
  EyeOff,
  Lock,
  Globe,
  Sparkles,
  GitBranch,
  Workflow,
  Users,
  Diamond,
  ArrowRight,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_INSTITUTION = {
  id: "inst_demo",
  slug: "city-of-portland",
  name: "City of Portland — Bureau of Transportation",
  kind: "GOVERNMENT_AGENCY",
  jurisdiction: "Portland, OR, USA",
  verified: true,
  activePathways: 7,
  members: 12,
  medianAcknowledgementMs: 86_400_000, // 1 day
  medianResponseMs: 1_209_600_000, // 14 days
};

const MOCK_PATHWAY = {
  id: "pw_demo",
  subject: "Recommendations on transit equity policy",
  status: "AWAITING_RESPONSE" as const,
  isPublic: true,
  openedAt: "2026-04-08T14:22:00Z",
  currentPacketVersion: 2,
};

const MOCK_PACKET_ITEMS = [
  {
    id: "it1",
    kind: "CLAIM",
    title: "Restore weekend Line 14 service",
    commentary:
      "Cite §3.2 of the equity audit; ridership recovered to 93% pre-pandemic.",
  },
  {
    id: "it2",
    kind: "ARGUMENT",
    title: "Fare-capping reduces inequity without revenue loss",
    commentary: "Snapshot of the dialectical tree, including DGP rebuttal.",
  },
  {
    id: "it3",
    kind: "CARD",
    title: "Stack: 8 community letters from East Portland",
    commentary: null,
  },
  {
    id: "it4",
    kind: "NOTE",
    title: "Implementation timeline must respect FY27 budget cycle",
    commentary: "Operator-added context; not derived from a discourse object.",
  },
];

const MOCK_DISPOSITIONS = [
  { itemId: "it1", disposition: "ACCEPTED", rationale: "Will pilot in Q3 FY27." },
  { itemId: "it2", disposition: "MODIFIED", rationale: "Adopt fare-capping but defer means-tested expansion to FY28." },
  { itemId: "it3", disposition: "ACCEPTED", rationale: "Letters entered into the public record." },
  { itemId: "it4", disposition: "DEFERRED", rationale: "Budget alignment confirmed; timing review in 60 days." },
];

const MOCK_TIMELINE = [
  { type: "DRAFT_OPENED", at: "2026-04-08T14:22:00Z", actor: "facilitator", round: 1 },
  { type: "ITEM_ADDED", at: "2026-04-08T15:01:00Z", actor: "contributor", round: 1, count: 4 },
  { type: "SUBMITTED", at: "2026-04-09T09:14:00Z", actor: "facilitator", round: 1, channel: "in_platform" },
  { type: "ACKNOWLEDGED", at: "2026-04-10T11:00:00Z", actor: "institution", round: 1 },
  { type: "RESPONDED", at: "2026-04-22T16:40:00Z", actor: "institution", round: 1, accepted: 2, modified: 1, deferred: 1 },
  { type: "REVISED", at: "2026-04-22T18:00:00Z", actor: "facilitator", round: 2 },
];

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE INVENTORY
// ─────────────────────────────────────────────────────────────────────────────

const PATHWAY_FEATURES = [
  {
    id: "registry",
    step: "1.1",
    title: "Institution Registry",
    description: "Verifiable directory of agencies, councils, NGOs and their members",
    icon: Building2,
    color: "from-violet-500/10 to-purple-500/15",
    iconColor: "text-violet-600",
    items: [
      "Institution model: slug, name, kind, jurisdiction, contact, verified",
      "Members table with role grants (FACILITATOR, OPERATOR, OBSERVER)",
      "Optional linkedDeliberationId — institution may host an internal room",
      "Admin-only POST /api/institutions (env-gated allowlist)",
      "Public InstitutionProfile page at /institutions/[id]",
      "Median latency metrics shown on profile (acknowledgement / response)",
    ],
  },
  {
    id: "auth",
    step: "1.2",
    title: "Role Gating & Public Redaction",
    description: "lib/pathways/auth — uniform admin / host / facilitator gates",
    icon: ShieldCheck,
    color: "from-emerald-500/10 to-teal-500/15",
    iconColor: "text-emerald-600",
    items: [
      "isPlatformAdmin / isDeliberationHost / isFacilitator helpers",
      "canEditPacket / canSubmitPacket / canActAsInstitution shortcuts",
      "loadPathwayContext / loadPacketContext / loadSubmissionContext loaders",
      "Anon callers on isPublic=true pathways receive redacted actor IDs",
      "Authenticated facilitator/host always sees full audit fields",
      "MESH_PATHWAYS_ADMIN_AUTH_IDS env allowlist for institution creation",
    ],
  },
  {
    id: "open",
    step: "2.1",
    title: "Open Pathway",
    description: "Forward a deliberation's recommendations to a registered institution",
    icon: Send,
    color: "from-sky-500/10 to-blue-500/15",
    iconColor: "text-sky-600",
    items: [
      "POST /api/deliberations/[id]/pathways — facilitator gated",
      "GET /api/deliberations/[id]/pathways — list per deliberation",
      "GET /api/institutions/[id]/pathways — list per institution (public-read)",
      "Pathway carries subject + isPublic + status (OPEN → CLOSED)",
      "Emits PathwayEvent { DRAFT_OPENED } and RoomLogbook { PATHWAY_OPENED }",
      "Inline opener in the deliberation room's Pathways tab",
    ],
  },
  {
    id: "audit",
    step: "2.2",
    title: "Hash-Chained Audit Log",
    description: "Tamper-evident PathwayEvent chain anchored at DRAFT_OPENED genesis",
    icon: Hash,
    color: "from-amber-500/10 to-yellow-500/15",
    iconColor: "text-amber-600",
    items: [
      "Per-pathway sha256 chain — every event hashes its predecessor",
      "verifyPathwayChain(pathwayId) returns { hashChainValid, failure? }",
      "GET /api/pathways/[id]/events surfaces validity in every response",
      "PathwayTimeline groups events into rounds (split on REVISED)",
      "9 event types — DRAFT_OPENED, ITEM_ADDED, SUBMITTED, ACKNOWLEDGED…",
      "ChainValidityBadge renders emerald (valid) or rose (broken)",
    ],
  },
  {
    id: "packets",
    step: "3.1",
    title: "Recommendation Packets",
    description: "Versioned, freezable bundles of claims, arguments, cards & notes",
    icon: ListChecks,
    color: "from-rose-500/10 to-pink-500/15",
    iconColor: "text-rose-600",
    items: [
      "RecommendationPacket — versioned with parentPacketId for revisions",
      "Items reference (targetType, targetId): claim / argument / card / note",
      "Snapshot JSON + snapshotHash captured at submit time",
      "PacketBuilder UI: reorder, edit commentary, add/remove (DRAFT only)",
      "POST /api/pathways/[id]/revise opens a new version with parent link",
      "Frozen on SUBMITTED — write attempts return 409 CONFLICT_PACKET_FROZEN",
    ],
  },
  {
    id: "channels",
    step: "3.2",
    title: "Submission Channels",
    description: "Send packets in-platform or via email / API / manual external channels",
    icon: Workflow,
    color: "from-indigo-500/10 to-violet-500/15",
    iconColor: "text-indigo-600",
    items: [
      "Channels: in_platform · email · api · manual",
      "externalReference field for off-platform tracking IDs",
      "Submission snapshot summary (item counts by kind) at submit time",
      "InstitutionalSubmission row created with submittedById + channel",
      "POST /api/submissions/[id]/acknowledge — operator one-click",
      "Submission shell auto-created on first response item if missing",
    ],
  },
  {
    id: "responses",
    step: "4.1",
    title: "Institutional Responses",
    description: "Per-item dispositions with coverage tracking and channel hints",
    icon: Inbox,
    color: "from-orange-500/10 to-amber-500/15",
    iconColor: "text-orange-600",
    items: [
      "5 dispositions: ACCEPTED · REJECTED · MODIFIED · DEFERRED · NO_RESPONSE",
      "ResponseIntake UI with role=radiogroup + aria-checked per item",
      "Coverage indicator: X of Y items dispositioned (Z%)",
      "Batch POST /api/responses/[id]/items — append or finalize",
      "responseStatus rolls up to acknowledged / partial / complete",
      "channelHint surfaced only when facilitatorMode is enabled",
    ],
  },
  {
    id: "plexus",
    step: "4.2",
    title: "Plexus Visualization",
    description: "Institutions appear as violet diamonds on the network graph",
    icon: Network,
    color: "from-fuchsia-500/10 to-purple-500/15",
    iconColor: "text-fuchsia-600",
    items: [
      "Network response extended with institutions[] array (additive)",
      "Institution nodes rendered as violet diamonds on outer ring",
      "institutional_pathway edge: dashed violet (deliberation → institution)",
      "pathway_response edge: dotted sky blue (institution → deliberation)",
      "Tooltips expose status, packet version, % accepted from edge.meta",
      "Toggle 'institutions' to show/hide the entire pathway overlay",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtMs(ms: number): string {
  const d = ms / (1000 * 60 * 60 * 24);
  if (d >= 1) return `${d.toFixed(1)}d`;
  const h = ms / (1000 * 60 * 60);
  return `${h.toFixed(1)}h`;
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-sky-100 text-sky-800 border-sky-200",
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  AWAITING_RESPONSE: "bg-amber-100 text-amber-800 border-amber-200",
  IN_REVISION: "bg-violet-100 text-violet-800 border-violet-200",
  CLOSED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const DISP_COLORS: Record<string, string> = {
  ACCEPTED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
  MODIFIED: "bg-amber-100 text-amber-800 border-amber-200",
  DEFERRED: "bg-slate-100 text-slate-700 border-slate-200",
  NO_RESPONSE: "bg-neutral-100 text-neutral-600 border-neutral-200",
};

const EVENT_DOT: Record<string, string> = {
  DRAFT_OPENED: "bg-sky-500",
  ITEM_ADDED: "bg-slate-400",
  SUBMITTED: "bg-violet-500",
  ACKNOWLEDGED: "bg-amber-500",
  RESPONDED: "bg-emerald-500",
  REVISED: "bg-fuchsia-500",
  CLOSED: "bg-neutral-500",
};

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE CARD
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: (typeof PATHWAY_FEATURES)[number] }) {
  const Icon = feature.icon;
  return (
    <div className="cardv2 h-full flex flex-col">
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${feature.color} ${feature.iconColor} shrink-0`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 font-mono">Step {feature.step}</span>
              <p className="font-semibold text-slate-900 text-[14px] leading-tight">{feature.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-snug">{feature.description}</p>
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/25">
            <Check className="w-2.5 h-2.5" />
            Done
          </span>
        </div>
      </div>
      <div className="px-5 pb-5 flex-1">
        <ul className="space-y-1.5">
          {feature.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-600 leading-snug">
              <div className="w-1 h-1 rounded-full bg-violet-400/70 flex-shrink-0 mt-[5px]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 1 — Pathway Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

function LifecycleDemo() {
  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/12 to-purple-500/12 text-violet-600">
            <Workflow className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Pathway Lifecycle</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-700 border border-violet-500/20">
            5 stages · hash-chained
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Every status transition is appended to the per-pathway hash chain. The
          timeline is replayable, verifiable, and never edited in place.
        </p>
      </div>

      {/* Pathway header preview */}
      <div className="rounded-xl border bg-white p-4 mb-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{MOCK_PATHWAY.subject}</span>
          <span className={`px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wide ${STATUS_BADGE[MOCK_PATHWAY.status]}`}>
            {MOCK_PATHWAY.status.replace("_", " ").toLowerCase()}
          </span>
          <span className="px-1.5 py-0.5 rounded-full border text-[10px] bg-slate-100 text-slate-600 border-slate-200">
            <Globe className="w-2.5 h-2.5 inline mr-0.5" /> public
          </span>
        </div>
        <div className="text-[11px] text-neutral-500 flex items-center gap-2 flex-wrap">
          <span className="text-violet-700">{MOCK_INSTITUTION.name}</span>
          <span>· {MOCK_INSTITUTION.kind.replace("_", " ").toLowerCase()}</span>
          <span>· packet v{MOCK_PATHWAY.currentPacketVersion}</span>
          <span>· opened {fmtDate(MOCK_PATHWAY.openedAt)}</span>
        </div>
      </div>

      {/* Hash-chain validity bar */}
      <div className="rounded-lg border bg-emerald-50/60 border-emerald-200 px-3 py-2 mb-4 flex items-center gap-2 text-xs text-emerald-800">
        <ShieldCheck className="w-4 h-4" />
        <span className="font-medium">Hash chain valid</span>
        <span className="text-emerald-600">· 6 events · last verified just now</span>
        <code className="ml-auto text-[10px] bg-white px-1.5 py-0.5 rounded border border-emerald-200">
          sha256: 7a4f…b21c
        </code>
      </div>

      {/* Timeline */}
      <ol className="relative ml-3 border-l-2 border-slate-200 space-y-3 pl-5">
        {MOCK_TIMELINE.map((evt, i) => (
          <li key={i} className="relative">
            <span
              className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full ring-2 ring-white ${EVENT_DOT[evt.type] ?? "bg-slate-400"}`}
            />
            <div className="rounded-lg border bg-white px-3 py-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">
                  {evt.type.replace(/_/g, " ").toLowerCase()}
                </span>
                <span className="px-1.5 py-0.5 rounded-full border text-[10px] bg-slate-50 text-slate-600">
                  round {evt.round}
                </span>
                <span className="text-neutral-400 ml-auto">{fmtDate(evt.at)}</span>
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>actor: {evt.actor}</span>
                {"channel" in evt && <span>· channel: {evt.channel}</span>}
                {"count" in evt && <span>· {evt.count} items</span>}
                {"accepted" in evt && (
                  <span>
                    · {evt.accepted} accepted · {evt.modified} modified · {evt.deferred} deferred
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 2 — Packet Builder
// ─────────────────────────────────────────────────────────────────────────────

function PacketBuilderDemo() {
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [channel, setChannel] = React.useState("in_platform");
  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-rose-500/12 to-pink-500/12 text-rose-600">
            <ListChecks className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Packet Builder</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-rose-500/10 to-pink-500/10 text-rose-700 border border-rose-500/20">
            DRAFT — editable
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Authoring surface for the recommendation packet. Drag-order, edit
          commentary, and choose a delivery channel before submission. Once
          SUBMITTED, the packet is frozen and a new revision must be opened to
          edit.
        </p>
      </div>

      {/* Header */}
      <div className="rounded-xl border bg-white p-4 mb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-neutral-500">
              Packet v{MOCK_PATHWAY.currentPacketVersion} · DRAFT · 4 items
            </div>
            <div className="text-sm font-medium text-slate-800 mt-0.5">
              Recommendations on transit equity policy — round 2 revision
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSubmitOpen((v) => !v)}
            className="px-3 py-1.5 text-xs rounded bg-slate-800 text-white"
          >
            Submit packet…
          </button>
        </div>
      </div>

      {/* Items */}
      <ul className="space-y-2 mb-3">
        {MOCK_PACKET_ITEMS.map((item, i) => (
          <li key={item.id} className="rounded-lg border bg-white p-3">
            <div className="flex items-start gap-3">
              <span className="text-[10px] font-mono text-neutral-400 w-5 text-right pt-0.5">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wide bg-violet-50 text-violet-700 border-violet-200">
                    {item.kind}
                  </span>
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {item.title}
                  </span>
                </div>
                {item.commentary && (
                  <p className="text-[12px] text-slate-600 mt-1 leading-snug">
                    {item.commentary}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 text-neutral-400 text-xs shrink-0">
                <button className="px-1.5 py-0.5 rounded hover:bg-slate-100" aria-label="Move up">↑</button>
                <button className="px-1.5 py-0.5 rounded hover:bg-slate-100" aria-label="Move down">↓</button>
                <button className="px-1.5 py-0.5 rounded hover:bg-slate-100">edit</button>
                <button className="px-1.5 py-0.5 rounded hover:bg-rose-50 text-rose-500">remove</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Add item form */}
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600 flex items-center gap-2">
        <PenLine className="w-3.5 h-3.5" />
        Add item — kind:{" "}
        <select className="border rounded px-1 py-0.5 bg-white" defaultValue="CLAIM">
          <option>CLAIM</option>
          <option>ARGUMENT</option>
          <option>CARD</option>
          <option>NOTE</option>
        </select>
        <input
          className="flex-1 border rounded px-2 py-0.5 bg-white"
          placeholder="Title or target reference…"
        />
        <button className="px-2 py-0.5 rounded border bg-white">add</button>
      </div>

      {/* Submit modal mock */}
      {submitOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="mt-4 rounded-xl border-2 border-violet-300 bg-white p-4 space-y-3"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
            <Send className="w-4 h-4" /> Submit packet
          </div>
          <div className="rounded border bg-violet-50/40 p-3 text-xs text-slate-700">
            <div className="font-medium mb-1">Snapshot summary</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {["CLAIM", "ARGUMENT", "CARD", "NOTE"].map((k) => {
                const c = MOCK_PACKET_ITEMS.filter((i) => i.kind === k).length;
                return (
                  <div key={k} className="rounded border bg-white py-1">
                    <div className="text-[10px] text-slate-500">{k}</div>
                    <div className="text-sm font-semibold">{c}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="text-xs">
            <label className="block text-[11px] text-slate-600 mb-1">Channel</label>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { v: "in_platform", icon: Plug, label: "In-platform" },
                  { v: "email", icon: Mail, label: "Email" },
                  { v: "api", icon: Plug, label: "API" },
                  { v: "manual", icon: PenLine, label: "Manual" },
                ] as const
              ).map(({ v, icon: I, label }) => {
                const active = channel === v;
                return (
                  <button
                    key={v}
                    onClick={() => setChannel(v)}
                    aria-pressed={active}
                    className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] ${
                      active
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-slate-700"
                    }`}
                  >
                    <I className="w-3 h-3" /> {label}
                  </button>
                );
              })}
            </div>
            {channel !== "in_platform" && (
              <input
                className="mt-2 w-full border rounded px-2 py-1 text-xs"
                placeholder="External reference (tracking ID, ticket, etc.)"
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setSubmitOpen(false)}
              className="px-3 py-1.5 text-xs rounded border bg-white"
            >
              Cancel
            </button>
            <button className="px-3 py-1.5 text-xs rounded bg-slate-800 text-white">
              Submit & freeze packet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 3 — Response Intake
// ─────────────────────────────────────────────────────────────────────────────

function ResponseIntakeDemo() {
  const dispositioned = MOCK_DISPOSITIONS.length;
  const total = MOCK_PACKET_ITEMS.length;
  const pct = Math.round((dispositioned / total) * 100);

  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-orange-500/12 to-amber-500/12 text-orange-600">
            <Inbox className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Response Intake</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-orange-500/10 to-amber-500/10 text-orange-700 border border-orange-500/20">
            Operator view
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Authorized institution operators acknowledge receipt and disposition each
          packet item. Coverage and disposition summaries roll up to the pathway
          status automatically.
        </p>
      </div>

      {/* Submission header */}
      <div className="rounded-xl border bg-white p-4 mb-3 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800">
            Submission acknowledged
          </div>
          <div className="text-[11px] text-neutral-500">
            Channel: in_platform · received Apr 9, 09:14 · acknowledged Apr 10, 11:00 ·
            ack latency {fmtMs(MOCK_INSTITUTION.medianAcknowledgementMs)}
          </div>
        </div>
        <span className="px-2 py-0.5 rounded-full border text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 uppercase">
          ack’d
        </span>
      </div>

      {/* Coverage bar */}
      <div className="rounded-lg border bg-white p-3 mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium text-slate-700">
            {dispositioned} of {total} items dispositioned
          </span>
          <span className="text-neutral-500">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-amber-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Disposition rows */}
      <ul className="space-y-2 mb-3">
        {MOCK_PACKET_ITEMS.map((item) => {
          const d = MOCK_DISPOSITIONS.find((x) => x.itemId === item.id);
          return (
            <li key={item.id} className="rounded-lg border bg-white p-3">
              <div className="flex items-start gap-3">
                <span className="px-1.5 py-0.5 rounded border text-[10px] uppercase tracking-wide bg-violet-50 text-violet-700 border-violet-200 shrink-0">
                  {item.kind}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">
                    {item.title}
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={`Disposition for ${item.title}`}
                    className="flex items-center gap-1 mt-2 flex-wrap"
                  >
                    {(
                      [
                        "ACCEPTED",
                        "MODIFIED",
                        "DEFERRED",
                        "REJECTED",
                        "NO_RESPONSE",
                      ] as const
                    ).map((opt) => {
                      const active = d?.disposition === opt;
                      return (
                        <span
                          key={opt}
                          role="radio"
                          aria-checked={active}
                          className={`px-1.5 py-0.5 rounded-full border text-[10px] uppercase tracking-wide ${
                            active
                              ? DISP_COLORS[opt]
                              : "bg-white text-slate-400 border-slate-200"
                          }`}
                        >
                          {opt.replace("_", " ").toLowerCase()}
                        </span>
                      );
                    })}
                  </div>
                  {d?.rationale && (
                    <p className="text-[12px] text-slate-600 mt-2 italic leading-snug">
                      “{d.rationale}”
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Summary */}
      <div className="rounded-xl border bg-violet-50/30 border-violet-200 p-3 text-xs text-slate-700 space-y-1">
        <div className="font-semibold text-violet-800">Response summary</div>
        <div>
          Status: <span className="font-medium">RESPONDED</span> · 2 accepted · 1
          modified · 1 deferred · 0 rejected
        </div>
        <div className="text-neutral-600">
          Median response latency for this institution:{" "}
          {fmtMs(MOCK_INSTITUTION.medianResponseMs)}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO 4 — Plexus Visualization
// ─────────────────────────────────────────────────────────────────────────────

function PlexusDemo() {
  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-fuchsia-500/12 to-purple-500/12 text-fuchsia-600">
            <Network className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Plexus Visualization</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-fuchsia-500/10 to-purple-500/10 text-fuchsia-700 border border-fuchsia-500/20">
            additive overlay
          </span>
        </div>
        <p className="text-sm text-slate-500">
          The Plexus network gains an institution overlay: violet diamonds for
          institutions, dashed edges for pathways, dotted edges for responses. A
          single &ldquo;institutions&rdquo; toggle hides the overlay if it gets
          noisy.
        </p>
      </div>

      {/* Mini schematic */}
      <div className="relative h-[260px] rounded-xl border bg-slate-50 mb-4 overflow-hidden">
        <svg viewBox="0 0 600 260" className="w-full h-full">
          <defs>
            <marker id="demo-arrow-pathway" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#8b5cf6" />
            </marker>
            <marker id="demo-arrow-response" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#0ea5e9" />
            </marker>
          </defs>

          {/* Edges */}
          <path
            d="M 200 130 Q 320 80 470 90"
            fill="none"
            stroke="#8b5cf6"
            strokeWidth={2}
            strokeDasharray="6 4"
            markerEnd="url(#demo-arrow-pathway)"
          />
          <path
            d="M 470 110 Q 320 180 200 150"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth={2}
            strokeDasharray="2 3"
            markerEnd="url(#demo-arrow-response)"
          />
          <text x="290" y="70" fontSize="10" fill="#7c3aed" fontWeight={600}>
            institutional_pathway · packet v2
          </text>
          <text x="285" y="200" fontSize="10" fill="#0369a1" fontWeight={600}>
            pathway_response · 60% accepted
          </text>

          {/* Deliberation node */}
          <g transform="translate(200,140)">
            <circle r={28} fill="#0ea5e9" fillOpacity={0.85} stroke="#0369a1" strokeWidth={1} />
            <text textAnchor="middle" y={4} className="fill-white text-[10px] font-semibold">
              DELIB
            </text>
            <text textAnchor="middle" y={48} className="fill-slate-700 text-[10px]">
              Transit equity room
            </text>
          </g>

          {/* Institution diamond */}
          <g transform="translate(470,100)">
            <rect
              x={-16}
              y={-16}
              width={32}
              height={32}
              transform="rotate(45)"
              fill="#8b5cf6"
              fillOpacity={0.9}
              stroke="#5b21b6"
              strokeWidth={1.5}
            />
            <text textAnchor="middle" y={4} className="fill-white text-[10px] font-bold">
              GOV
            </text>
            <text textAnchor="middle" y={42} className="fill-violet-800 text-[10px] font-medium">
              City of Portland — PBOT
            </text>
          </g>
        </svg>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border bg-white p-3">
          <div className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
            <Diamond className="w-3.5 h-3.5 text-violet-600" /> Nodes
          </div>
          <div className="space-y-1.5 text-slate-600">
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-sky-500" />
              <span>Deliberation room (existing)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 rotate-45 bg-violet-500" />
              <span>Institution (new — diamond)</span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="font-semibold text-slate-800 mb-2 flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-fuchsia-600" /> Edges
          </div>
          <div className="space-y-1.5 text-slate-600">
            <div className="flex items-center gap-2">
              <span className="inline-block w-6 h-[2px] bg-violet-500" style={{ borderTop: "2px dashed #8b5cf6" }} />
              <span>institutional_pathway · {`{ status, currentPacketVersion }`}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-6 h-[2px]" style={{ borderTop: "2px dotted #0ea5e9" }} />
              <span>pathway_response · {`{ responseStatus, acceptedRatio }`}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function PathwaysFeaturesPage() {
  return (
    <TooltipProvider>
      <Toaster position="bottom-right" richColors />
      <div
        className="min-h-screen"
        style={{
          background:
            "linear-gradient(145deg, #faf5ff 0%, #f5f3ff 25%, #ede9fe 50%, #f5f3ff 75%, #faf5ff 100%)",
        }}
      >
        {/* Sticky header */}
        <div
          className="border-b border-slate-900/[0.07] bg-white/85 backdrop-blur-xl sticky top-0 z-40 px-6 py-4"
          style={{
            boxShadow:
              "0 1px 3px rgba(124,58,237,0.06), 0 4px 16px -8px rgba(124,58,237,0.10)",
          }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                  <Landmark className="w-5 h-5 text-white" />
                </div>
                Institutional Pathways
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Forward deliberation outcomes to real institutions and track
                their response ·{" "}
               
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-violet-600 text-white shadow-sm">
                <Check className="w-3 h-3 mr-1" />
                Scope A · WS1
              </Badge>
              <Badge variant="outline" className="text-slate-500">
                14 API routes
              </Badge>
              <Badge variant="outline" className="text-slate-500">
                52 tests
              </Badge>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
          {/* Strategic context */}
          <div className="rounded-xl bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 border border-violet-100/80 p-5">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">
                  Where deliberation meets institutions.
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  An online deliberation only matters if it can reach the
                  decision-makers who can act on it. Institutional Pathways gives
                  every deliberation room a verifiable channel to a registered
                  institution — a city agency, a board, an NGO — bundles the
                  community&rsquo;s recommendations into a versioned packet,
                  records the institution&rsquo;s line-by-line response, and keeps
                  the entire exchange in a tamper-evident hash chain. No screenshots,
                  no broken links, no &ldquo;we sent them an email once.&rdquo;
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {[
                    { label: "Verified registry", color: "bg-violet-100 text-violet-700" },
                    { label: "Versioned packets", color: "bg-rose-100 text-rose-700" },
                    { label: "Hash-chained audit", color: "bg-amber-100 text-amber-700" },
                    { label: "Per-item dispositions", color: "bg-emerald-100 text-emerald-700" },
                    { label: "Public-read redaction", color: "bg-sky-100 text-sky-700" },
                    { label: "Plexus overlay", color: "bg-fuchsia-100 text-fuchsia-700" },
                    { label: "4 submission channels", color: "bg-indigo-100 text-indigo-700" },
                    { label: "Latency metrics", color: "bg-teal-100 text-teal-700" },
                  ].map((chip) => (
                    <span
                      key={chip.label}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${chip.color}`}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Lifecycle anatomy */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4">
              Pathway anatomy — five lifecycle stages
            </p>
            <div className="flex items-stretch gap-1">
              {[
                { step: "1", label: "Open the pathway", sub: "Facilitator forwards the room to a registered institution", module: "open", icon: Send, active: true },
                { step: "2", label: "Author the packet", sub: "Bundle claims, arguments, cards & notes with commentary", module: "author", icon: ListChecks },
                { step: "3", label: "Submit & freeze", sub: "Packet is snapshot-hashed and locked at submission time", module: "submit", icon: Lock },
                { step: "4", label: "Acknowledge & respond", sub: "Operator dispositions every item with rationale", module: "respond", icon: Inbox },
                { step: "5", label: "Revise or close", sub: "Open a new packet version, or close the pathway with summary", module: "revise", icon: GitBranch },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-lg p-3 border transition-all ${
                      item.active
                        ? "border-violet-300 bg-violet-50 ring-2 ring-violet-200"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          item.active ? "bg-violet-500 text-white" : "bg-slate-300 text-white"
                        }`}
                      >
                        {item.step}
                      </span>
                      <Icon
                        className={`w-3.5 h-3.5 ${item.active ? "text-violet-600" : "text-slate-400"}`}
                      />
                    </div>
                    <p
                      className={`text-xs font-semibold leading-tight ${
                        item.active ? "text-violet-800" : "text-slate-700"
                      }`}
                    >
                      {item.label}
                    </p>
                    <p
                      className={`text-[11px] mt-0.5 leading-snug ${
                        item.active ? "text-violet-600" : "text-slate-400"
                      }`}
                    >
                      {item.sub}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Institution profile preview */}
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/12 to-purple-500/12 text-violet-700">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-semibold text-slate-900">
                    {MOCK_INSTITUTION.name}
                  </span>
                  {MOCK_INSTITUTION.verified && (
                    <span className="px-1.5 py-0.5 rounded-full border text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      <ShieldCheck className="w-2.5 h-2.5 inline mr-0.5" />
                      verified
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{MOCK_INSTITUTION.kind.replace("_", " ").toLowerCase()}</span>
                  <span>· {MOCK_INSTITUTION.jurisdiction}</span>
                  <span>· slug: {MOCK_INSTITUTION.slug}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                  <div className="rounded-lg border bg-slate-50 p-2.5">
                    <div className="text-[10px] text-slate-500">active pathways</div>
                    <div className="text-base font-semibold text-slate-800">
                      {MOCK_INSTITUTION.activePathways}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-2.5">
                    <div className="text-[10px] text-slate-500">members</div>
                    <div className="text-base font-semibold text-slate-800">
                      {MOCK_INSTITUTION.members}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-2.5">
                    <div className="text-[10px] text-slate-500">median ack</div>
                    <div className="text-base font-semibold text-slate-800">
                      {fmtMs(MOCK_INSTITUTION.medianAcknowledgementMs)}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-2.5">
                    <div className="text-[10px] text-slate-500">median response</div>
                    <div className="text-base font-semibold text-slate-800">
                      {fmtMs(MOCK_INSTITUTION.medianResponseMs)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature inventory */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">
                  Feature Inventory
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  8 feature areas across registry, lifecycle, packets, and response.
                  All routes ship with role gating and integration tests.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PATHWAY_FEATURES.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
          </section>

          {/* Interactive demos */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">
                Interactive Demos
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Visual previews of each surface using mock pathway data. The
                production components mount inside the deliberation room&rsquo;s
                Pathways tab and on /institutions/[id].
              </p>
            </div>
            <Tabs defaultValue="lifecycle" className="space-y-4">
              <TabsList className="bg-white border shadow-sm">
                <TabsTrigger value="lifecycle" className="gap-1.5">
                  <Workflow className="w-4 h-4" />
                  Lifecycle &amp; Audit
                </TabsTrigger>
                <TabsTrigger value="packet" className="gap-1.5">
                  <ListChecks className="w-4 h-4" />
                  Packet Builder
                </TabsTrigger>
                <TabsTrigger value="response" className="gap-1.5">
                  <Inbox className="w-4 h-4" />
                  Response Intake
                </TabsTrigger>
                <TabsTrigger value="plexus" className="gap-1.5">
                  <Network className="w-4 h-4" />
                  Plexus Overlay
                </TabsTrigger>
              </TabsList>

              <TabsContent value="lifecycle">
                <LifecycleDemo />
              </TabsContent>
              <TabsContent value="packet">
                <PacketBuilderDemo />
              </TabsContent>
              <TabsContent value="response">
                <ResponseIntakeDemo />
              </TabsContent>
              <TabsContent value="plexus">
                <PlexusDemo />
              </TabsContent>
            </Tabs>
          </section>

          {/* Architecture grid */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">
                How It&rsquo;s Built
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Four layers — schema, services, routes, UI — each with role
                gating, hash-chained events, and integration tests.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-violet-500/15 text-violet-600 text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <ScrollText className="w-3.5 h-3.5 text-violet-600" />
                  <p className="text-sm font-semibold text-slate-800">Schema</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-violet-700">
                    Institution / InstitutionMember
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-purple-700">
                    InstitutionalPathway / PathwayEvent
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-rose-700">
                    RecommendationPacket / Item
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-orange-700">
                    InstitutionalSubmission / Response / Item
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Indexed by{" "}
                  <code className="bg-white/50 px-1 rounded">(deliberationId, status)</code>,{" "}
                  <code className="bg-white/50 px-1 rounded">(targetType, targetId)</code>, and{" "}
                  <code className="bg-white/50 px-1 rounded">(pathwayId, version)</code>.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-sm font-semibold text-slate-800">Services</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-emerald-700">
                    pathwayService.ts
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-teal-700">
                    packetService.ts
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-cyan-700">
                    responseService.ts
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-amber-700">
                    chain.ts (sha256 chain)
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  36 unit tests cover{" "}
                  <code className="bg-white/50 px-1 rounded">openPathway</code>,{" "}
                  <code className="bg-white/50 px-1 rounded">submitPacket</code>,
                  hash-chain genesis, and frozen-write conflicts.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-sky-500/15 text-sky-600 text-[11px] font-bold flex items-center justify-center">
                    3
                  </span>
                  <Plug className="w-3.5 h-3.5 text-sky-600" />
                  <p className="text-sm font-semibold text-slate-800">API Routes</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-sky-700">
                    /api/institutions[/...]
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-blue-700">
                    /api/deliberations/[id]/pathways
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-indigo-700">
                    /api/pathways/[id]/{`{events,revise,close}`}
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-purple-700">
                    /api/submissions/[id]/{`{ack,responses}`}
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  All routes wrap{" "}
                  <code className="bg-white/50 px-1 rounded">requireAuth</code> +
                  Zod schemas. Validation errors return{" "}
                  <code className="bg-white/50 px-1 rounded">422</code> via{" "}
                  <code className="bg-white/50 px-1 rounded">zodError()</code>.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-fuchsia-500/15 text-fuchsia-600 text-[11px] font-bold flex items-center justify-center">
                    4
                  </span>
                  <Eye className="w-3.5 h-3.5 text-fuchsia-600" />
                  <p className="text-sm font-semibold text-slate-800">UI Layer</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-fuchsia-700">
                    PathwayTimeline.tsx
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-purple-700">
                    InstitutionProfile.tsx
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-rose-700">
                    PacketBuilder.tsx · ResponseIntake.tsx
                  </div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-violet-700">
                    DeliberationPathwaysTab.tsx · PathwayBadge.tsx
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Mounted in <code className="bg-white/50 px-1 rounded">/institutions/[id]</code> and the
                  deliberation room&rsquo;s <code className="bg-white/50 px-1 rounded">Pathways</code> tab.
                  Plexus overlay lives in{" "}
                  <code className="bg-white/50 px-1 rounded">components/agora/Plexus.tsx</code>.
                </p>
              </div>
            </div>
          </section>

          {/* Key files */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Key Files</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Primary services, routes, and components for institutional pathways.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y">
              {[
                { tag: "Service", path: "lib/pathways/pathwayService.ts", desc: "openPathway, closePathway, listPathways" },
                { tag: "Service", path: "lib/pathways/packetService.ts", desc: "createPacket, addItem, submitPacket, revisePacket" },
                { tag: "Service", path: "lib/pathways/responseService.ts", desc: "acknowledgeSubmission, recordDisposition, finalizeResponse" },
                { tag: "Service", path: "lib/pathways/chain.ts", desc: "appendEvent, verifyPathwayChain (sha256 anchor)" },
                { tag: "Service", path: "lib/pathways/auth.ts", desc: "isPlatformAdmin, isFacilitator, canEditPacket, loaders" },
                { tag: "Route", path: "app/api/institutions/route.ts", desc: "POST (admin) + GET list" },
                { tag: "Route", path: "app/api/institutions/[id]/pathways/route.ts", desc: "GET pathways for an institution (public-read)" },
                { tag: "Route", path: "app/api/deliberations/[id]/pathways/route.ts", desc: "POST open + GET list (facilitator)" },
                { tag: "Route", path: "app/api/pathways/[id]/events/route.ts", desc: "GET events with chain validity" },
                { tag: "Route", path: "app/api/pathways/[id]/revise/route.ts", desc: "POST open new revision" },
                { tag: "Route", path: "app/api/submissions/[id]/acknowledge/route.ts", desc: "POST acknowledge (operator)" },
                { tag: "Route", path: "app/api/responses/[id]/items/route.ts", desc: "POST batch dispositions" },
                { tag: "Route", path: "app/api/pathways/lookup-by-target/route.ts", desc: "GET inline badge lookup by claim/argument" },
                { tag: "Component", path: "components/pathways/PathwayTimeline.tsx", desc: "Hash-chained event timeline grouped by round" },
                { tag: "Component", path: "components/pathways/InstitutionProfile.tsx", desc: "Public institution page with metrics + pathways" },
                { tag: "Component", path: "components/pathways/PacketBuilder.tsx", desc: "Authoring + submit modal with snapshot summary" },
                { tag: "Component", path: "components/pathways/ResponseIntake.tsx", desc: "Operator dispositioning with coverage indicator" },
                { tag: "Component", path: "components/pathways/DeliberationPathwaysTab.tsx", desc: "Deliberation-room Pathways tab + open form" },
                { tag: "Component", path: "components/pathways/PathwayBadge.tsx", desc: "Inline 'forwarded to <institution> v<N>' chip" },
                { tag: "Component", path: "components/agora/Plexus.tsx", desc: "Institution diamonds + dashed pathway edges (overlay)" },
                { tag: "Page", path: "app/institutions/[id]/page.tsx", desc: "Public institution profile route" },
                { tag: "Test", path: "__tests__/api/pathways.routes.test.ts", desc: "16 integration tests — auth, gating, redaction" },
                { tag: "Doc", path: "docs/pathways/API.md", desc: "Endpoint reference & response shapes" },
                { tag: "Doc", path: "docs/DelibDemocracyScopeA_Roadmap.md", desc: "Scope A roadmap & exit criteria" },
              ].map((file, i) => {
                const tagColors: Record<string, string> = {
                  Service: "bg-emerald-100 text-emerald-700",
                  Route: "bg-sky-100 text-sky-700",
                  Component: "bg-violet-100 text-violet-700",
                  Page: "bg-indigo-100 text-indigo-700",
                  Test: "bg-amber-100 text-amber-700",
                  Doc: "bg-slate-100 text-slate-600",
                };
                return (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${tagColors[file.tag]}`}
                    >
                      {file.tag}
                    </span>
                    <code className="font-mono text-xs text-slate-700 flex-1 truncate">
                      {file.path}
                    </code>
                    <span className="text-xs text-slate-400 hidden md:block truncate max-w-[40%] text-right">
                      {file.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Footer */}
          <footer className="py-6 border-t border-slate-900/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-500">
              Mesh — Institutional Pathways · Scope A · WS1
            </span>
            <div className="flex items-center gap-3">
              <a
                href="/test/social-features"
                className="text-violet-500 hover:underline"
              >
                Social demo →
              </a>
              <span className="text-slate-300">·</span>
              <a
                href="/test/deliberation-features"
                className="text-violet-500 hover:underline"
              >
                Deliberation demo →
              </a>
              <span className="text-slate-300">·</span>
              <a
                href="/test/plexus-features"
                className="text-violet-500 hover:underline"
              >
                Plexus demo →
              </a>
              <span className="text-slate-300">·</span>
              <span>April 2026</span>
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
