"use client";

/**
 * Embeddable Argument Widget — Phase 2 Demo
 *
 * Interactive demonstration of all Phase 2 deliverables:
 *
 * PHASE 2 – CREATION & SHARE FLOW:
 * - 2.1 ShareArgumentModal — Link / Embed / Markdown / Plain Text tabs + OG preview
 * - 2.2 Share button wired into ArgumentCardV2 action row
 * - 2.3 ShareClaimModal — same pattern for claims
 * - 2.4 POST /api/arguments/quick — atomic create: Claim + Evidence + Argument + Permalink
 * - 2.5 QuickArgumentBuilder component + standalone /quick page
 * - 2.6 GET /api/unfurl — SSRF-guarded URL metadata extraction, 60/hr rate limit
 * - 2.7 "My Arguments" auto-deliberation — hostType: "free", auto-created on first quick arg
 *
 * Accessible at: /test/embeddable-widget-phase2
 */

import { useState, useRef, useEffect } from "react";
import { toast, Toaster } from "sonner";
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  Link2,
  Code,
  AlignLeft,
  FileText,
  Globe,
  Plus,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Shield,
  Zap,
  BookOpen,
  Scale,
  Hash,
  Braces,
  FileCode,
  Monitor,
  MessageSquare,
  Send,
  RefreshCw,
  Layers,
  FolderOpen,
  Sparkles,
  Image as ImageIcon,
  ClipboardCopy,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = "https://isonomia.app";

const MOCK_ARGUMENTS = {
  epistemic: {
    id: "arg-demo-1",
    identifier: "rK7pA2mN",
    slug: "recommendation-algorithms-epistemic-harm",
    text: "Recommendation algorithms trained on engagement metrics systematically select for content that triggers strong emotional responses. This constitutes a systemic harm to the epistemic commons.",
    confidence: 78,
    scheme: "Argumentation from Analogy",
    schemeColor: "bg-violet-100 text-violet-700",
    deliberation: { title: "The Future of Online Civic Discourse" },
    conclusion: {
      text: "Recommendation algorithms produce systemic epistemic harm in democratic contexts",
    },
    evidence: [
      { title: "Reuters Institute Digital News Report 2025", type: "EMPIRICAL" },
      { title: "Levy et al., \"The Effect of Social Media on News Consumption\", NBER 2024", type: "EMPIRICAL" },
      { title: "Habermas, \"Technology and Science as Ideology\"", type: "THEORETICAL" },
    ],
    author: { name: "Dr. Priya Anand", username: "panand" },
    supportCount: 34,
    challengeCount: 12,
  },
  carbon: {
    id: "arg-demo-2",
    identifier: "mB4qC8dX",
    slug: "carbon-pricing-efficiency-argument",
    text: "Economic theory and empirical evidence from BC, Sweden, and the EU ETS all demonstrate that carbon pricing creates a direct cost signal that propagates through supply chains.",
    confidence: 65,
    scheme: "Practical Reasoning",
    schemeColor: "bg-emerald-100 text-emerald-700",
    deliberation: { title: "Climate Policy Deliberation 2026" },
    conclusion: {
      text: "Carbon pricing is the most economically efficient mechanism for reducing emissions at scale",
    },
    evidence: [
      { title: "Murray & Rivers, \"British Columbia's Revenue-Neutral Carbon Tax\", JPUBECO 2015", type: "EMPIRICAL" },
      { title: "World Bank Carbon Pricing Dashboard 2025", type: "EMPIRICAL" },
    ],
    author: { name: "Prof. Marcus Chen", username: "mchen" },
    supportCount: 28,
    challengeCount: 19,
  },
};

const MOCK_CLAIMS = {
  algorithms: {
    id: "claim-demo-1",
    moid: "CLAIM-7A3B",
    text: "Social media recommendation systems systematically amplify divisive content over informative content",
    author: { name: "Dr. Priya Anand", username: "panand" },
  },
  carbonTax: {
    id: "claim-demo-2",
    moid: "CLAIM-2F9E",
    text: "Carbon taxes with dividend rebates are net positive for low-income households compared to unpriced carbon pollution",
    author: { name: "Prof. Marcus Chen", username: "mchen" },
  },
};

type ArgKey = keyof typeof MOCK_ARGUMENTS;
type ClaimKey = keyof typeof MOCK_CLAIMS;

// Simulated unfurl results for the demo
const MOCK_UNFURL: Record<string, { title: string; favicon: string; site: string }> = {
  "https://nber.org": {
    title: "Levy et al. — The Effect of Social Media on News Consumption",
    favicon: "https://www.google.com/s2/favicons?domain=nber.org&sz=32",
    site: "nber.org",
  },
  "https://science.org": {
    title: "Huszár et al. — Algorithmic Amplification of Politics on Twitter, PNAS 2022",
    favicon: "https://www.google.com/s2/favicons?domain=science.org&sz=32",
    site: "science.org",
  },
  "https://worldbank.org": {
    title: "World Bank Carbon Pricing Dashboard 2025",
    favicon: "https://www.google.com/s2/favicons?domain=worldbank.org&sz=32",
    site: "worldbank.org",
  },
  "https://reuters.com": {
    title: "Reuters Institute Digital News Report 2025",
    favicon: "https://www.google.com/s2/favicons?domain=reuters.com&sz=32",
    site: "reuters.com",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 FEATURE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const PHASE2_FEATURES = [
  {
    id: "share-argument-modal",
    step: "2.1",
    title: "Share Argument Modal",
    description: "Full-featured share modal with OG preview and 4 export formats",
    icon: Share2,
    color: "from-sky-500/10 to-blue-500/15",
    iconColor: "text-sky-600",
    items: [
      "Fetches permalink on mount via GET /api/arguments/[id]/permalink",
      "OG image preview — shows 1200×630 card inline in the modal",
      "Tab 1: Link — copy permalink + Reddit / Twitter / LinkedIn platform buttons",
      "Tab 2: Embed — <iframe> snippet, copy button",
      "Tab 3: Markdown — **Claim:** + evidence count + confidence + link",
      "Tab 4: Plain Text — same content without Markdown syntax",
      "All copies use navigator.clipboard.writeText + sonner toast feedback",
    ],
  },
  {
    id: "share-button",
    step: "2.2",
    title: "Share Button in ArgumentCardV2",
    description: "Inline Share pill wired into the argument action row",
    icon: Link2,
    color: "from-indigo-500/10 to-violet-500/15",
    iconColor: "text-indigo-600",
    items: [
      "ShareButtonInline component added just before PermalinkCopyButton",
      "Sky-coloured pill button: bg-sky-50 border-sky-200 text-sky-700",
      "On click: openModal(<ShareArgumentModal argumentId={id} claimText={…} …/>)",
      "Passes confidence, schemeName from card props into the modal",
      "Share2 icon from lucide-react — consistent with other action pills",
    ],
  },
  {
    id: "share-claim-modal",
    step: "2.3",
    title: "Share Claim Modal",
    description: "Same share pattern for claims using moid as natural identifier",
    icon: Hash,
    color: "from-violet-500/10 to-purple-500/15",
    iconColor: "text-violet-600",
    items: [
      "Uses claimPermalinkService URL helpers — no permalink table needed",
      "3 tabs: Link / Embed / Text (Markdown + Plain Text combined)",
      "Link tab: copy permalink + Reddit / Twitter / LinkedIn platform buttons",
      "getClaimIframeCode(moid, 'auto', false) generates embed snippet",
      "getClaimPermalinkUrl(moid) → /c/{moid}",
      "No async fetch needed — moid is the identifier, URL is deterministic",
    ],
  },
  {
    id: "quick-api",
    step: "2.4",
    title: "POST /api/arguments/quick",
    description: "Atomic argument + permalink creation in a single API call",
    icon: Zap,
    color: "from-amber-500/10 to-orange-500/15",
    iconColor: "text-amber-600",
    items: [
      "Auth: getCurrentUserId() — 401 if unauthenticated",
      "Rate limit: 20 quick args per user per hour via Upstash fixedWindow",
      "Zod schema: claim (strip HTML, max 2000), evidence[] (max 10 URLs), reasoning?, deliberationId?, isPublic",
      "SSRF guard: isSafePublicUrl() on every evidence URL before fetch",
      "Auto-unfurls evidence titles via getOrFetchLinkPreview() (best-effort)",
      "prisma.claim.upsert on moid — idempotent, no duplicates",
      "Creates ClaimEvidence[] + Argument + calls getOrCreatePermalink()",
      "Returns: argument, claim, permalink {shortCode, slug, url}, embedCodes {link, iframe, markdown, plainText}",
    ],
  },
  {
    id: "quick-builder",
    step: "2.5",
    title: "QuickArgumentBuilder + /quick Page",
    description: "Lightweight creation form — claim to shareable link in < 60s",
    icon: Sparkles,
    color: "from-emerald-500/10 to-teal-500/15",
    iconColor: "text-emerald-600",
    items: [
      "Section 1: Claim — large textarea, 2000 char limit, live counter",
      "Section 2: Evidence — URL rows with on-blur auto-unfurl (title + favicon preview)",
      "Section 3: Reasoning — collapsible optional textarea",
      "Primary: \"Create & Copy Link\" — calls /api/arguments/quick, copies permalink",
      "Secondary: \"Copy Embed\" — copies <iframe> code",
      "Tertiary: \"Share to Reddit\" / \"Share to Twitter\" — creates then opens platform URL",
      "Success state shows permalink input, Copy Embed, Copy Markdown, View buttons",
      "/quick page accepts ?claim= and ?url= params for browser extension pre-fill",
    ],
  },
  {
    id: "unfurl-api",
    step: "2.6",
    title: "GET /api/unfurl",
    description: "Server-side URL metadata extraction with SSRF protection",
    icon: Globe,
    color: "from-pink-500/10 to-rose-500/15",
    iconColor: "text-pink-600",
    items: [
      "Auth: getCurrentUserId() — 401 if unauthenticated",
      "Rate limit: 60 unfurls per user per hour via Upstash fixedWindow",
      "Decodes ?url= param, calls isSafePublicUrl() — blocks localhost, private IPs, non-HTTP",
      "Delegates to getOrFetchLinkPreview() — 12h TTL cache, deduped by URL hash",
      "Returns: { title, description, image, favicon (via Google S2), url }",
      "Cache-Control: public, max-age=3600 on responses",
      "Used by QuickArgumentBuilder on evidence URL blur event",
    ],
  },
  {
    id: "my-arguments",
    step: "2.7",
    title: '"My Arguments" Auto-Deliberation',
    description: "Auto-creates a standalone deliberation for quick args with no deliberationId",
    icon: FolderOpen,
    color: "from-slate-500/10 to-zinc-500/15",
    iconColor: "text-slate-600",
    items: [
      "Option A implemented: auto-create per-user deliberation (vs. nullable deliberationId)",
      "hostType: \"free\" — uses existing enum value, no schema change required",
      "hostId: \"standalone-my-arguments-{userId}\" — deterministic, idempotent",
      "title: \"My Arguments\" — visible in user's deliberation list",
      "getOrCreateMyArgumentsDeliberation(userId) — findFirst, create if not found",
      "All standalone quick arguments collect in one browsable location",
    ],
  },
];

const PHASE2_ROUTES = [
  { method: "POST", path: "/api/arguments/quick", description: "Create argument + permalink atomically", tag: "API" },
  { method: "GET", path: "/api/unfurl?url=", description: "Extract OG metadata from a URL", tag: "API" },
  { method: "GET", path: "/quick", description: "Standalone Quick Argument Builder page", tag: "Page" },
  { method: "GET", path: "/api/arguments/[id]/permalink", description: "Get/create permalink (Phase 1, used by share modal)", tag: "API" },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  };
  return { copiedKey, copy };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE CARD
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: (typeof PHASE2_FEATURES)[0] }) {
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
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 font-mono">Step {feature.step}</span>
              </div>
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
              <div className="w-1 h-1 rounded-full bg-sky-400/70 flex-shrink-0 mt-[5px]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Share Modal
// ─────────────────────────────────────────────────────────────────────────────

function ShareModalDemo() {
  const [activeType, setActiveType] = useState<"argument" | "claim">("argument");
  const [activeArgKey, setActiveArgKey] = useState<ArgKey>("epistemic");
  const [activeClaimKey, setActiveClaimKey] = useState<ClaimKey>("algorithms");
  const [activeTab, setActiveTab] = useState<"link" | "embed" | "markdown" | "text">("link");
  const { copiedKey, copy } = useCopy();

  const arg = MOCK_ARGUMENTS[activeArgKey];
  const claim = MOCK_CLAIMS[activeClaimKey];

  const permalink = activeType === "argument"
    ? `${BASE_URL}/a/${arg.identifier}`
    : `${BASE_URL}/c/${claim.moid}`;

  const ogImage = activeType === "argument"
    ? `${BASE_URL}/api/og/argument/${arg.identifier}`
    : `${BASE_URL}/api/og/claim/${claim.moid}`;

  const embedCode = activeType === "argument"
    ? `<iframe\n  src="${BASE_URL}/embed/argument/${arg.identifier}?theme=auto"\n  width="600"\n  height="400"\n  frameborder="0"\n  allow="clipboard-read; clipboard-write"\n  loading="lazy"\n  title="Isonomia Argument"\n></iframe>`
    : `<iframe\n  src="${BASE_URL}/embed/claim/${claim.moid}?theme=auto"\n  width="600"\n  height="280"\n  frameborder="0"\n  loading="lazy"\n  title="Isonomia Claim"\n></iframe>`;

  const claimText = activeType === "argument" ? arg.conclusion.text : claim.text;
  const truncated = claimText.length > 120 ? claimText.slice(0, 120) + "…" : claimText;

  const markdownText = activeType === "argument"
    ? [
        `**Claim:** ${arg.conclusion.text}`,
        "",
        `**Evidence:** ${arg.evidence.length} sources cited`,
        `**Confidence:** ${arg.confidence}%`,
        `**Scheme:** ${arg.scheme}`,
        "",
        `[View full argument on Isonomia](${permalink})`,
      ].join("\n")
    : [`**Claim:** ${claim.text}`, "", `[View claim on Isonomia](${permalink})`].join("\n");

  const plainText = activeType === "argument"
    ? [
        `CLAIM: ${arg.conclusion.text}`,
        "",
        `Evidence: ${arg.evidence.length} sources cited`,
        `Confidence: ${arg.confidence}%`,
        `Scheme: ${arg.scheme}`,
        "",
        `Link: ${permalink}`,
      ].join("\n")
    : [`CLAIM: ${claim.text}`, "", `Link: ${permalink}`].join("\n");

  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(permalink)}&title=${encodeURIComponent(truncated)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(truncated)}&url=${encodeURIComponent(permalink)}`;
  const linkedinUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(permalink)}&title=${encodeURIComponent(truncated)}`;

  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500/12 to-blue-500/12 text-sky-600">
            <Share2 className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Share Modal</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-sky-500/10 to-blue-500/10 text-sky-700 border border-sky-500/20">Interactive</span>
        </div>
        <p className="text-sm text-slate-500">
          One click from any argument or claim. The modal fetches the permalink, generates embed codes, and gives users four copy formats plus platform share buttons.
        </p>
      </div>

      <div className="space-y-4">
        {/* Type Switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveType("argument")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              activeType === "argument"
                ? "border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-200"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Scale className="w-4 h-4" />
            ShareArgumentModal
          </button>
          <button
            onClick={() => setActiveType("claim")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              activeType === "claim"
                ? "border-violet-500 bg-violet-50 text-violet-700 ring-2 ring-violet-200"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Hash className="w-4 h-4" />
            ShareClaimModal
          </button>
        </div>

        {/* Demo selector */}
        {activeType === "argument" ? (
          <div className="flex gap-2">
            {(Object.keys(MOCK_ARGUMENTS) as ArgKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveArgKey(key)}
                className={`flex-1 text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                  activeArgKey === key
                    ? "border-sky-400 bg-sky-50 ring-2 ring-sky-200"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-medium text-slate-700 truncate">{MOCK_ARGUMENTS[key].conclusion.text.slice(0, 55)}…</p>
                <p className="text-slate-400 mt-0.5">{MOCK_ARGUMENTS[key].scheme}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            {(Object.keys(MOCK_CLAIMS) as ClaimKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveClaimKey(key)}
                className={`flex-1 text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                  activeClaimKey === key
                    ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-medium text-slate-700 truncate">{MOCK_CLAIMS[key].text.slice(0, 60)}…</p>
                <p className="text-slate-400 mt-0.5">moid: {MOCK_CLAIMS[key].moid}</p>
              </button>
            ))}
          </div>
        )}

        {/* Modal Simulation */}
        <div className="rounded-xl border border-slate-200 shadow-lg bg-white overflow-hidden max-w-lg mx-auto">
          {/* Modal chrome */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <Share2 className="w-4 h-4 text-sky-600" />
              Share {activeType === "argument" ? "Argument" : "Claim"}
            </div>
            <button
              onClick={() => toast.info("Closes via Shadcn DialogClose")}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-100 transition-all"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* OG preview */}
            <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              {/* Simulated OG card */}
              <div
                className="relative overflow-hidden"
                style={{
                  height: 140,
                  background:
                    activeType === "argument"
                      ? "linear-gradient(140deg, #0d0b1e 0%, #1a1363 35%, #2d2080 65%, #1e1850 100%)"
                      : "linear-gradient(140deg, #130523 0%, #3b0f72 45%, #5b21b6 100%)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-[0.05]"
                  style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }}
                />
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{ background: activeType === "argument" ? "linear-gradient(to right, #6366f1, #7c3aed)" : "linear-gradient(to right, #7c3aed, #a855f7)" }}
                />
                <div className="absolute inset-0 p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                      <span className="text-white font-bold" style={{ fontSize: 7 }}>I</span>
                    </div>
                    <span className="text-white/50 text-[9px] font-semibold tracking-widest uppercase">Isonomia · {activeType === "argument" ? "Argument" : "Claim"}</span>
                  </div>
                  <p className="text-white font-semibold text-xs leading-snug line-clamp-2 mb-auto">
                    {claimText}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-white/30 text-[9px]">
                      {activeType === "argument" ? `${arg.confidence}% confidence · ${arg.evidence.length} sources` : claim.moid}
                    </span>
                    <span className="text-white/25 text-[9px] font-mono">{BASE_URL}</span>
                  </div>
                </div>
              </div>
              <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200">
                <p className="text-[10px] text-slate-400 font-mono truncate">{ogImage}</p>
              </div>
            </div>

            {/* Tabs */}
            <div>
              <div className="flex rounded-lg border overflow-hidden mb-3">
                {(activeType === "argument"
                  ? (["link", "embed", "markdown", "text"] as const)
                  : (["link", "embed", "text"] as const)
                ).map((tab) => {
                  const labels: Record<string, string> = { link: "Link", embed: "Embed", markdown: "Markdown", text: "Plain" };
                  const icons: Record<string, React.ReactNode> = {
                    link: <ExternalLink className="w-3 h-3" />,
                    embed: <Code className="w-3 h-3" />,
                    markdown: <AlignLeft className="w-3 h-3" />,
                    text: <FileText className="w-3 h-3" />,
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab as any)}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium transition-colors border-l first:border-l-0 ${
                        activeTab === tab ? "bg-sky-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {icons[tab]}
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              {activeTab === "link" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={permalink}
                      className="flex-1 border rounded-md px-3 py-1.5 text-xs font-mono text-slate-600 bg-slate-50 focus:outline-none"
                    />
                    <button
                      onClick={() => copy(permalink, "permalink")}
                      className="px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50 transition-colors"
                    >
                      {copiedKey === "permalink" ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <a href={redditUrl} target="_blank" rel="noopener noreferrer">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-200 text-xs font-medium transition-all text-slate-700">
                        <ExternalLink className="w-3 h-3" />
                        Reddit
                      </button>
                    </a>
                    <a href={twitterUrl} target="_blank" rel="noopener noreferrer">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-sky-50 hover:border-sky-200 text-xs font-medium transition-all text-slate-700">
                        <ExternalLink className="w-3 h-3" />
                        Twitter / X
                      </button>
                    </a>
                    <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 text-xs font-medium transition-all text-slate-700">
                        <ExternalLink className="w-3 h-3" />
                        LinkedIn
                      </button>
                    </a>
                  </div>
                </div>
              )}

              {activeTab === "embed" && (
                <div className="space-y-2">
                  <textarea
                    readOnly
                    value={embedCode}
                    rows={5}
                    className="w-full font-mono text-[11px] p-3 rounded-md border border-slate-200 bg-slate-50 resize-none text-slate-600"
                  />
                  <button
                    onClick={() => copy(embedCode, "embed")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium transition-all"
                  >
                    {copiedKey === "embed" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    Copy Embed Code
                  </button>
                </div>
              )}

              {(activeTab === "markdown") && (
                <div className="space-y-2">
                  <textarea
                    readOnly
                    value={markdownText}
                    rows={6}
                    className="w-full font-mono text-[11px] p-3 rounded-md border border-slate-200 bg-slate-50 resize-none text-slate-600"
                  />
                  <button
                    onClick={() => copy(markdownText, "markdown")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium transition-all"
                  >
                    {copiedKey === "markdown" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                    Copy Markdown
                  </button>
                </div>
              )}

              {activeTab === "text" && (
                <div className="space-y-2">
                  <textarea
                    readOnly
                    value={activeType === "claim" ? `${markdownText}\n\n---\n${plainText}` : plainText}
                    rows={6}
                    className="w-full font-mono text-[11px] p-3 rounded-md border border-slate-200 bg-slate-50 resize-none text-slate-600"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => copy(markdownText, "md-text")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium transition-all"
                    >
                      {copiedKey === "md-text" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                      Markdown
                    </button>
                    <button
                      onClick={() => copy(plainText, "plain")}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium transition-all"
                    >
                      {copiedKey === "plain" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
                      Plain Text
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => toast.info("Closes via Shadcn DialogClose")}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm text-slate-600 font-medium transition-all"
            >
              Close
            </button>
          </div>
        </div>

        {/* Integration note */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700 mb-2">How it integrates</p>
          <div className="rounded-md bg-slate-900 p-3 font-mono text-[11px] text-slate-300 space-y-1">
            <div><span className="text-slate-500">{"// In ArgumentCardV2 action row:"}</span></div>
            <div><span className="text-sky-400">openModal</span>{"(<"}<span className="text-amber-400">ShareArgumentModal</span></div>
            <div>{"  "}<span className="text-indigo-300">argumentId</span>{"={id}"}</div>
            <div>{"  "}<span className="text-indigo-300">claimText</span>{"={conclusion.text}"}</div>
            <div>{"  "}<span className="text-indigo-300">confidence</span>{"={confidence}"}</div>
            <div>{"  "}<span className="text-indigo-300">schemeName</span>{"={schemes?.[0]?.schemeName}"}</div>
            <div>{"  />)"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Quick Argument Builder
// ─────────────────────────────────────────────────────────────────────────────

interface EvidenceRow {
  id: string;
  url: string;
  title: string | null;
  favicon: string | null;
  unfurling: boolean;
  quote: string;
}

function makeRow(url = ""): EvidenceRow {
  return { id: Math.random().toString(36).slice(2), url, title: null, favicon: null, unfurling: false, quote: "" };
}

function QuickBuilderDemo() {
  const [claim, setClaim] = useState("Remote work persistently increases productivity for knowledge workers across industries and company sizes");
  const [reasoning, setReasoning] = useState("");
  const [showReasoning, setShowReasoning] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([
    makeRow("https://nber.org"),
    makeRow("https://reuters.com"),
  ]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const { copiedKey, copy } = useCopy();

  const MOCK_RESULT = {
    permalink: { shortCode: "Bx7kQ2mN", url: `${BASE_URL}/a/Bx7kQ2mN` },
    embedCodes: {
      link: `${BASE_URL}/a/Bx7kQ2mN`,
      iframe: `<iframe src="${BASE_URL}/embed/argument/Bx7kQ2mN?theme=auto" width="600" height="400" frameborder="0" loading="lazy"></iframe>`,
      markdown: `**Claim:** ${claim}\n\n[View full argument on Isonomia](${BASE_URL}/a/Bx7kQ2mN)`,
    },
  };

  // Simulate unfurl on mounted evidence items
  useEffect(() => {
    evidence.forEach((ev) => {
      if (ev.url && !ev.title && !ev.unfurling) {
        const match = Object.keys(MOCK_UNFURL).find((k) => ev.url.includes(new URL(k).hostname));
        if (match) {
          updateRow(ev.id, { unfurling: true });
          setTimeout(() => {
            updateRow(ev.id, { unfurling: false, title: MOCK_UNFURL[match].title, favicon: MOCK_UNFURL[match].favicon });
          }, 700 + Math.random() * 400);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateRow = (id: string, patch: Partial<EvidenceRow>) => {
    setEvidence((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleUrlBlur = (id: string, url: string) => {
    if (!url) return;
    const match = Object.keys(MOCK_UNFURL).find((k) => url.includes(new URL(k).hostname));
    if (match) {
      updateRow(id, { unfurling: true });
      setTimeout(() => {
        updateRow(id, { unfurling: false, title: MOCK_UNFURL[match].title, favicon: MOCK_UNFURL[match].favicon });
      }, 800);
    }
  };

  const handleSubmit = (action: string) => {
    if (!claim.trim()) { toast.error("Please enter a claim"); return; }
    setSubmitting(true);
    setActiveAction(action);
    setTimeout(() => {
      setSubmitting(false);
      setActiveAction(null);
      setSubmitted(true);
      toast.success("Argument created!");
      if (action === "link") copy(MOCK_RESULT.embedCodes.link, "result-link");
      else if (action === "embed") copy(MOCK_RESULT.embedCodes.iframe, "result-embed");
      else if (action === "reddit") {
        window.open(`https://www.reddit.com/submit?url=${encodeURIComponent(MOCK_RESULT.embedCodes.link)}&title=${encodeURIComponent(claim.slice(0, 300))}`, "_blank", "noopener,noreferrer");
      }
    }, 1200);
  };

  if (submitted) {
    return (
      <div className="modalv2 space-y-4">
        <div className="pb-2">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/12 to-teal-500/12 text-emerald-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="font-semibold text-slate-900 text-lg">Quick Argument Builder</p>
            <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/12 text-emerald-700 border border-emerald-500/20">
              <Check className="w-2.5 h-2.5 mr-1" /> Created!
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
          <p className="text-sm font-semibold text-emerald-800">Argument created and permalink generated</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={MOCK_RESULT.embedCodes.link}
              className="flex-1 border rounded-md px-3 py-2 text-sm font-mono bg-white text-slate-600 focus:outline-none"
            />
            <button
              onClick={() => copy(MOCK_RESULT.embedCodes.link, "success-link")}
              className="px-3 py-2 rounded-md border bg-white hover:bg-slate-50 transition-colors"
            >
              {copiedKey === "success-link" ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => copy(MOCK_RESULT.embedCodes.iframe, "success-embed")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium transition-all">
              {copiedKey === "success-embed" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
              Copy Embed Code
            </button>
            <button onClick={() => copy(MOCK_RESULT.embedCodes.markdown, "success-md")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium transition-all">
              {copiedKey === "success-md" ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
              Copy Markdown
            </button>
            <a href={MOCK_RESULT.embedCodes.link} target="_blank" rel="noopener noreferrer">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium transition-all">
                <ExternalLink className="w-3 h-3 text-slate-500" />
                View Argument
              </button>
            </a>
          </div>
        </div>

        <button
          onClick={() => { setSubmitted(false); setClaim(""); setEvidence([makeRow()]); }}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset demo
        </button>
      </div>
    );
  }

  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/12 to-teal-500/12 text-emerald-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Quick Argument Builder</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 border border-emerald-500/20">Interactive</span>
        </div>
        <p className="text-sm text-slate-500">
          From claim to shareable permalink in under 60 seconds. Evidence URLs auto-unfurl as you type — paste a URL and the title fills itself.
        </p>
      </div>

      <div className="space-y-5">
        {/* Claim */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            What are you claiming?
            <span className="text-red-400 text-xs">*</span>
          </label>
          <textarea
            rows={3}
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            maxLength={2000}
            placeholder="State your claim clearly and specifically…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          />
          <p className="text-xs text-slate-400 text-right">{claim.length}/2000</p>
        </div>

        {/* Evidence rows */}
        <div className="space-y-2.5">
          <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" />
            Sources
            <span className="text-slate-400 font-normal text-xs">(optional — auto-unfurls on blur)</span>
          </label>
          <div className="space-y-3">
            {evidence.map((row) => (
              <div key={row.id} className="space-y-1.5">
                <div className="flex gap-2 items-center">
                  {row.favicon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.favicon} alt="" className="w-4 h-4 flex-shrink-0 rounded-sm" />
                  ) : (
                    <Globe className="w-4 h-4 flex-shrink-0 text-slate-300" />
                  )}
                  <input
                    type="url"
                    placeholder="https://example.com/article"
                    value={row.url}
                    onChange={(e) => updateRow(row.id, { url: e.target.value, title: null, favicon: null })}
                    onBlur={(e) => handleUrlBlur(row.id, e.target.value)}
                    className="flex-1 border rounded-md px-3 py-1.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  {row.unfurling && <Loader2 className="w-4 h-4 animate-spin text-slate-400 flex-shrink-0" />}
                  {!row.unfurling && row.title && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  <button
                    onClick={() => setEvidence((r) => r.filter((x) => x.id !== row.id))}
                    className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {row.title && (
                  <p className="text-xs text-emerald-600 pl-6 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" />
                    {row.title}
                  </p>
                )}
                {row.unfurling && (
                  <p className="text-xs text-slate-400 pl-6">Fetching metadata via /api/unfurl…</p>
                )}
                <input
                  type="text"
                  placeholder="Optional: paste a relevant quote from this source"
                  value={row.quote}
                  onChange={(e) => updateRow(row.id, { quote: e.target.value })}
                  className="w-full ml-6 border-0 border-b border-slate-100 bg-transparent text-xs text-slate-500 placeholder:text-slate-300 focus:outline-none focus:border-slate-300 py-1"
                />
              </div>
            ))}
          </div>
          {evidence.length < 10 && (
            <button
              onClick={() => setEvidence((r) => [...r, makeRow()])}
              className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Add another source
            </button>
          )}
        </div>

        {/* Reasoning */}
        <div className="space-y-1.5">
          <button
            onClick={() => setShowReasoning((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
          >
            {showReasoning ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            Add reasoning
            <span className="font-normal text-slate-400">(optional)</span>
          </button>
          {showReasoning && (
            <textarea
              rows={3}
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              placeholder="Why does your evidence support this claim?"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            />
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmit("link")}
              disabled={submitting || !claim.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting && activeAction === "link" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              Create &amp; Copy Link
            </button>
            <button
              onClick={() => handleSubmit("embed")}
              disabled={submitting || !claim.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting && activeAction === "embed" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Code className="w-4 h-4 text-slate-500" />}
              Copy Embed
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmit("reddit")}
              disabled={submitting || !claim.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium hover:bg-orange-50 hover:border-orange-200 disabled:opacity-50 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              Share to Reddit
            </button>
            <button
              onClick={() => handleSubmit("twitter")}
              disabled={submitting || !claim.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium hover:bg-sky-50 hover:border-sky-200 disabled:opacity-50 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              Share to Twitter
            </button>
          </div>
        </div>

        {/* /quick page note */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 flex items-center gap-3">
          <Monitor className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="text-xs text-slate-500">
            This builder lives at{" "}
            <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-700">/quick</code>
            {" "}and accepts <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-700">?claim=</code> and <code className="bg-white border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-700">?url=</code> query params for browser extension pre-fill.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: API Flow
// ─────────────────────────────────────────────────────────────────────────────

function ApiFlowDemo() {
  const [activeEndpoint, setActiveEndpoint] = useState<"quick" | "unfurl" | "my-arguments">("quick");
  const [showResponse, setShowResponse] = useState(false);
  const { copy, copiedKey } = useCopy();

  const quickArgRequest = {
    claim: "Remote work persistently increases productivity for knowledge workers",
    evidence: [
      { url: "https://nber.org/papers/remote-work-2024", title: "Bloom et al., WFH Research, NBER 2024" },
      { url: "https://reuters.com/technology/microsoft-work-trend-2025", title: "Microsoft Work Trend Index 2025" },
    ],
    reasoning: "Both papers find sustained 5–15% productivity gains in knowledge work roles post-pandemic.",
  };

  const quickArgResponse = {
    ok: true,
    argument: { id: "clx9z2a1b0000un7x4k3h2d8f", text: "Remote work persistently increases productivity for knowledge workers", confidence: null },
    claim: { id: "clx9z2a1b0001un7xq8p1j5m2", text: "Remote work persistently increases productivity for knowledge workers", moid: "a3f8e2b1c9d4e7f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4" },
    permalink: { shortCode: "Bx7kQ2mN", slug: "remote-work-productivity-knowledge-workers", url: "https://isonomia.app/a/Bx7kQ2mN" },
    embedCodes: {
      link: "https://isonomia.app/a/Bx7kQ2mN",
      iframe: "<iframe src=\"https://isonomia.app/embed/argument/Bx7kQ2mN?theme=auto\" width=\"600\" height=\"400\" ...></iframe>",
      markdown: "**Claim:** Remote work persistently increases productivity…\n\n[View on Isonomia](https://isonomia.app/a/Bx7kQ2mN)",
      plainText: "CLAIM: Remote work persistently increases productivity…\n\nLink: https://isonomia.app/a/Bx7kQ2mN",
    },
  };

  const unfurlRequest = "GET /api/unfurl?url=https%3A%2F%2Fnber.org%2Fpapers%2Fremote-work-2024";
  const unfurlResponse = {
    ok: true,
    data: {
      title: "Bloom et al. — The Effect of Remote Work on Productivity, NBER 2024",
      description: "We study the causal effect of WFH policies on knowledge worker output…",
      image: "https://nber.org/og/remote-work-2024.png",
      siteName: null,
      url: "https://nber.org/papers/remote-work-2024",
      favicon: "https://www.google.com/s2/favicons?domain=nber.org&sz=32",
    },
  };

  const myArgDeliberation = {
    model: "Deliberation",
    data: {
      hostType: "free",
      hostId: "standalone-my-arguments-42601",
      createdById: "42601",
      title: "My Arguments",
    },
    note: "Created on first quick argument with no deliberationId. All subsequent standalone arguments reuse this deliberation.",
    query: "findFirst({ where: { hostType: 'free', hostId: 'standalone-my-arguments-{userId}' } })",
  };

  const endpoints = [
    { id: "quick" as const, label: "POST /api/arguments/quick", icon: Zap, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
    { id: "unfurl" as const, label: "GET /api/unfurl", icon: Globe, color: "text-pink-600", bg: "bg-pink-50 border-pink-200" },
    { id: "my-arguments" as const, label: "My Arguments deliberation", icon: FolderOpen, color: "text-slate-600", bg: "bg-slate-100 border-slate-200" },
  ];

  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-slate-500/10 to-zinc-500/12 text-slate-600">
            <Terminal className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">API &amp; Data Flow</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-700 border border-slate-400/25">Reference</span>
        </div>
        <p className="text-sm text-slate-500">
          Inspect request shapes, response payloads, and the database logic behind each Phase 2 endpoint.
        </p>
      </div>

      <div className="space-y-4">
        {/* Endpoint selector */}
        <div className="flex flex-col gap-2">
          {endpoints.map((ep) => {
            const Icon = ep.icon;
            return (
              <button
                key={ep.id}
                onClick={() => { setActiveEndpoint(ep.id); setShowResponse(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition-all text-left ${
                  activeEndpoint === ep.id
                    ? `${ep.bg} ring-2 ring-offset-1 ${ep.color.replace("text-", "ring-").replace("-600", "-300")}`
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${activeEndpoint === ep.id ? ep.color : "text-slate-400"}`} />
                <span className={`font-mono ${activeEndpoint === ep.id ? ep.color : "text-slate-700"}`}>{ep.label}</span>
                <ChevronRight className={`w-3.5 h-3.5 ml-auto ${activeEndpoint === ep.id ? ep.color : "text-slate-300"}`} />
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        {activeEndpoint === "quick" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Zap className="w-4 h-4 text-amber-500" />
              POST /api/arguments/quick
            </div>

            {/* Auth + rate limit badge row */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Auth required", color: "bg-red-100 text-red-700" },
                { label: "20 req / hr", color: "bg-amber-100 text-amber-700" },
                { label: "SSRF guard", color: "bg-sky-100 text-sky-700" },
                { label: "Idempotent claim upsert", color: "bg-emerald-100 text-emerald-700" },
              ].map((b) => (
                <span key={b.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${b.color}`}>{b.label}</span>
              ))}
            </div>

            {/* Request */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Request body</p>
              <div className="relative rounded-lg border bg-slate-900 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                <pre>{JSON.stringify(quickArgRequest, null, 2)}</pre>
                <button onClick={() => copy(JSON.stringify(quickArgRequest, null, 2), "req")} className="absolute top-2 right-2 p-1.5 rounded bg-slate-700 hover:bg-slate-600 transition-colors">
                  {copiedKey === "req" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>
              </div>
            </div>

            {/* Toggle response */}
            <button
              onClick={() => setShowResponse(!showResponse)}
              className="flex items-center gap-2 text-xs text-indigo-600 hover:underline"
            >
              {showResponse ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              {showResponse ? "Hide" : "Show"} response
            </button>

            {showResponse && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Response (200)</p>
                <div className="relative rounded-lg border bg-slate-900 p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-80 overflow-y-auto">
                  <pre>{JSON.stringify(quickArgResponse, null, 2)}</pre>
                  <button onClick={() => copy(JSON.stringify(quickArgResponse, null, 2), "res")} className="absolute top-2 right-2 p-1.5 rounded bg-slate-700 hover:bg-slate-600 transition-colors">
                    {copiedKey === "res" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                </div>
              </div>
            )}

            {/* Execution steps */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Execution steps</p>
              <ol className="space-y-2">
                {[
                  "getCurrentUserId() — 401 if missing",
                  "ratelimit.limit(userId) — 429 if over 20/hr",
                  "QuickArgSchema.safeParse(body) — 400 on validation failure",
                  "isSafePublicUrl(ev.url) for each evidence item — SSRF guard",
                  "deliberationId ?? getOrCreateMyArgumentsDeliberation(userId)",
                  "mintClaimMoid(claim) → SHA-256 of canonical text",
                  "prisma.claim.upsert({ where: { moid } }) — idempotent",
                  "getOrFetchLinkPreview(ev.url) — auto-unfurl titles (best-effort)",
                  "prisma.claimEvidence.createMany() — skipDuplicates: true",
                  "prisma.argument.create() with conclusionClaimId",
                  "getOrCreatePermalink(argument.id) → shortCode, slug",
                  "Return: argument + claim + permalink + embedCodes",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                    <span className="shrink-0 w-4 h-4 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-semibold text-[10px]">
                      {i + 1}
                    </span>
                    <code className="font-mono">{step}</code>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {activeEndpoint === "unfurl" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Globe className="w-4 h-4 text-pink-500" />
              GET /api/unfurl?url=
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { label: "Auth required", color: "bg-red-100 text-red-700" },
                { label: "60 req / hr", color: "bg-pink-100 text-pink-700" },
                { label: "SSRF guard", color: "bg-sky-100 text-sky-700" },
                { label: "12h cache (LinkPreview)", color: "bg-violet-100 text-violet-700" },
              ].map((b) => (
                <span key={b.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${b.color}`}>{b.label}</span>
              ))}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Request</p>
              <div className="rounded-lg border bg-slate-900 p-3 font-mono text-xs text-slate-300">
                <span className="text-emerald-400">GET</span> {unfurlRequest}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Response (200)</p>
              <div className="rounded-lg border bg-slate-900 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
                <pre>{JSON.stringify(unfurlResponse, null, 2)}</pre>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">SSRF protection in isSafePublicUrl()</p>
              <ul className="space-y-0.5 list-disc list-inside text-amber-700">
                <li>Protocol must be http: or https:</li>
                <li>hostname: localhost, *.local, *.internal → blocked</li>
                <li>IPv4 in 10.x, 172.16–31.x, 192.168.x, 127.x → blocked</li>
                <li>Fetch is server-side only — URL is never passed to client-initiated network</li>
              </ul>
            </div>
          </div>
        )}

        {activeEndpoint === "my-arguments" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FolderOpen className="w-4 h-4 text-slate-500" />
              "My Arguments" Auto-Deliberation (Step 2.7)
            </div>

            <div className="rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-300 space-y-1 overflow-x-auto">
              <div><span className="text-slate-500">{"// getOrCreateMyArgumentsDeliberation(userId)"}</span></div>
              <div><span className="text-slate-500">{"// Called when no deliberationId is provided"}</span></div>
              <div>&nbsp;</div>
              <div><span className="text-indigo-400">const</span> hostId = <span className="text-amber-300">{"`standalone-my-arguments-${userId}`"}</span>;</div>
              <div>&nbsp;</div>
              <div><span className="text-indigo-400">const</span> existing = <span className="text-sky-400">await</span> prisma.deliberation.<span className="text-emerald-400">findFirst</span>{"({"}</div>
              <div>{"  where: { hostType: "}<span className="text-amber-300">&quot;free&quot;</span>{", hostId },"}</div>
              <div>{"  select: { id: true },"}</div>
              <div>{"});"}</div>
              <div><span className="text-slate-500">{"if (existing) return existing.id;"}</span></div>
              <div>&nbsp;</div>
              <div><span className="text-indigo-400">const</span> created = <span className="text-sky-400">await</span> prisma.deliberation.<span className="text-emerald-400">create</span>{"({"}</div>
              <div>{"  data: {"}</div>
              <div>{"    hostType: "}<span className="text-amber-300">&quot;free&quot;</span>{","}</div>
              <div>{"    hostId,"}</div>
              <div>{"    createdById: userId,"}</div>
              <div>{"    title: "}<span className="text-amber-300">&quot;My Arguments&quot;</span>{","}</div>
              <div>{"  },"}</div>
              <div>{"});"}</div>
              <div><span className="text-indigo-400">return</span> created.id;</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "Option A (chosen)", desc: "Auto-create per-user 'My Arguments' deliberation", badge: "Implemented", color: "bg-emerald-100 text-emerald-700" },
                { label: "Option B (rejected)", desc: "Make Argument.deliberationId nullable — significant refactor risk", badge: "Not chosen", color: "bg-slate-100 text-slate-500" },
                { label: "Option C (rejected)", desc: "Create a throwaway deliberation per argument — database pollution", badge: "Not chosen", color: "bg-slate-100 text-slate-500" },
              ].map((opt) => (
                <div key={opt.label} className="rounded-lg border border-slate-200 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-800">{opt.label}</p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${opt.color}`}>{opt.badge}</span>
                  </div>
                  <p className="text-xs text-slate-500">{opt.desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <p><strong className="text-slate-700">No schema changes required.</strong> <code className="bg-white border px-1 rounded font-mono">free</code> is an existing <code className="bg-white border px-1 rounded font-mono">DeliberationHostType</code> enum value. The hostId convention <code className="bg-white border px-1 rounded font-mono">standalone-my-arguments-{"{userId}"}</code> is deterministic and acts as a natural unique key.</p>
            </div>
          </div>
        )}

        {/* Phase 2 route reference */}
        <div>
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-slate-500" />
            Phase 2 Routes &amp; Files
          </p>
          <div className="border rounded-lg overflow-hidden divide-y">
            {PHASE2_ROUTES.map((route, i) => {
              const tagColors: Record<string, string> = {
                Page: "bg-indigo-100 text-indigo-700",
                API: "bg-emerald-100 text-emerald-700",
              };
              return (
                <button
                  key={i}
                  onClick={() => toast.info(`${route.method} ${route.path} — ${route.description}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 text-left transition-colors"
                >
                  <span className={`font-mono text-xs font-bold shrink-0 w-10 ${route.method === "POST" ? "text-amber-600" : "text-emerald-600"}`}>{route.method}</span>
                  <span className="font-mono text-xs text-slate-700 flex-1 truncate">{route.path}</span>
                  <span className="text-xs text-slate-500 truncate hidden sm:block">{route.description}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${tagColors[route.tag]}`}>{route.tag}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function EmbeddableWidgetPhase2DemoPage() {
  return (
    <TooltipProvider>
      <Toaster position="bottom-right" richColors />
      <div className="min-h-screen" style={{ background: "linear-gradient(145deg, #f5faff 0%, #eef5ff 25%, #f0f8f4 60%, #f5fff8 100%)" }}>

        {/* Sticky header */}
        <div
          className="border-b border-slate-900/[0.07] bg-white/85 backdrop-blur-xl sticky top-0 z-40 px-6 py-4"
          style={{ boxShadow: "0 1px 3px rgba(16,185,129,0.06), 0 4px 16px -8px rgba(16,185,129,0.08)" }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                Embeddable Argument Widget
              </h1>
              <p className="text-sm text-slate-500 mt-0.5 ml-4">
                Creation &amp; Share Flow {" "}
              </p>
            </div>
     
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

          {/* Strategic context banner */}
          <div className="rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-100/80 p-5">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">
                  Users become distribution vectors.
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Phase 1 built the infrastructure — the public pages, embeds, and OG cards that make arguments travel. Phase 2 arms users to create those arguments instantly. One form, one API call, one permalink. The Quick Argument Builder turns the creation funnel from a multi-step deliberation setup into a 60-second action. The Share Modal makes every existing argument one click away from Reddit, Twitter, or any comment thread.
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                  {[
                    { label: "Share Modal", color: "bg-sky-100 text-sky-700" },
                    { label: "Quick Builder at /quick", color: "bg-emerald-100 text-emerald-700" },
                    { label: "POST /api/arguments/quick", color: "bg-amber-100 text-amber-700" },
                    { label: "Evidence auto-unfurl", color: "bg-pink-100 text-pink-700" },
                    { label: "My Arguments auto-deliberation", color: "bg-violet-100 text-violet-700" },
                    { label: "4 export formats", color: "bg-indigo-100 text-indigo-700" },
                  ].map((chip) => (
                    <span key={chip.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${chip.color}`}>
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Funnel progress */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4">The distribution funnel — Phase 2 unlocks steps 2 &amp; 3</p>
            <div className="flex items-stretch gap-1">
              {[
                { step: "1", label: "OG image is the draw", sub: "Looks better than everything else in the thread", phase: "Phase 1", done: true },
                { step: "2", label: "Permalink is the invitation", sub: "Zero-friction, full argument, visible depth", phase: "Phase 1", done: true },
                { step: "3", label: "Quick Builder arms users", sub: "Turns them into distribution vectors", phase: "Phase 2", done: true, active: true },
                { step: "4", label: "Response loop is the hook", sub: "Converts readers into creators", phase: "Phase 3", done: false },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-lg p-3 border transition-all ${
                    item.active
                      ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200"
                      : item.done
                      ? "border-slate-200 bg-slate-50"
                      : "border-slate-100 bg-white opacity-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                      item.active ? "bg-emerald-500 text-white" : item.done ? "bg-slate-300 text-white" : "bg-slate-100 text-slate-400"
                    }`}>{item.step}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                      item.active ? "bg-emerald-100 text-emerald-700" : item.done ? "bg-slate-100 text-slate-500" : "bg-white text-slate-300 border"
                    }`}>{item.phase}</span>
                  </div>
                  <p className={`text-xs font-semibold leading-tight ${item.active ? "text-emerald-800" : item.done ? "text-slate-700" : "text-slate-400"}`}>{item.label}</p>
                  <p className={`text-[11px] mt-0.5 leading-snug ${item.active ? "text-emerald-600" : item.done ? "text-slate-400" : "text-slate-300"}`}>{item.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Deliverables grid */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Phase 2 Deliverables</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  6 new files created. Every deliverable is independently testable.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PHASE2_FEATURES.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
          </section>

          {/* Interactive demos */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Interactive Demos</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Explore the Share Modal, the Quick Builder form, and the API payloads. All UI rendering is simulated — the real endpoints are live at the paths shown.
              </p>
            </div>
            <Tabs defaultValue="share" className="space-y-4">
              <TabsList className="bg-white border shadow-sm">
                <TabsTrigger value="share" className="gap-1.5">
                  <Share2 className="w-4 h-4" />
                  Share Modal
                </TabsTrigger>
                <TabsTrigger value="builder" className="gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Quick Builder
                </TabsTrigger>
                <TabsTrigger value="api" className="gap-1.5">
                  <Terminal className="w-4 h-4" />
                  API Flow
                </TabsTrigger>
              </TabsList>

              <TabsContent value="share">
                <ShareModalDemo />
              </TabsContent>

              <TabsContent value="builder">
                <QuickBuilderDemo />
              </TabsContent>

              <TabsContent value="api">
                <ApiFlowDemo />
              </TabsContent>
            </Tabs>
          </section>

          {/* Architecture summary */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">How It&apos;s Built</h2>
              <p className="text-sm text-slate-500 mt-0.5">Three new layers on top of the Phase 1 embed infrastructure.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-sky-500/15 text-sky-600 text-[11px] font-bold flex items-center justify-center">1</span>
                  <Share2 className="w-3.5 h-3.5 text-sky-600" />
                  <p className="text-sm font-semibold text-slate-800">Share Modals</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-sky-700">ShareArgumentModal.tsx</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-violet-700">ShareClaimModal.tsx</div>
                </div>
                <p className="text-xs text-slate-500">
                  Open via <code className="bg-white/50 px-1 rounded">useModalStore().openModal()</code>. Fetch permalink on mount, build 4 export formats, render OG image preview, show platform share buttons.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 text-[11px] font-bold flex items-center justify-center">2</span>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-sm font-semibold text-slate-800">Quick Builder</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-emerald-700">QuickArgumentBuilder.tsx</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-teal-700">app/quick/page.tsx</div>
                </div>
                <p className="text-xs text-slate-500">
                  Evidence rows auto-unfurl on blur via <code className="bg-white/50 px-1 rounded">GET /api/unfurl</code>. One submit → <code className="bg-white/50 px-1 rounded">POST /api/arguments/quick</code> → success state with copy options.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-600 text-[11px] font-bold flex items-center justify-center">3</span>
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <p className="text-sm font-semibold text-slate-800">Backend APIs</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-amber-700">/api/arguments/quick</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-pink-700">/api/unfurl</div>
                </div>
                <p className="text-xs text-slate-500">
                  Both use <code className="bg-white/50 px-1 rounded">Upstash fixedWindow</code> rate limiting, <code className="bg-white/50 px-1 rounded">getCurrentUserId()</code> auth, and Zod validation. SSRF is blocked at the service layer via <code className="bg-white/50 px-1 rounded">isSafePublicUrl()</code>.
                </p>
              </div>
            </div>
          </section>

          {/* Files created */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Files Created</h2>
              <p className="text-sm text-slate-500 mt-0.5">All new — no existing files deleted or renamed. One file extended (ArgumentCardV2.tsx).</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y">
              {[
                { type: "new", path: "components/modals/ShareArgumentModal.tsx", desc: "Share modal for arguments — 4 tabs, OG preview, platform buttons" },
                { type: "new", path: "components/modals/ShareClaimModal.tsx", desc: "Share modal for claims — uses moid, claimPermalinkService URL helpers" },
                { type: "new", path: "components/arguments/QuickArgumentBuilder.tsx", desc: "Quick creation form — evidence auto-unfurl, 4 action buttons, success state" },
                { type: "new", path: "app/quick/page.tsx", desc: "Standalone /quick page — accepts ?claim= and ?url= params" },
                { type: "new", path: "app/api/arguments/quick/route.ts", desc: "POST — atomic Claim + Evidence + Argument + Permalink creation" },
                { type: "new", path: "app/api/unfurl/route.ts", desc: "GET — SSRF-guarded OG metadata extraction, 60/hr rate limit" },
                { type: "modified", path: "components/arguments/ArgumentCardV2.tsx", desc: "Added ShareButtonInline + Share2 import + useModalStore integration" },
              ].map((file, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${
                    file.type === "new" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}>{file.type}</span>
                  <code className="font-mono text-xs text-slate-700 flex-1 truncate">{file.path}</code>
                  <span className="text-xs text-slate-400 hidden md:block truncate max-w-[40%] text-right">{file.desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="py-6 border-t border-slate-900/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-500">Embeddable Argument Widget — Phase 2</span>
            <div className="flex items-center gap-3">
              <a href="/test/embeddable-widget" className="text-indigo-500 hover:underline">← Phase 1 demo</a>
              <span className="text-slate-300">·</span>
              <a href="/test/embeddable-widget-phase3" className="text-indigo-500 hover:underline">Phase 3 demo →</a>
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-600 text-[11px] font-medium">Phases 4–5 planned</span>
              <span className="text-slate-300">·</span>
              <span>April 2026</span>
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
