"use client";

/**
 * Embeddable Argument Widget — Phase 1 Demo
 *
 * Interactive demonstration of all Phase 1 embeddable widget features:
 *
 * PHASE 1 – PERMALINK & EMBED INFRASTRUCTURE:
 * - 1.1 Argument Permalink Pages (/a/[identifier]) — public, no auth wall
 * - 1.2 Claim Permalink Pages (/c/[moid]) — public, no auth wall
 * - 1.3 Argument Embed Widgets (/embed/argument/[identifier]) — iframe-ready
 * - 1.4 Claim Embed Widgets (/embed/claim/[moid]) — iframe-ready
 * - 1.5 OG Social Cards — 1200×630 ImageResponse for arguments and claims
 * - 1.6 oEmbed Discovery — /api/oembed extended with argument/claim types
 * - 1.7 Embed Widget API — /api/widgets/embed extended with argument/claim
 * - 1.8 Claim Permalink Service — URL helpers (lib/citations/claimPermalinkService.ts)
 * - 1.9 JSON-LD Structured Data — CreativeWork + Claim schema.org types
 *
 * Accessible at: /test/embeddable-widget
 */

import { useState } from "react";
import { toast, Toaster } from "sonner";
import {
  Link2,
  ExternalLink,
  Image as ImageIcon,
  Copy,
  Check,
  Share2,
  Globe,
  MessageSquare,
  ChevronRight,
  Shield,
  BookOpen,
  Tag,
  FileCode,
  Zap,
  Monitor,
  Smartphone,
  Sun,
  Moon,
  Minimize2,
  ArrowRight,
  ThumbsUp,
  ThumbsDown,
  Scale,
  Lightbulb,
  Hash,
  Braces,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ARGUMENTS = {
  epistemic: {
    id: "arg-demo-1",
    identifier: "rK7pA2mN",
    slug: "recommendation-algorithms-epistemic-harm",
    text: "Recommendation algorithms trained on engagement metrics systematically select for content that triggers strong emotional responses. Because outrage and anxiety generate more engagement than nuanced analysis, the selection pressure over time produces a feed that is structurally biased against the kind of calm, evidence-based reasoning that democratic deliberation requires. When billions of users receive epistemically degraded information environments through no choice of their own, this constitutes a systemic harm to the epistemic commons.",
    confidence: 78,
    scheme: "Argumentation from Analogy",
    schemeColor: "bg-violet-100 text-violet-700",
    type: "SUPPORT",
    deliberation: { title: "The Future of Online Civic Discourse" },
    conclusion: {
      text: "Recommendation algorithms produce systemic epistemic harm in democratic contexts",
    },
    premises: [
      "Well-studied mechanism: engagement metrics reward emotionally activating content (anger, fear, outrage) over nuanced analysis.",
      "The scale effect: billions of users receive algorithmically shaped information environments they did not choose.",
      "Epistemic harm is collective: degraded individual information environments aggregate into a degraded epistemic commons.",
    ],
    evidence: [
      { title: "Reuters Institute Digital News Report 2025", type: "EMPIRICAL", url: "#" },
      { title: "Levy et al., \"The Effect of Social Media on News Consumption\", NBER 2024", type: "EMPIRICAL", url: "#" },
      { title: "Habermas, \"Technology and Science as Ideology\" — theoretical background", type: "THEORETICAL", url: "#" },
    ],
    author: { name: "Dr. Priya Anand", username: "panand" },
    supportCount: 34,
    challengeCount: 12,
    createdAt: "2026-03-18T10:00:00Z",
  },
  carbon: {
    id: "arg-demo-2",
    identifier: "mB4qC8dX",
    slug: "carbon-pricing-efficiency-argument",
    text: "Economic theory and empirical evidence from British Columbia, Sweden, and the EU ETS all demonstrate that carbon pricing creates a direct cost signal that propagates through supply chains, incentivizes substitution toward lower-emission alternatives, and generates revenue that can be redistributed progressively. No comparable mechanism achieves equivalent emission reductions at lower economic cost. The practical reasoning conclusion follows: if we want to reduce emissions efficiently without arbitrary sectoral mandates, carbon pricing is the dominant policy instrument.",
    confidence: 65,
    scheme: "Practical Reasoning",
    schemeColor: "bg-emerald-100 text-emerald-700",
    type: "SUPPORT",
    deliberation: { title: "Climate Policy Deliberation 2026" },
    conclusion: {
      text: "Carbon pricing is the most economically efficient mechanism for reducing emissions at scale",
    },
    premises: [
      "Empirical evidence from BC, Sweden, and the EU ETS shows carbon pricing reduces emissions without proportional GDP loss.",
      "Price signals propagate through supply chains more efficiently than command-and-control regulation.",
      "Revenue recycling via direct dividends can make carbon pricing progressive, not regressive.",
    ],
    evidence: [
      { title: "Murray & Rivers, \"British Columbia's Revenue-Neutral Carbon Tax\", JPUBECO 2015", type: "EMPIRICAL", url: "#" },
      { title: "World Bank Carbon Pricing Dashboard 2025", type: "EMPIRICAL", url: "#" },
    ],
    author: { name: "Prof. Marcus Chen", username: "mchen" },
    supportCount: 28,
    challengeCount: 19,
    createdAt: "2026-02-24T14:00:00Z",
  },
};

const MOCK_CLAIMS = {
  algorithms: {
    id: "claim-demo-1",
    moid: "CLAIM-7A3B",
    text: "Social media recommendation systems systematically amplify divisive content over informative content",
    tags: ["algorithms", "epistemics", "social media"],
    supportCount: 24,
    challengeCount: 8,
    argumentCount: 12,
    evidence: [
      { title: "Facebook's internal research on algorithmic amplification (2021 leak)", type: "EMPIRICAL" },
      { title: "Huszár et al., \"Algorithmic Amplification of Politics on Twitter\", PNAS 2022", type: "EMPIRICAL" },
    ],
    deliberation: { title: "The Future of Online Civic Discourse" },
    author: { name: "Dr. Priya Anand", username: "panand" },
  },
  carbonTax: {
    id: "claim-demo-2",
    moid: "CLAIM-2F9E",
    text: "Carbon taxes with dividend rebates are net positive for low-income households compared to the status quo of unpriced carbon pollution",
    tags: ["climate", "carbon-tax", "equity"],
    supportCount: 16,
    challengeCount: 11,
    argumentCount: 7,
    evidence: [
      { title: "Citizens' Climate Lobby Economic Analysis of Carbon Fee and Dividend", type: "EMPIRICAL" },
      { title: "Goulder et al., \"Impacts of a Carbon Tax across US Household Income Groups\", JPublicEcon 2019", type: "EMPIRICAL" },
    ],
    deliberation: { title: "Climate Policy Deliberation 2026" },
    author: { name: "Prof. Marcus Chen", username: "mchen" },
  },
};

type ArgKey = keyof typeof MOCK_ARGUMENTS;
type ClaimKey = keyof typeof MOCK_CLAIMS;

const PHASE1_FEATURES = [
  {
    id: "argument-permalink",
    title: "Argument Permalink Pages",
    description: "Public /a/[identifier] pages — no auth wall, full OG metadata",
    icon: Link2,
    status: "complete" as const,
    items: [
      "Route: /a/[identifier] — resolves shortCode or slug",
      "generateMetadata with og:image, twitter:card, og:type: article",
      "oEmbed discovery link in <head> alternates",
      "JSON-LD (schema.org CreativeWork with about: Claim)",
      "Sticky nav with CTA — no login gatekeeping",
      "Conclusion hero with confidence bar + scheme badge",
      "Premises list + evidence grid",
      "Embed code snippet with copy button",
    ],
  },
  {
    id: "claim-permalink",
    title: "Claim Permalink Pages",
    description: "Public /c/[moid] pages with engagement stats and evidence",
    icon: Hash,
    status: "complete" as const,
    items: [
      "Route: /c/[moid] — uses moid as natural public identifier",
      "Full OG + Twitter Card metadata",
      "JSON-LD (schema.org Claim type)",
      "Support / Challenge / Argument engagement counts",
      "Evidence sources list",
      "Arguments connected to this claim",
      "Embed code snippet",
    ],
  },
  {
    id: "argument-embed",
    title: "Argument Embed Widgets",
    description: "Self-contained iframe widgets for /embed/argument/[identifier]",
    icon: Monitor,
    status: "complete" as const,
    items: [
      "Self-contained <html> page — no external deps",
      "Inline CSS via embedStyles(theme) template literal",
      "Three themes: light / dark / auto (prefers-color-scheme)",
      "Compact mode for minimal height",
      "Confidence bar with percentage label",
      "Premises list + evidence sources",
      "Footer: \"Powered by Isonomia\" + deliberation link",
    ],
  },
  {
    id: "claim-embed",
    title: "Claim Embed Widgets",
    description: "Self-contained iframe widgets for /embed/claim/[moid]",
    icon: Smartphone,
    status: "complete" as const,
    items: [
      "Self-contained <html> page — no external deps",
      "Three themes: light / dark / auto",
      "Compact mode (160px) and full mode (280px)",
      "Engagement stats row: support / challenge / argument counts",
      "Evidence sources list",
      "Footer CTA: \"Respond on Isonomia →\"",
    ],
  },
  {
    id: "og-images",
    title: "OG Social Cards",
    description: "1200×630 ImageResponse cards for arguments and claims",
    icon: ImageIcon,
    status: "complete" as const,
    items: [
      "Route: /api/og/argument/[identifier] — argument card",
      "Route: /api/og/claim/[moid] — claim card",
      "Built with ImageResponse from next/og (bundled, no extra dep)",
      "Dark indigo gradient background for arguments",
      "Type badge + scheme badge at top",
      "Confidence bar visualization",
      "Conclusion text + argument excerpt",
      "Premise count + evidence count + deliberation name",
      "Always returns a fallback card — never 404",
    ],
  },
  {
    id: "oembed",
    title: "oEmbed Discovery",
    description: "/api/oembed extended with argument and claim types",
    icon: Braces,
    status: "complete" as const,
    items: [
      "Handles: /embed/argument/, /embed/claim/, /a/, /c/ URL patterns",
      "Returns type: \"rich\" with full oEmbed JSON payload",
      "Dimensions: argument=600×400, claim=600×280",
      "thumbnail_url set to OG image URL",
      "Fixed pre-existing bug: source.authors → source.authorsJson",
      "Fixed pre-existing bug: deliberation.name → deliberation.title",
    ],
  },
  {
    id: "embed-api",
    title: "Embed Widget API",
    description: "/api/widgets/embed extended with argument and claim types",
    icon: FileCode,
    status: "complete" as const,
    items: [
      "WidgetType union now includes \"argument\" | \"claim\"",
      "DEFAULT_HEIGHTS: argument=400, claim=280",
      "Resolves argument via ArgumentPermalink (shortCode/slug)",
      "Resolves claim via moid field",
      "verifyPublicAccess() checks existence before serving",
    ],
  },
  {
    id: "claim-service",
    title: "Claim Permalink Service",
    description: "URL helper utilities in lib/citations/claimPermalinkService.ts",
    icon: Zap,
    status: "complete" as const,
    items: [
      "getClaimPermalinkUrl(moid) → /c/{moid}",
      "getClaimEmbedUrl(moid) → /embed/claim/{moid}",
      "getClaimOgImageUrl(moid) → /api/og/claim/{moid}",
      "getClaimOembedUrl(moid) — full oEmbed discover URL",
      "generateClaimIframeCode(moid, theme, compact) — HTML snippet",
      "Used consistently across /c/[moid] page and oEmbed route",
    ],
  },
];

const API_ROUTES = [
  { method: "GET", path: "/a/[identifier]", description: "Public argument permalink page", tag: "Page" },
  { method: "GET", path: "/c/[moid]", description: "Public claim permalink page", tag: "Page" },
  { method: "GET", path: "/embed/argument/[identifier]", description: "Argument iframe embed widget", tag: "Embed" },
  { method: "GET", path: "/embed/claim/[moid]", description: "Claim iframe embed widget", tag: "Embed" },
  { method: "GET", path: "/api/og/argument/[identifier]", description: "1200×630 OG social card for argument", tag: "OG" },
  { method: "GET", path: "/api/og/claim/[moid]", description: "1200×630 OG social card for claim", tag: "OG" },
  { method: "GET", path: "/api/oembed?url=", description: "oEmbed JSON discovery (extended)", tag: "API" },
  { method: "GET", path: "/api/widgets/embed", description: "Embed widget metadata + iframe code (extended)", tag: "API" },
];

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE OVERVIEW COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function FeatureCard({ feature }: { feature: (typeof PHASE1_FEATURES)[0] }) {
  const Icon = feature.icon;
  return (
    <div className="cardv2 h-full flex flex-col">
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/15 text-indigo-600 shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
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
              <div className="w-1 h-1 rounded-full bg-indigo-400/70 flex-shrink-0 mt-[5px]" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Permalink Pages
// ─────────────────────────────────────────────────────────────────────────────

function PermalinkPagesDemo() {
  const [activeType, setActiveType] = useState<"argument" | "claim">("argument");
  const [activeArgKey, setActiveArgKey] = useState<ArgKey>("epistemic");
  const [activeClaimKey, setActiveClaimKey] = useState<ClaimKey>("algorithms");
  const [showJsonLD, setShowJsonLD] = useState(false);
  const [showOgTags, setShowOgTags] = useState(false);
  const [copied, setCopied] = useState(false);

  const arg = MOCK_ARGUMENTS[activeArgKey];
  const claim = MOCK_CLAIMS[activeClaimKey];

  const handleCopy = (text: string) => {
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const argumentJsonLD = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "name": arg.conclusion.text,
    "text": arg.text.slice(0, 160) + "…",
    "author": { "@type": "Person", "name": arg.author.name },
    "about": { "@type": "Claim", "text": arg.conclusion.text },
    "isPartOf": { "@type": "DiscussionForumPosting", "name": arg.deliberation.title },
  };

  const claimJsonLD = {
    "@context": "https://schema.org",
    "@type": "Claim",
    "text": claim.text,
    "author": { "@type": "Person", "name": claim.author.name },
    "appearance": { "@type": "DiscussionForumPosting", "name": claim.deliberation.title },
  };

  return (
    <div className="modalv2">
      <div className="pb-3">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500/12 to-violet-500/12 text-indigo-600">
            <Globe className="w-4.5 h-4.5" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Permalink Pages</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-700 border border-indigo-500/20">Interactive</span>
        </div>
        <p className="text-sm text-slate-500">Every argument and claim gets a canonical public URL — readable without login, richly structured for SEO and social sharing</p>
      </div>
      <div className="space-y-4">
        {/* Type Switcher */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveType("argument")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              activeType === "argument"
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Scale className="w-4 h-4" />
            Argument Page (/a/)
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
            Claim Page (/c/)
          </button>
        </div>

        {/* Demo Selector */}
        {activeType === "argument" ? (
          <div className="flex gap-2">
            {(Object.keys(MOCK_ARGUMENTS) as ArgKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveArgKey(key)}
                className={`flex-1 text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                  activeArgKey === key
                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-medium text-slate-800 text-xs">{MOCK_ARGUMENTS[key].conclusion.text.slice(0, 55)}…</p>
                <p className="text-xs text-slate-500 mt-0.5">{MOCK_ARGUMENTS[key].scheme}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            {(Object.keys(MOCK_CLAIMS) as ClaimKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveClaimKey(key)}
                className={`flex-1 text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                  activeClaimKey === key
                    ? "border-violet-500 bg-violet-50 ring-2 ring-violet-200"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="font-medium text-slate-800 text-xs">{MOCK_CLAIMS[key].text.slice(0, 60)}…</p>
                <p className="text-xs text-slate-500 mt-0.5">moid: {MOCK_CLAIMS[key].moid}</p>
              </button>
            ))}
          </div>
        )}

        {/* Browser Chrome Mockup */}
        <div className="border rounded-xl overflow-hidden shadow-md bg-white">
          {/* Browser Address Bar */}
          <div className="border-b bg-slate-50 px-4 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1 mx-2 bg-white border rounded-md px-3 py-1 text-xs text-slate-500 flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-emerald-500" />
              isonomia.app/{activeType === "argument" ? `a/${arg.identifier}` : `c/${claim.moid}`}
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400" />
          </div>

          {/* Page Content */}
          {activeType === "argument" ? (
            <div className="bg-white text-sm">
              {/* Sticky Nav */}
              <div className="border-b px-6 py-3 flex items-center justify-between bg-white/95">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-600 to-violet-600" />
                  <span className="font-semibold text-sm text-slate-800">Isonomia</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="truncate max-w-[200px]">{arg.deliberation.title}</span>
                  <ChevronRight className="w-3 h-3" />
                  <span>Argument</span>
                </div>
                <button
                  onClick={() => toast.info("CTA → /signup — no auth wall on the page itself")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
                >
                  Join & Respond
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Conclusion Hero */}
              <div className="px-6 py-5 bg-gradient-to-br from-slate-50 to-indigo-50/30 border-b">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                    {arg.type === "SUPPORT" ? "Supporting Argument" : "Challenging Argument"}
                  </Badge>
                  <Badge className={`${arg.schemeColor} text-xs border`}>
                    {arg.scheme}
                  </Badge>
                </div>
                <h1 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
                  {arg.conclusion.text}
                </h1>
                <p className="text-xs text-slate-500 mb-3">
                  Deliberation: <span className="font-medium text-slate-700">{arg.deliberation.title}</span>
                </p>
                <div className="mb-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>Epistemic confidence</span>
                    <span className="font-medium">{arg.confidence}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${arg.confidence}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Argument Body */}
              <div className="px-6 py-4 border-b">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Argument</p>
                <p className="text-sm text-slate-700 leading-relaxed line-clamp-4">{arg.text}</p>
              </div>

              {/* Premises */}
              <div className="px-6 py-4 border-b">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Premises</p>
                <div className="space-y-2">
                  {arg.premises.map((p, i) => (
                    <div key={i} className="flex gap-2.5 text-xs text-slate-600">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-semibold text-[10px]">
                        {i + 1}
                      </span>
                      {p}
                    </div>
                  ))}
                </div>
              </div>

              {/* Evidence */}
              <div className="px-6 py-4 border-b">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Evidence</p>
                <div className="grid grid-cols-1 gap-2">
                  {arg.evidence.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => toast.info(`Evidence: ${e.title}`)}
                      className="flex items-center gap-2 text-left p-2 rounded-lg border bg-slate-50 hover:bg-slate-100 transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-slate-700">{e.title}</p>
                        <p className="text-xs text-slate-400">{e.type}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Embed Code Snippet */}
              <div className="px-6 py-4 border-b bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Embed this argument</p>
                <div className="relative rounded-lg border bg-slate-900 p-3 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre>{`<iframe\n  src="https://isonomia.app/embed/argument/${arg.identifier}"\n  width="600" height="400"\n  frameborder="0"\n  allowtransparency="true"\n></iframe>`}</pre>
                  <button
                    onClick={() => handleCopy("")}
                    className="absolute top-2 right-2 p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 flex items-center justify-between text-xs text-slate-400">
                <span>Powered by Isonomia</span>
                <div className="flex items-center gap-2">
                  <span>{arg.supportCount} supporting</span>
                  <span>·</span>
                  <span>{arg.challengeCount} challenges</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white text-sm">
              {/* Sticky Nav */}
              <div className="border-b px-6 py-3 flex items-center justify-between bg-white/95">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-600 to-violet-600" />
                  <span className="font-semibold text-sm text-slate-800">Isonomia</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="truncate max-w-[200px]">{claim.deliberation.title}</span>
                  <ChevronRight className="w-3 h-3" />
                  <span>Claim</span>
                </div>
                <button
                  onClick={() => toast.info("CTA → /signup")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors"
                >
                  Respond
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Claim Hero */}
              <div className="px-6 py-5 bg-gradient-to-br from-slate-50 to-violet-50/30 border-b">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">Claim</Badge>
                  <Badge variant="outline" className="text-xs font-mono">{claim.moid}</Badge>
                </div>
                <h1 className="text-lg font-bold text-slate-900 mb-3">{claim.text}</h1>
                {/* Engagement Stats */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="font-semibold">{claim.supportCount}</span> support
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-red-500">
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span className="font-semibold">{claim.challengeCount}</span> challenge
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-indigo-600">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="font-semibold">{claim.argumentCount}</span> arguments
                  </div>
                </div>
              </div>

              {/* Evidence */}
              <div className="px-6 py-4 border-b">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Evidence</p>
                {claim.evidence.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg border bg-slate-50 mb-2">
                    <BookOpen className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-slate-700">{e.title}</p>
                      <p className="text-xs text-slate-400">{e.type}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tags */}
              <div className="px-6 py-4 border-b">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tags</p>
                <div className="flex gap-1.5 flex-wrap">
                  {claim.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>

              {/* Embed Code */}
              <div className="px-6 py-4 border-b bg-slate-50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Embed this claim</p>
                <div className="relative rounded-lg border bg-slate-900 p-3 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre>{`<iframe\n  src="https://isonomia.app/embed/claim/${claim.moid}"\n  width="600" height="280"\n  frameborder="0"\n></iframe>`}</pre>
                  <button
                    onClick={() => handleCopy("")}
                    className="absolute top-2 right-2 p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="px-6 py-3 text-xs text-slate-400">Powered by Isonomia</div>
            </div>
          )}
        </div>

        {/* Metadata Inspection */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Inspect &lt;head&gt; metadata for this page</p>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowJsonLD(!showJsonLD); setShowOgTags(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                showJsonLD ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Braces className="w-4 h-4" />
              JSON-LD Structured Data
            </button>
            <button
              onClick={() => { setShowOgTags(!showOgTags); setShowJsonLD(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
                showOgTags ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Tag className="w-4 h-4" />
              OG + Twitter Card Tags
            </button>
          </div>
        </div>

        {showJsonLD && (
          <div className="rounded-lg border bg-slate-900 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
            <pre>{JSON.stringify(activeType === "argument" ? argumentJsonLD : claimJsonLD, null, 2)}</pre>
          </div>
        )}

        {showOgTags && (
          <div className="rounded-lg border bg-slate-900 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
            <pre>{activeType === "argument"
              ? `<meta property="og:type" content="article" />
<meta property="og:title" content="${arg.conclusion.text.slice(0, 60)}… — Isonomia" />
<meta property="og:description" content="${arg.text.slice(0, 100)}…" />
<meta property="og:image" content="https://isonomia.app/api/og/argument/${arg.identifier}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="alternate" type="application/json+oembed"
  href="https://isonomia.app/api/oembed?url=..." />`
              : `<meta property="og:type" content="article" />
<meta property="og:title" content="${claim.text.slice(0, 60)}… — Isonomia" />
<meta property="og:image" content="https://isonomia.app/api/og/claim/${claim.moid}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="alternate" type="application/json+oembed"
  href="https://isonomia.app/api/oembed?url=..." />`
            }</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Embed Widgets
// ─────────────────────────────────────────────────────────────────────────────

function EmbedWidgetsDemo() {
  const [activeType, setActiveType] = useState<"argument" | "claim">("argument");
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("light");
  const [compact, setCompact] = useState(false);
  const [showEvidence, setShowEvidence] = useState(true);
  const [showPremises, setShowPremises] = useState(true);
  const [activeArgKey, setActiveArgKey] = useState<ArgKey>("epistemic");
  const [activeClaimKey, setActiveClaimKey] = useState<ClaimKey>("algorithms");
  const [copied, setCopied] = useState(false);

  const arg = MOCK_ARGUMENTS[activeArgKey];
  const claim = MOCK_CLAIMS[activeClaimKey];

  const isDark = theme === "dark";
  const embedHeight = activeType === "argument" ? (compact ? 220 : 400) : (compact ? 160 : 280);

  const iframeParams = new URLSearchParams();
  if (theme !== "auto") iframeParams.set("theme", theme);
  if (compact) iframeParams.set("compact", "true");
  if (!showEvidence && activeType === "argument") iframeParams.set("showEvidence", "false");
  if (!showPremises && activeType === "argument") iframeParams.set("showPremises", "false");

  const iframeSrc = activeType === "argument"
    ? `https://isonomia.app/embed/argument/${arg.identifier}${iframeParams.toString() ? `?${iframeParams}` : ""}`
    : `https://isonomia.app/embed/claim/${claim.moid}${iframeParams.toString() ? `?${iframeParams}` : ""}`;

  const iframeCode = `<iframe\n  src="${iframeSrc}"\n  width="600"\n  height="${embedHeight}"\n  frameborder="0"\n  allowtransparency="true"\n></iframe>`;

  const handleCopy = () => {
    setCopied(true);
    toast.success("Iframe code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const bgClass = isDark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-500";
  const borderClass = isDark ? "border-slate-700" : "border-slate-200";
  const badgeBg = isDark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600";
  const accentClass = isDark ? "text-indigo-400" : "text-indigo-600";
  const premiseBg = isDark ? "bg-slate-800/50" : "bg-slate-50";
  const evidenceBg = isDark ? "bg-slate-800/50" : "bg-slate-50";
  const footerBg = isDark ? "bg-slate-800/60" : "bg-slate-50";

  return (
    <div className="modalv2">
      <div className="pb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/12 to-purple-500/12 text-violet-600">
            <Monitor className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Embed Widgets</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-700 border border-violet-500/20">Interactive</span>
        </div>
        <p className="text-sm text-slate-500">Drop an argument or claim into any webpage with a single &lt;iframe&gt; tag. Adjust theme, size, and content visibility — the code updates instantly.</p>
      </div>
      <div className="space-y-4">
        {/* Controls Row */}
        <div className="flex flex-wrap gap-3">
          {/* Type Toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => setActiveType("argument")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeType === "argument" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Argument
            </button>
            <button
              onClick={() => setActiveType("claim")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l ${
                activeType === "claim" ? "bg-violet-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              Claim
            </button>
          </div>

          {/* Theme Toggle */}
          <div className="flex rounded-lg border overflow-hidden">
            {(["light", "auto", "dark"] as const).map((t) => {
              const Icon = t === "light" ? Sun : t === "dark" ? Moon : Lightbulb;
              return (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors border-l first:border-l-0 ${
                    theme === t ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            })}
          </div>

          {/* Compact Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCompact(!compact)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  compact ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Minimize2 className="w-3 h-3" />
                Compact
              </button>
            </TooltipTrigger>
            <TooltipContent>Reduced-height variant for sidebars and inline embeds</TooltipContent>
          </Tooltip>

          {/* Evidence/Premises toggles — argument only */}
          {activeType === "argument" && (
            <>
              <button
                onClick={() => setShowEvidence(!showEvidence)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  showEvidence ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400 line-through"
                }`}
              >
                Evidence
              </button>
              <button
                onClick={() => setShowPremises(!showPremises)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  showPremises ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400 line-through"
                }`}
              >
                Premises
              </button>
            </>
          )}
        </div>

        {/* Demo switcher */}
        {activeType === "argument" ? (
          <div className="flex gap-2">
            {(Object.keys(MOCK_ARGUMENTS) as ArgKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveArgKey(key)}
                className={`flex-1 text-left px-3 py-1.5 rounded-lg border text-xs transition-all ${
                  activeArgKey === key ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="font-medium text-slate-700">{MOCK_ARGUMENTS[key].conclusion.text.slice(0, 45)}…</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            {(Object.keys(MOCK_CLAIMS) as ClaimKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setActiveClaimKey(key)}
                className={`flex-1 text-left px-3 py-1.5 rounded-lg border text-xs transition-all ${
                  activeClaimKey === key ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="font-medium text-slate-700">{MOCK_CLAIMS[key].text.slice(0, 50)}…</span>
              </button>
            ))}
          </div>
        )}

        {/* Widget Simulation */}
        <div className="rounded-xl border shadow-sm overflow-hidden" style={{ maxWidth: 600 }}>
          {/* Simulated iframe label */}
          <div className="bg-slate-100 border-b px-3 py-1 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-xs text-slate-500 font-mono truncate">{iframeSrc}</span>
          </div>

          {/* Widget Content */}
          <div
            className={`${bgClass} font-sans`}
            style={{ height: embedHeight, overflow: "hidden" }}
          >
            {activeType === "argument" ? (
              <div className="h-full flex flex-col p-4">
                {/* Badge Row */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${badgeBg}`}>
                    {arg.type === "SUPPORT" ? "Support" : "Challenge"}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${badgeBg}`}>
                    {arg.scheme}
                  </span>
                </div>

                {!compact && (
                  <>
                    {/* Confidence Bar */}
                    <div className="mb-3">
                      <div className={`flex items-center justify-between text-xs mb-1 ${mutedClass}`}>
                        <span>Confidence</span>
                        <span className="font-medium">{arg.confidence}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${arg.confidence}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Conclusion */}
                <div className={`rounded-lg border ${borderClass} p-2.5 mb-2.5`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${mutedClass}`}>Conclusion</p>
                  <p className="text-sm font-semibold leading-snug line-clamp-2">{arg.conclusion.text}</p>
                </div>

                {!compact && (
                  <p className={`text-xs leading-relaxed mb-2.5 line-clamp-2 ${mutedClass}`}>{arg.text}</p>
                )}

                {/* Premises */}
                {showPremises && !compact && (
                  <div className={`rounded-lg ${premiseBg} p-2.5 mb-2.5`}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${mutedClass}`}>Premises</p>
                    <div className="space-y-1">
                      {arg.premises.slice(0, 2).map((p, i) => (
                        <div key={i} className={`text-xs flex gap-1.5 ${mutedClass}`}>
                          <span className="shrink-0 font-medium">{i + 1}.</span>
                          <span className="line-clamp-1">{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidence */}
                {showEvidence && !compact && (
                  <div className={`rounded-lg ${evidenceBg} p-2.5 mb-2.5`}>
                    <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${mutedClass}`}>Evidence</p>
                    {arg.evidence.slice(0, 1).map((e, i) => (
                      <div key={i} className={`text-xs flex gap-1.5 items-center ${mutedClass}`}>
                        <BookOpen className="w-3 h-3 shrink-0" />
                        <span className="line-clamp-1">{e.title}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className={`mt-auto pt-2 border-t ${borderClass} flex items-center justify-between`}>
                  <span className={`text-[10px] ${mutedClass}`}>
                    Powered by <span className={`font-semibold ${accentClass}`}>Isonomia</span>
                  </span>
                  <span className={`text-[10px] ${mutedClass} line-clamp-1 max-w-[60%] text-right`}>
                    {arg.deliberation.title}
                  </span>
                </div>
              </div>
            ) : (
              <div className={`h-full flex flex-col p-4 ${bgClass}`}>
                {/* Badge Row */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${badgeBg}`}>Claim</span>
                  <span className={`text-xs font-mono ${mutedClass}`}>{claim.moid}</span>
                </div>

                {/* Claim Text */}
                <p className={`text-sm font-medium leading-snug mb-3 ${compact ? "line-clamp-2" : "line-clamp-3"}`}>
                  {claim.text}
                </p>

                {!compact && (
                  <div className="flex items-center gap-4 mb-3">
                    <div className={`flex items-center gap-1 text-xs text-emerald-500`}>
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span className="font-semibold">{claim.supportCount}</span>
                    </div>
                    <div className={`flex items-center gap-1 text-xs text-red-400`}>
                      <ThumbsDown className="w-3.5 h-3.5" />
                      <span className="font-semibold">{claim.challengeCount}</span>
                    </div>
                    <div className={`flex items-center gap-1 text-xs ${accentClass}`}>
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="font-semibold">{claim.argumentCount}</span>
                    </div>
                  </div>
                )}

                {!compact && (
                  <div className={`rounded-lg ${evidenceBg} p-2 mb-3`}>
                    {claim.evidence.slice(0, 1).map((e, i) => (
                      <div key={i} className={`text-xs flex gap-1.5 items-center ${mutedClass}`}>
                        <BookOpen className="w-3 h-3 shrink-0" />
                        <span className="line-clamp-1">{e.title}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className={`mt-auto pt-2 border-t ${borderClass} flex items-center justify-between`}>
                  <span className={`text-[10px] ${mutedClass}`}>
                    Powered by <span className={`font-semibold ${accentClass}`}>Isonomia</span>
                  </span>
                  <span className={`text-[10px] font-medium ${accentClass}`}>
                    Respond on Isonomia →
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Height indicator */}
          <div className="bg-slate-100 border-t px-3 py-1.5 flex items-center justify-between">
            <span className="text-xs text-slate-500 tabular-nums">{embedHeight}px × 600px</span>
            <span className="text-xs text-slate-400">
              theme: <span className="font-medium">{theme}</span>
              {theme === "auto" && <span className="ml-1 opacity-60">(follows OS preference)</span>}
            </span>
          </div>
        </div>

        {/* Iframe Code Output */}
        <div>
          <p className="text-sm font-medium mb-1">Generated embed code</p>
          <p className="text-xs text-slate-500 mb-2">Updates live as you adjust the controls above. Paste anywhere that accepts HTML.</p>
          <div className="relative rounded-lg border bg-slate-900 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
            <pre>{iframeCode}</pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors text-xs"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Distribution (OG + oEmbed + API)
// ─────────────────────────────────────────────────────────────────────────────

function DistributionDemo() {
  const [activeType, setActiveType] = useState<"argument" | "claim">("argument");
  const [activeArgKey, setActiveArgKey] = useState<ArgKey>("epistemic");
  const [activeClaimKey, setActiveClaimKey] = useState<ClaimKey>("algorithms");
  const [showOembed, setShowOembed] = useState(false);

  const arg = MOCK_ARGUMENTS[activeArgKey];
  const claim = MOCK_CLAIMS[activeClaimKey];

  const oembedArgument = {
    version: "1.0",
    type: "rich",
    title: `${arg.conclusion.text} — Isonomia`,
    author_name: arg.author.name,
    author_url: `https://isonomia.app/u/${arg.author.username}`,
    provider_name: "Isonomia",
    provider_url: "https://isonomia.app",
    thumbnail_url: `https://isonomia.app/api/og/argument/${arg.identifier}`,
    thumbnail_width: 1200,
    thumbnail_height: 630,
    width: 600,
    height: 400,
    html: `<iframe src="https://isonomia.app/embed/argument/${arg.identifier}" width="600" height="400" frameborder="0"></iframe>`,
  };

  const oembedClaim = {
    version: "1.0",
    type: "rich",
    title: `${claim.text.slice(0, 80)}… — Isonomia`,
    author_name: claim.author.name,
    author_url: `https://isonomia.app/u/${claim.author.username}`,
    provider_name: "Isonomia",
    provider_url: "https://isonomia.app",
    thumbnail_url: `https://isonomia.app/api/og/claim/${claim.moid}`,
    thumbnail_width: 1200,
    thumbnail_height: 630,
    width: 600,
    height: 280,
    html: `<iframe src="https://isonomia.app/embed/claim/${claim.moid}" width="600" height="280" frameborder="0"></iframe>`,
  };

  return (
    <div className="modalv2">
      <div className="pb-4">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-slate-500/10 to-indigo-500/10 text-slate-600">
            <Share2 className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-900 text-lg">Distribution</p>
          <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-slate-500/10 to-indigo-500/10 text-slate-700 border border-slate-400/25">Interactive</span>
        </div>
        <p className="text-sm text-slate-500">Paste an argument URL into Twitter, Reddit, or any oEmbed-aware platform and it unfurls as a rich interactive card — no plugin, no login.</p>
      </div>
      <div className="space-y-5">
        {/* Type + Demo Switcher */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveType("argument")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                activeType === "argument" ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Scale className="w-4 h-4" /> Argument
            </button>
            <button
              onClick={() => setActiveType("claim")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                activeType === "claim" ? "border-violet-500 bg-violet-50 text-violet-700 ring-2 ring-violet-200" : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Hash className="w-4 h-4" /> Claim
            </button>
          </div>
          {activeType === "argument" ? (
            <div className="flex gap-2">
              {(Object.keys(MOCK_ARGUMENTS) as ArgKey[]).map((key) => (
                <button key={key} onClick={() => setActiveArgKey(key)}
                  className={`flex-1 text-left px-3 py-1.5 rounded-lg border text-xs transition-all ${activeArgKey === key ? "border-indigo-400 bg-indigo-50" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <span className="text-slate-700">{MOCK_ARGUMENTS[key].conclusion.text.slice(0, 50)}…</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              {(Object.keys(MOCK_CLAIMS) as ClaimKey[]).map((key) => (
                <button key={key} onClick={() => setActiveClaimKey(key)}
                  className={`flex-1 text-left px-3 py-1.5 rounded-lg border text-xs transition-all ${activeClaimKey === key ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-slate-300"}`}
                >
                  <span className="text-slate-700">{MOCK_CLAIMS[key].text.slice(0, 55)}…</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* OG Social Card Simulation */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1 rounded-md bg-pink-500/10 text-pink-600">
              <ImageIcon className="w-3.5 h-3.5" />
            </div>
            <p className="text-sm font-semibold text-slate-700">OG Social Card Preview</p>
            <span className="text-[11px] text-slate-400 font-mono ml-0.5">1200 × 630 — scaled</span>
          </div>

          {/* Browser-chrome frame */}
          <div className="rounded-xl border border-slate-200/80 overflow-hidden shadow-sm">
            {/* Fake browser toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50/90 border-b border-slate-200/70">
              <div className="flex gap-1.5 shrink-0">
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <div className="w-2 h-2 rounded-full bg-slate-300" />
                <div className="w-2 h-2 rounded-full bg-slate-300" />
              </div>
              <div className="flex-1 mx-2 rounded-md bg-white border border-slate-200 px-2.5 py-0.5">
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  isonomia.app/{activeType === "argument" ? `a/${arg.identifier}` : `c/${claim.moid}`}
                </p>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">Link preview</span>
            </div>

            {/* Card body */}
            {activeType === "argument" ? (
              <div
                className="relative overflow-hidden"
                style={{ height: 235, background: "linear-gradient(140deg, #0d0b1e 0%, #1a1363 35%, #2d2080 65%, #1e1850 100%)" }}
              >
                {/* Dot-grid texture */}
                <div
                  className="absolute inset-0 opacity-[0.05]"
                  style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
                />
                {/* Accent line at top */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600" />

                <div className="absolute inset-0 px-7 pt-6 pb-5 flex flex-col">
                  {/* Provider row */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                        <span className="text-white font-bold" style={{ fontSize: 8 }}>I</span>
                      </div>
                      <span className="text-indigo-300/80 text-[11px] font-semibold tracking-widest uppercase">Isonomia</span>
                    </div>
                    <span className="text-white/25 text-[10px] font-mono">isonomia.app</span>
                  </div>

                  {/* Type chip + scheme */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/30 text-indigo-100 border border-indigo-400/50">
                      {arg.type === "SUPPORT" ? "↑ Supporting" : "↓ Challenge"}
                    </span>
                    <span className="text-white/30 text-[10px]">{arg.scheme}</span>
                  </div>

                  {/* Conclusion */}
                  <p className="text-white font-bold leading-snug line-clamp-2 mb-2.5" style={{ fontSize: 15 }}>
                    {arg.conclusion.text}
                  </p>

                  {/* Excerpt */}
                  <p className="text-indigo-200/50 text-[11px] leading-relaxed line-clamp-2 mb-auto">
                    {arg.text.slice(0, 115)}…
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3.5 border-t border-white/[0.08]">
                    <span className="text-white/30 text-[10px]">
                      {arg.premises.length} premises · {arg.evidence.length} evidence
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
                      <span className="text-white/30 text-[10px]">{arg.confidence}% confidence</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="relative overflow-hidden"
                style={{ height: 220, background: "linear-gradient(140deg, #130523 0%, #3b0f72 45%, #5b21b6 80%, #6d28d9 100%)" }}
              >
                <div
                  className="absolute inset-0 opacity-[0.035]"
                  style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "22px 22px" }}
                />
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />

                <div className="absolute inset-0 px-7 pt-6 pb-5 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                        <span className="text-white font-bold" style={{ fontSize: 8 }}>I</span>
                      </div>
                      <span className="text-violet-300/80 text-[11px] font-semibold tracking-widest uppercase">Isonomia</span>
                    </div>
                    <span className="text-white/25 text-[10px] font-mono">{claim.moid}</span>
                  </div>

                  <p className="text-white font-bold leading-snug line-clamp-3 mb-auto" style={{ fontSize: 14 }}>
                    {claim.text}
                  </p>

                  <div className="flex items-center gap-4 pt-3 border-t border-white/[0.08]">
                    <span className="text-emerald-400/80 text-[10px] font-medium">↑ {claim.supportCount} support</span>
                    <span className="text-red-400/70 text-[10px] font-medium">↓ {claim.challengeCount} challenge</span>
                    <span className="text-white/30 text-[10px]">{claim.argumentCount} arguments</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* oEmbed JSON */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Braces className="w-4 h-4 text-slate-500" />
              oEmbed JSON Response
            </p>
            <button
              onClick={() => setShowOembed(!showOembed)}
              className="text-xs text-indigo-600 hover:underline"
            >
              {showOembed ? "Hide" : "Show"} full response
            </button>
          </div>
          {showOembed && (
            <div className="rounded-lg border bg-slate-900 p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-64 overflow-y-auto">
              <pre>{JSON.stringify(activeType === "argument" ? oembedArgument : oembedClaim, null, 2)}</pre>
            </div>
          )}
          {!showOembed && (
            <div className="rounded-lg border bg-slate-100 p-3 text-xs text-slate-500 font-mono">
              GET /api/oembed?url={activeType === "argument"
                ? encodeURIComponent(`https://isonomia.app/embed/argument/${arg.identifier}`)
                : encodeURIComponent(`https://isonomia.app/embed/claim/${claim.moid}`)
              }
            </div>
          )}
        </div>

        {/* API Routes Reference */}
        <div>
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-slate-500" />
            Phase 1 API Routes
          </p>
          <div className="border rounded-lg overflow-hidden divide-y">
            {API_ROUTES.map((route, i) => {
              const tagColors: Record<string, string> = {
                Page: "bg-indigo-100 text-indigo-700",
                Embed: "bg-violet-100 text-violet-700",
                OG: "bg-pink-100 text-pink-700",
                API: "bg-emerald-100 text-emerald-700",
              };
              return (
                <button
                  key={i}
                  onClick={() => toast.info(`${route.method} ${route.path} — ${route.description}`)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 text-left transition-colors"
                >
                  <span className="font-mono text-xs font-bold text-emerald-600 shrink-0 w-8">{route.method}</span>
                  <span className="font-mono text-xs text-slate-700 flex-1 truncate">{route.path}</span>
                  <span className="text-xs text-slate-500 truncate hidden sm:block">{route.description}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium shrink-0 ${tagColors[route.tag]}`}>
                    {route.tag}
                  </span>
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
// MAIN PAGE EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function EmbeddableWidgetDemoPage() {
  return (
    <TooltipProvider>
      <Toaster position="bottom-right" richColors />
      <div className="min-h-screen" style={{ background: "linear-gradient(145deg, #f8f9ff 0%, #f0f1ff 25%, #f5f0ff 60%, #f8f4ff 100%)" }}>
        {/* Page Header */}
        <div className="border-b border-slate-900/[0.07] bg-white/85 backdrop-blur-xl sticky top-0 z-40 px-6 py-4" style={{ boxShadow: "0 1px 3px rgba(99,102,241,0.06), 0 4px 16px -8px rgba(99,102,241,0.08)" }}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
                  <Link2 className="w-5 h-5 text-white" />
                </div>
                Embeddable Argument Widget
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Phase 1 — Permalink & Embed Infrastructure · <code className="text-xs bg-slate-100 px-1 rounded">/test/embeddable-widget</code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white shadow-sm">
                <Check className="w-3 h-3 mr-1" />
                Phase 1 Complete
              </Badge>
              <Badge variant="outline" className="text-slate-500">
                9 deliverables
              </Badge>
              <Badge variant="outline" className="text-slate-500">
                8 new files
              </Badge>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

          {/* Strategic Context Banner */}
          <div className="rounded-xl bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 border border-indigo-100/80 p-5">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">
                  Arguments that travel.
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Phase 1 builds the foundation for Isonomia&apos;s distribution strategy: every argument and claim gets a canonical public URL, a shareable OG social card, and a self-contained iframe widget that embeds anywhere — Reddit, Substack, a personal blog. No login required to read. The embed is the hook; the platform is where the conversation deepens.
                </p>
                <div className="flex flex-wrap gap-3 mt-3">
                  {[
                    { label: "Public permalink pages", color: "bg-indigo-100 text-indigo-700" },
                    { label: "Iframe embed widgets", color: "bg-violet-100 text-violet-700" },
                    { label: "1200×630 OG social cards", color: "bg-pink-100 text-pink-700" },
                    { label: "oEmbed discovery", color: "bg-emerald-100 text-emerald-700" },
                    { label: "No auth wall", color: "bg-amber-100 text-amber-700" },
                  ].map((chip) => (
                    <span key={chip.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${chip.color}`}>
                      {chip.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Feature Overview Grid */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Phase 1 Deliverables</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  8 new files created, 2 existing routes extended. Every deliverable is independently testable.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PHASE1_FEATURES.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
          </section>

          {/* Interactive Demos */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Interactive Demos</h2>
              <p className="text-sm text-slate-500 mt-0.5">Explore how each layer of the system looks and behaves. All rendering here is simulated — the real routes are live at the paths shown.</p>
            </div>
            <Tabs defaultValue="permalink" className="space-y-4">
              <TabsList className="bg-white border shadow-sm">
                <TabsTrigger value="permalink" className="gap-1.5">
                  <Globe className="w-4 h-4" />
                  Permalink Pages
                </TabsTrigger>
                <TabsTrigger value="embed" className="gap-1.5">
                  <Monitor className="w-4 h-4" />
                  Embed Widgets
                </TabsTrigger>
                <TabsTrigger value="distribution" className="gap-1.5">
                  <Share2 className="w-4 h-4" />
                  Distribution
                </TabsTrigger>
              </TabsList>

              <TabsContent value="permalink">
                <PermalinkPagesDemo />
              </TabsContent>

              <TabsContent value="embed">
                <EmbedWidgetsDemo />
              </TabsContent>

              <TabsContent value="distribution">
                <DistributionDemo />
              </TabsContent>
            </Tabs>
          </section>

          {/* Architecture Summary */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">How It&apos;s Built</h2>
              <p className="text-sm text-slate-500 mt-0.5">Three distinct layers — each independently deployable and testable.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-600 text-[11px] font-bold flex items-center justify-center">1</span>
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  <p className="text-sm font-semibold text-slate-800">Public Pages</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-indigo-700">/a/[identifier]</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-violet-700">/c/[moid]</div>
                </div>
                <p className="text-xs text-slate-500">Server components with <code className="bg-white/50 px-1 rounded">generateMetadata</code>. No auth wall. Full OG + JSON-LD. oEmbed link in <code className="bg-white/50 px-1 rounded">&lt;head&gt;</code>.</p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-violet-500/15 text-violet-600 text-[11px] font-bold flex items-center justify-center">2</span>
                  <Monitor className="w-3.5 h-3.5 text-violet-600" />
                  <p className="text-sm font-semibold text-slate-800">Embed Widgets</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-violet-700">/embed/argument/[id]</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-purple-700">/embed/claim/[moid]</div>
                </div>
                <p className="text-xs text-slate-500">Self-contained <code className="bg-white/50 px-1 rounded">&lt;html&gt;</code> — no JS bundle, no external deps. CSS via <code className="bg-white/50 px-1 rounded">embedStyles(theme)</code>. Three themes: light / dark / auto.</p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-pink-500/15 text-pink-600 text-[11px] font-bold flex items-center justify-center">3</span>
                  <ImageIcon className="w-3.5 h-3.5 text-pink-600" />
                  <p className="text-sm font-semibold text-slate-800">OG Cards + API</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-pink-700">/api/og/argument/[id]</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-emerald-700">/api/oembed?url=</div>
                </div>
                <p className="text-xs text-slate-500">1200×630 <code className="bg-white/50 px-1 rounded">ImageResponse</code> from <code className="bg-white/50 px-1 rounded">next/og</code>. oEmbed returns type: &quot;rich&quot; with iframe + thumbnail. Never 404s.</p>
              </div>
            </div>
          </section>

          {/* Permalink Identity */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Identifier Strategy</h2>
              <p className="text-sm text-slate-500 mt-0.5">Arguments and claims use different identifier mechanisms — chosen to match each model&apos;s existing schema rather than adding tables.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="cardv2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600"><Scale className="w-3.5 h-3.5" /></div>
                  <p className="text-sm font-semibold text-slate-800">Arguments — ArgumentPermalink Table</p>
                </div>
                <div className="rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-300 space-y-1 mb-3">
                  <div><span className="text-slate-500">shortCode:</span> <span className="text-indigo-400">&quot;rK7pA2mN&quot;</span> <span className="text-slate-600 ml-2">&#47;&#47; 8-char base62</span></div>
                  <div><span className="text-slate-500">slug:</span> <span className="text-indigo-400">&quot;recommendation-algorithms...&quot;</span></div>
                  <div><span className="text-slate-500">argumentId:</span> <span className="text-indigo-400">&quot;arg-xxx&quot;</span></div>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>Both shortCode and slug resolve via <code className="bg-slate-100/80 px-1 rounded">resolvePermalink(identifier)</code>.</p>
                  <p>URL: <code className="bg-slate-100/80 px-1 rounded">/a/rK7pA2mN</code> or <code className="bg-slate-100/80 px-1 rounded">/a/recommendation-...</code></p>
                </div>
              </div>

              <div className="cardv2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-600"><Hash className="w-3.5 h-3.5" /></div>
                  <p className="text-sm font-semibold text-slate-800">Claims — moid as Natural Identifier</p>
                </div>
                <div className="rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-300 space-y-1 mb-3">
                  <div><span className="text-slate-500">moid:</span> <span className="text-violet-400">&quot;CLAIM-7A3B&quot;</span> <span className="text-slate-600 ml-2">&#47;&#47; unique, stable</span></div>
                  <div className="text-slate-600">&#47;&#47; No separate permalink table needed</div>
                  <div><span className="text-slate-500">prisma.claim.findUnique</span><span className="text-slate-400">{"({ where: { moid } })"}</span></div>
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <p>Claims use <code className="bg-slate-100/80 px-1 rounded">moid</code> directly — already unique and stable in the schema.</p>
                  <p>URL: <code className="bg-slate-100/80 px-1 rounded">/c/CLAIM-7A3B</code></p>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="py-6 border-t border-slate-900/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-500">Embeddable Argument Widget — Phase 1</span>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-600 text-[11px] font-medium">Phases 2–5 planned</span>
              <span className="text-slate-300">·</span>
              <span>April 2026</span>
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
