"use client";

/**
 * Embeddable Argument Widget — Phase 3 Demo
 *
 * Interactive demonstration of all Phase 3 deliverables:
 *
 * PHASE 3 – DISTRIBUTION — BROWSER EXTENSION:
 * - 3.1 Extension Project Setup — Manifest V3, build config, auth, project structure
 * - 3.2 Context Menu — "Create Isonomia Argument" from text selection
 * - 3.3 Content Script — Link detection & inline rich preview on Reddit/X/HN
 * - 3.4 Extension Popup — Compact Quick Argument Builder in the popup
 * - 3.5 Firefox Port — WebExtension API compatibility via webextension-polyfill
 * - 3.6 Safari Port — Safari Web Extensions (Xcode wrapper)
 *
 * Accessible at: /test/embeddable-widget-phase3
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
  Braces,
  FileCode,
  Monitor,
  MessageSquare,
  Send,
  Layers,
  FolderOpen,
  Sparkles,
  ClipboardCopy,
  Terminal,
  Chrome,
  MousePointerClick,
  Eye,
  Puzzle,
  Settings,
  Search,
  User,
  Lock,
  Smartphone,
  Layout,
  MousePointer,
  type LucideIcon,
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

const MOCK_SELECTION = {
  text: "Studies show that remote work increases productivity by 13% for knowledge workers, with the largest gains seen in focused task completion.",
  pageUrl: "https://nber.org/papers/w28461",
  pageTitle: "Bloom et al. — Does Working from Home Work? Evidence from a Chinese Experiment",
};

const MOCK_DETECTED_LINKS = [
  {
    url: `${BASE_URL}/a/rK7pA2mN`,
    platform: "reddit",
    claim: "Recommendation algorithms produce systemic epistemic harm in democratic contexts",
    confidence: 78,
    evidenceCount: 3,
    scheme: "Argumentation from Analogy",
    author: "Dr. Priya Anand",
  },
  {
    url: `${BASE_URL}/a/mB4qC8dX`,
    platform: "twitter",
    claim: "Carbon pricing is the most economically efficient mechanism for reducing emissions at scale",
    confidence: 65,
    evidenceCount: 2,
    scheme: "Practical Reasoning",
    author: "Prof. Marcus Chen",
  },
  {
    url: `${BASE_URL}/c/CLAIM-7A3B`,
    platform: "hackernews",
    claim: "Social media recommendation systems systematically amplify divisive content over informative content",
    confidence: null,
    evidenceCount: 0,
    scheme: null,
    author: "Dr. Priya Anand",
  },
];

const MOCK_RECENT_ARGUMENTS = [
  { id: "arg-1", slug: "rK7pA2mN", claim: "Recommendation algorithms produce systemic epistemic harm", created: "2 hours ago" },
  { id: "arg-2", slug: "mB4qC8dX", claim: "Carbon pricing is the most efficient emissions mechanism", created: "Yesterday" },
  { id: "arg-3", slug: "qT5nL9pR", claim: "Large language models cannot perform genuine reasoning", created: "3 days ago" },
];

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 3 FEATURE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const PHASE3_FEATURES: {
  id: string;
  step: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
  items: string[];
}[] = [
  {
    id: "extension-setup",
    step: "3.1",
    title: "Extension Project Setup",
    description: "Chrome Manifest V3 extension scaffold with webpack build, OAuth auth, and shared types",
    icon: FolderOpen,
    color: "from-sky-500/10 to-blue-500/15",
    iconColor: "text-sky-600",
    items: [
      "Manifest V3 — required for Chrome Web Store since Nov 2024",
      "Build: webpack or esbuild — lightweight, no full Next.js needed",
      "Auth: OAuth2 flow with Isonomia backend → chrome.storage.local token",
      "Permissions: activeTab, contextMenus, storage, identity",
      "Host permissions: *://isonomia.app/* (production domain only)",
      "Project in extensions/chrome/ — separate package.json from main app",
      "Shared types (types.ts) + API client (api-client.ts) + auth module (auth.ts)",
    ],
  },
  {
    id: "context-menu",
    step: "3.2",
    title: "Context Menu — Create Argument",
    description: "Right-click on selected text to create an Isonomia argument pre-filled with the selection",
    icon: MousePointerClick,
    color: "from-emerald-500/10 to-teal-500/15",
    iconColor: "text-emerald-600",
    items: [
      "chrome.contextMenus.create — \"Create Isonomia Argument\" on text selection",
      "Pre-fills claim with selected text, first evidence URL with current page",
      "Auto-unfurls page URL via /api/unfurl for title + metadata",
      "User edits claim, adds sources → \"Create & Copy Link\" calls /api/arguments/quick",
      "On success: copies permalink to clipboard, shows confirmation, closes popup",
      "Unauthenticated state: shows login prompt with OAuth redirect",
      "Network error state: shows offline message with retry button",
    ],
  },
  {
    id: "content-script",
    step: "3.3",
    title: "Content Script — Link Detection & Preview",
    description: "Detects Isonomia URLs on Reddit, X, and HN and renders rich inline preview cards",
    icon: Eye,
    color: "from-violet-500/10 to-purple-500/15",
    iconColor: "text-violet-600",
    items: [
      "link-detector.ts — scans page for isonomia.app/a/ and isonomia.app/c/ patterns",
      "Fetches argument/claim metadata from Isonomia API per detected link",
      "Injects styled card via Shadow DOM — full style isolation from host page",
      "Reddit: detects links in .md comment bodies, injects card after link element",
      "Twitter/X: detects links in tweet cards, enhances with additional metadata",
      "HN: detects links in .comment elements, injects card inline",
      "Lightweight HTML/CSS template (no React) — mirrors OG card layout",
      "Per-site toggle in extension options — off by default, user opts in",
    ],
  },
  {
    id: "popup-builder",
    step: "3.4",
    title: "Extension Popup — Quick Builder",
    description: "Compact Quick Argument Builder accessible from the extension icon click",
    icon: Puzzle,
    color: "from-amber-500/10 to-orange-500/15",
    iconColor: "text-amber-600",
    items: [
      "Compact version of QuickArgumentBuilder from Step 2.5",
      "Pre-fills current page URL as evidence source automatically",
      "Shows recent arguments (last 5) for quick re-sharing",
      "\"Search Isonomia arguments\" field for finding existing to share",
      "Built with Preact or lightweight React — popup must load fast",
      "One-click \"Create & Copy Link\" primary action",
      "Success state: permalink + \"Copy Embed\" + \"Copy Markdown\" buttons",
    ],
  },
  {
    id: "firefox-port",
    step: "3.5",
    title: "Firefox Port",
    description: "Port Chrome extension to Firefox using WebExtension API polyfill",
    icon: Globe,
    color: "from-orange-500/10 to-red-500/15",
    iconColor: "text-orange-600",
    items: [
      "Manifest V3 largely compatible — minor background.service_worker vs background.scripts diff",
      "Uses webextension-polyfill for browser namespace compatibility",
      "Test on Firefox Developer Edition before submission",
      "Submit to Firefox Add-ons (addons.mozilla.org)",
      "Same OAuth flow — Firefox supports identity API with minor config differences",
    ],
  },
  {
    id: "safari-port",
    step: "3.6",
    title: "Safari Port",
    description: "Port to Safari via Safari Web Extensions and Xcode project wrapper",
    icon: Smartphone,
    color: "from-blue-500/10 to-cyan-500/15",
    iconColor: "text-blue-600",
    items: [
      "Safari Web Extensions use the same WebExtension API",
      "Requires Xcode project wrapper + Apple Developer account",
      "xcrun safari-web-extension-converter generates Xcode project from existing source",
      "Submit to App Store — macOS + iOS Safari support",
      "Test on Safari Technology Preview before submission",
    ],
  },
];

const PHASE3_FILES = [
  { type: "new", path: "extensions/chrome/manifest.json", desc: "Manifest V3 — permissions, background, content scripts" },
  { type: "new", path: "extensions/chrome/src/background/service-worker.ts", desc: "Background service worker — context menus, message routing" },
  { type: "new", path: "extensions/chrome/src/content/link-detector.ts", desc: "Finds isonomia.app URLs on Reddit, X, HN pages" },
  { type: "new", path: "extensions/chrome/src/content/inline-renderer.ts", desc: "Renders rich preview cards via Shadow DOM" },
  { type: "new", path: "extensions/chrome/src/content/selection-handler.ts", desc: "Right-click → create argument from text selection" },
  { type: "new", path: "extensions/chrome/src/popup/popup.html", desc: "Extension popup HTML shell" },
  { type: "new", path: "extensions/chrome/src/popup/popup.tsx", desc: "Quick Argument Builder in popup — Preact/React" },
  { type: "new", path: "extensions/chrome/src/popup/popup.css", desc: "Popup styles — compact layout for 400×600 viewport" },
  { type: "new", path: "extensions/chrome/src/options/options.html", desc: "Options page HTML shell" },
  { type: "new", path: "extensions/chrome/src/options/options.tsx", desc: "Account connection, per-site toggles, preferences" },
  { type: "new", path: "extensions/chrome/src/shared/api-client.ts", desc: "Authenticated Isonomia API client for extension" },
  { type: "new", path: "extensions/chrome/src/shared/auth.ts", desc: "OAuth2 token management via chrome.storage.local" },
  { type: "new", path: "extensions/chrome/src/shared/types.ts", desc: "Shared TypeScript type definitions" },
  { type: "new", path: "extensions/chrome/webpack.config.js", desc: "Webpack build config — separate bundles per entry" },
  { type: "new", path: "extensions/chrome/package.json", desc: "Extension-specific dependencies" },
  { type: "new", path: "extensions/chrome/README.md", desc: "Development guide — build, test, install locally" },
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

function FeatureCard({ feature }: { feature: (typeof PHASE3_FEATURES)[0] }) {
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
          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/25">
            Planned
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
// INTERACTIVE DEMO: Context Menu Simulation
// ─────────────────────────────────────────────────────────────────────────────

function ContextMenuDemo() {
  const [step, setStep] = useState<"select" | "menu" | "popup" | "creating" | "success">("select");
  const [claimText, setClaimText] = useState(MOCK_SELECTION.text);
  const { copiedKey, copy } = useCopy();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCreate = () => {
    setStep("creating");
    timerRef.current = setTimeout(() => setStep("success"), 1500);
  };

  const reset = () => setStep("select");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/12 to-teal-500/12 text-emerald-600">
          <MousePointerClick className="w-4 h-4" />
        </div>
        <p className="font-semibold text-slate-900 text-lg">Context Menu Flow</p>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-emerald-500/10 to-teal-500/10 text-emerald-700 border border-emerald-500/20">Interactive</span>
      </div>
      <p className="text-sm text-slate-500">
        Simulates the right-click → &quot;Create Isonomia Argument&quot; flow. Highlight text on any page, right-click, and the extension pre-fills a quick argument form.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-1 text-xs">
        {(["select", "menu", "popup", "creating", "success"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
            <span className={`px-2 py-0.5 rounded-full font-medium ${
              step === s ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
            }`}>
              {s === "select" ? "1. Select text" : s === "menu" ? "2. Right-click" : s === "popup" ? "3. Edit & create" : s === "creating" ? "4. Saving..." : "5. Done!"}
            </span>
          </div>
        ))}
      </div>

      {/* Simulated browser page */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-md">
        {/* Browser chrome */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-white rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-500 font-mono truncate">
            {MOCK_SELECTION.pageUrl}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded bg-sky-500/15 flex items-center justify-center" title="Isonomia extension icon">
              <Puzzle className="w-3.5 h-3.5 text-sky-600" />
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="p-6 min-h-[200px] relative">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">NBER Working Paper No. 28461</p>
          <h3 className="text-lg font-bold text-slate-800 mb-3">{MOCK_SELECTION.pageTitle}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            This study examines the impact of remote work on employee productivity at a large technology firm.{" "}
            <span
              className={`transition-all cursor-pointer ${
                step === "select"
                  ? "bg-yellow-100 hover:bg-yellow-200 border-b border-yellow-300"
                  : "bg-blue-100 border-b border-blue-300"
              }`}
              onClick={() => {
                if (step === "select") setStep("menu");
              }}
            >
              {MOCK_SELECTION.text}
            </span>{" "}
            The implications extend across industries where deep focus work is primary.
          </p>

          {/* Context menu overlay */}
          {step === "menu" && (
            <div className="absolute top-24 right-12 z-10 bg-white rounded-lg border border-slate-200 shadow-xl py-1 w-64 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-100">Chrome Context Menu</div>
              <button className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Cut</button>
              <button className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Copy</button>
              <button className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Paste</button>
              <div className="border-t border-slate-100 my-1" />
              <button className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Search Google for &quot;Studies show that remote...&quot;</button>
              <div className="border-t border-slate-100 my-1" />
              <button
                className="w-full text-left px-3 py-2 text-sm font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 flex items-center gap-2 transition-all"
                onClick={() => setStep("popup")}
              >
                <Puzzle className="w-4 h-4 text-sky-600" />
                Create Isonomia Argument
                <ChevronRight className="w-3 h-3 ml-auto text-sky-400" />
              </button>
              <button className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">Inspect</button>
            </div>
          )}
        </div>
      </div>

      {/* Popup/Sidebar form simulation */}
      {(step === "popup" || step === "creating" || step === "success") && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-md max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gradient-to-r from-sky-500/8 to-blue-500/8 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-sky-600" />
            <p className="text-sm font-semibold text-slate-800">Create Isonomia Argument</p>
            <span className="ml-auto text-[10px] font-mono text-slate-400">extension popup</span>
          </div>

          <div className="p-4 space-y-3">
            {step === "success" ? (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Argument created!</p>
                  <p className="text-sm text-slate-500 mt-1">Your counter-argument is ready. Copy the link to paste it in the conversation:</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg border px-3 py-2">
                  <code className="text-xs text-sky-700 font-mono flex-1 truncate">{BASE_URL}/a/xN9kR3pQ</code>
                  <button
                    onClick={() => copy(`${BASE_URL}/a/xN9kR3pQ`, "ctx-permalink")}
                    className="text-xs px-2 py-1 rounded bg-sky-500 text-white hover:bg-sky-600 transition-all flex items-center gap-1"
                  >
                    {copiedKey === "ctx-permalink" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === "ctx-permalink" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => copy(`<iframe src="${BASE_URL}/embed/argument/xN9kR3pQ?theme=auto" width="600" height="400" frameborder="0"></iframe>`, "ctx-embed")}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 transition-all"
                  >
                    <Code className="w-3 h-3" />
                    {copiedKey === "ctx-embed" ? "Copied!" : "Copy Embed"}
                  </button>
                  <button
                    onClick={() => toast.info("Opens /a/xN9kR3pQ in new tab")}
                    className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 transition-all"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View
                  </button>
                </div>
                <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600 underline">
                  Reset demo
                </button>
              </div>
            ) : (
              <>
                {/* Claim input */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Claim</label>
                  <textarea
                    value={claimText}
                    onChange={(e) => setClaimText(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-snug resize-none focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400"
                    rows={3}
                    disabled={step === "creating"}
                  />
                  <p className="text-[11px] text-slate-400 mt-0.5">{claimText.length}/2000 characters</p>
                </div>

                {/* Pre-filled evidence */}
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1 block">Evidence (auto-filled)</label>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 flex items-center gap-2">
                    <img
                      src="https://www.google.com/s2/favicons?domain=nber.org&sz=16"
                      alt=""
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700 truncate">{MOCK_SELECTION.pageTitle}</p>
                      <p className="text-[11px] text-slate-400 font-mono truncate">{MOCK_SELECTION.pageUrl}</p>
                    </div>
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  </div>
                  <button className="text-xs text-sky-600 hover:text-sky-700 mt-1.5 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add another source
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleCreate}
                    disabled={step === "creating"}
                    className="flex-1 px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {step === "creating" ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Create &amp; Copy Link
                      </>
                    )}
                  </button>
                </div>
                {step === "creating" && (
                  <div className="text-center">
                    <p className="text-[11px] text-slate-400">Calling POST /api/arguments/quick...</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Content Script — Inline Previews
// ─────────────────────────────────────────────────────────────────────────────

function InlinePreviewDemo() {
  const [activePlatform, setActivePlatform] = useState<"reddit" | "twitter" | "hackernews">("reddit");
  const [previewEnabled, setPreviewEnabled] = useState(true);

  const link = MOCK_DETECTED_LINKS.find((l) => l.platform === activePlatform)!;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/12 to-purple-500/12 text-violet-600">
          <Eye className="w-4 h-4" />
        </div>
        <p className="font-semibold text-slate-900 text-lg">Inline Preview Injection</p>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-violet-500/10 to-purple-500/10 text-violet-700 border border-violet-500/20">Interactive</span>
      </div>
      <p className="text-sm text-slate-500">
        The content script detects Isonomia links on supported platforms and injects a rich preview card via Shadow DOM. Toggle the preview to see before/after.
      </p>

      {/* Platform tabs */}
      <div className="flex gap-2">
        {([
          { key: "reddit" as const, label: "Reddit", color: "orange" },
          { key: "twitter" as const, label: "Twitter / X", color: "sky" },
          { key: "hackernews" as const, label: "Hacker News", color: "amber" },
        ]).map((p) => (
          <button
            key={p.key}
            onClick={() => setActivePlatform(p.key)}
            className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              activePlatform === p.key
                ? `border-${p.color}-400 bg-${p.color}-50 text-${p.color}-700 ring-2 ring-${p.color}-200`
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setPreviewEnabled(!previewEnabled)}
          className={`relative w-10 h-5 rounded-full transition-all ${previewEnabled ? "bg-emerald-500" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${previewEnabled ? "left-5" : "left-0.5"}`} />
        </button>
        <span className="text-sm text-slate-600">
          Inline previews {previewEnabled ? "enabled" : "disabled"}
        </span>
        <span className="text-[11px] text-slate-400 ml-1">(per-site toggle in extension options)</span>
      </div>

      {/* Platform simulation */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-md">
        {/* Platform header */}
        <div className={`px-4 py-2 border-b flex items-center gap-2 ${
          activePlatform === "reddit" ? "bg-orange-50 border-orange-200" :
          activePlatform === "twitter" ? "bg-sky-50 border-sky-200" :
          "bg-amber-50 border-amber-200"
        }`}>
          <span className={`text-xs font-bold ${
            activePlatform === "reddit" ? "text-orange-600" :
            activePlatform === "twitter" ? "text-sky-600" :
            "text-amber-700"
          }`}>
            {activePlatform === "reddit" ? "r/technology" : activePlatform === "twitter" ? "@epistemic_labs" : "Hacker News"}
          </span>
          <span className="text-[10px] text-slate-400">• simulated {activePlatform} comment</span>
        </div>

        <div className="p-4 space-y-3">
          {/* Simulated comment text */}
          {activePlatform === "reddit" && (
            <div className="text-sm text-slate-700 leading-relaxed">
              <p className="mb-2">I think this argument makes a strong case for regulation. Here&apos;s the full structured analysis:</p>
              <a href="#" className="text-sky-600 hover:underline text-sm" onClick={(e) => e.preventDefault()}>
                {link.url}
              </a>
            </div>
          )}
          {activePlatform === "twitter" && (
            <div className="text-sm text-slate-700 leading-relaxed">
              <p className="mb-1">New evidence-backed argument on carbon pricing effectiveness 📊</p>
              <p className="mb-2">
                <a href="#" className="text-sky-600 hover:underline" onClick={(e) => e.preventDefault()}>
                  {link.url}
                </a>
              </p>
              <p className="text-slate-500 text-xs">1:42 PM · Apr 13, 2026</p>
            </div>
          )}
          {activePlatform === "hackernews" && (
            <div className="text-sm text-slate-700 leading-relaxed font-mono">
              <p className="mb-2 text-xs">
                <span className="text-slate-400">user123 2 hours ago</span>
              </p>
              <p className="mb-2">Related structured analysis: <a href="#" className="text-sky-600 hover:underline" onClick={(e) => e.preventDefault()}>{link.url}</a></p>
            </div>
          )}

          {/* Injected preview card */}
          {previewEnabled && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="rounded-lg border border-sky-200 bg-gradient-to-br from-sky-50/80 to-blue-50/40 p-4 shadow-sm relative">
                {/* Shadow DOM badge */}
                <div className="absolute -top-2.5 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[9px] font-mono text-slate-400 shadow-sm">
                  <Shield className="w-2.5 h-2.5" /> Shadow DOM
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">
                        {link.scheme ? "Argument" : "Claim"}
                      </span>
                      {link.confidence !== null && (
                        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                          {link.confidence}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-800 leading-snug mb-1.5">
                      {link.claim}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      {link.evidenceCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {link.evidenceCount} sources
                        </span>
                      )}
                      {link.scheme && (
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {link.scheme}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {link.author}
                      </span>
                    </div>
                  </div>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); toast.info("Opens permalink page"); }}
                    className="text-sky-500 hover:text-sky-600 shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <div className="mt-3 pt-2 border-t border-sky-200/60 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">isonomia.app</span>
                  <span className="text-[10px] text-slate-400">Powered by Isonomia extension</span>
                </div>
              </div>
            </div>
          )}

          {!previewEnabled && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-xs text-slate-400">Preview disabled — link renders as plain text</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Extension Popup Quick Builder
// ─────────────────────────────────────────────────────────────────────────────

function PopupBuilderDemo() {
  const [popupView, setPopupView] = useState<"create" | "search" | "recent">("create");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const { copiedKey, copy } = useCopy();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/12 to-orange-500/12 text-amber-600">
          <Puzzle className="w-4 h-4" />
        </div>
        <p className="font-semibold text-slate-900 text-lg">Extension Popup</p>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-700 border border-amber-500/20">Interactive</span>
      </div>
      <p className="text-sm text-slate-500">
        Clicking the Isonomia extension icon opens a compact popup with three views: create a new argument, search existing arguments, or re-share recent ones.
      </p>

      {/* Login toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsLoggedIn(!isLoggedIn)}
          className={`relative w-10 h-5 rounded-full transition-all ${isLoggedIn ? "bg-emerald-500" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isLoggedIn ? "left-5" : "left-0.5"}`} />
        </button>
        <span className="text-sm text-slate-600">
          {isLoggedIn ? "Logged in" : "Not logged in"}
        </span>
      </div>

      {/* Popup simulation */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-lg max-w-sm mx-auto">
        {/* Popup chrome */}
        <div className="bg-gradient-to-r from-sky-500/8 to-blue-500/8 border-b border-slate-200 px-4 py-2.5 flex items-center gap-2">
          <Puzzle className="w-4 h-4 text-sky-600" />
          <p className="text-sm font-semibold text-slate-800">Isonomia</p>
          <span className="ml-auto text-[10px] text-slate-400 font-mono">400×600</span>
        </div>

        {!isLoggedIn ? (
          /* Logged out state */
          <div className="p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto">
              <Lock className="w-5 h-5 text-slate-400" />
            </div>
            <p className="font-medium text-slate-700">Sign in to Isonomia</p>
            <p className="text-xs text-slate-500">Connect your account to create and share arguments from any page.</p>
            <button
              onClick={() => { setIsLoggedIn(true); toast.info("OAuth2 flow → chrome.identity.launchWebAuthFlow"); }}
              className="px-4 py-2 rounded-lg bg-sky-500 text-white text-sm font-medium hover:bg-sky-600 transition-all"
            >
              Sign in with Isonomia
            </button>
          </div>
        ) : (
          <>
            {/* Popup tabs */}
            <div className="flex border-b border-slate-200">
              {([
                { key: "create" as const, label: "Create", icon: Plus },
                { key: "search" as const, label: "Search", icon: Search },
                { key: "recent" as const, label: "Recent", icon: FolderOpen },
              ]).map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setPopupView(tab.key)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all ${
                      popupView === tab.key
                        ? "text-sky-700 border-b-2 border-sky-500 bg-sky-50/50"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="p-3">
              {popupView === "create" && (
                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Claim</label>
                    <textarea
                      placeholder="What are you claiming?"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs leading-snug resize-none focus:outline-none focus:ring-2 focus:ring-sky-300"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 mb-0.5 block">Evidence URL</label>
                    <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 px-2.5 py-1.5">
                      <Globe className="w-3 h-3 text-emerald-500" />
                      <span className="text-xs text-slate-600 truncate">https://current-page-url.com (auto)</span>
                      <Check className="w-3 h-3 text-emerald-500 shrink-0 ml-auto" />
                    </div>
                  </div>
                  <button className="w-full px-3 py-2 rounded-lg bg-sky-500 text-white text-xs font-medium hover:bg-sky-600 transition-all flex items-center justify-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Create &amp; Copy Link
                  </button>
                </div>
              )}

              {popupView === "search" && (
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Isonomia arguments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-300"
                    />
                  </div>
                  {searchQuery.length > 0 ? (
                    <div className="space-y-1.5">
                      {MOCK_RECENT_ARGUMENTS.filter((a) =>
                        a.claim.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map((arg) => (
                        <button
                          key={arg.id}
                          onClick={() => copy(`${BASE_URL}/a/${arg.slug}`, `search-${arg.id}`)}
                          className="w-full text-left rounded-lg border border-slate-200 hover:border-sky-200 hover:bg-sky-50/50 px-3 py-2 transition-all"
                        >
                          <p className="text-xs font-medium text-slate-700 truncate">{arg.claim}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-[10px] text-sky-600 font-mono">/a/{arg.slug}</code>
                            <span className="text-[10px] text-slate-400">• click to copy link</span>
                          </div>
                        </button>
                      ))}
                      {MOCK_RECENT_ARGUMENTS.filter((a) =>
                        a.claim.toLowerCase().includes(searchQuery.toLowerCase())
                      ).length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-3">No matches found</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-3">Type to search your arguments</p>
                  )}
                </div>
              )}

              {popupView === "recent" && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-slate-400 mb-1">Recent arguments</p>
                  {MOCK_RECENT_ARGUMENTS.map((arg) => (
                    <div key={arg.id} className="flex items-center gap-2 rounded-lg border border-slate-200 hover:border-sky-200 hover:bg-sky-50/50 px-3 py-2 transition-all group">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 truncate">{arg.claim}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{arg.created}</p>
                      </div>
                      <button
                        onClick={() => copy(`${BASE_URL}/a/${arg.slug}`, `recent-${arg.id}`)}
                        className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-700 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1"
                      >
                        {copiedKey === `recent-${arg.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copiedKey === `recent-${arg.id}` ? "Copied" : "Copy"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE DEMO: Manifest & Architecture
// ─────────────────────────────────────────────────────────────────────────────

function ManifestDemo() {
  const { copiedKey, copy } = useCopy();

  const manifestJson = JSON.stringify({
    manifest_version: 3,
    name: "Isonomia — Structured Arguments Everywhere",
    version: "1.0.0",
    description: "Create evidence-backed arguments from any webpage. Enhances Isonomia links with rich previews.",
    permissions: ["activeTab", "contextMenus", "storage", "identity"],
    host_permissions: ["*://isonomia.app/*"],
    background: {
      service_worker: "dist/background/service-worker.js",
      type: "module",
    },
    action: {
      default_popup: "src/popup/popup.html",
      default_icon: {
        "16": "icons/icon-16.png",
        "48": "icons/icon-48.png",
        "128": "icons/icon-128.png",
      },
    },
    content_scripts: [
      {
        matches: [
          "*://www.reddit.com/*",
          "*://old.reddit.com/*",
          "*://twitter.com/*",
          "*://x.com/*",
          "*://news.ycombinator.com/*",
        ],
        js: ["dist/content/link-detector.js", "dist/content/inline-renderer.js"],
        run_at: "document_idle",
      },
    ],
    options_page: "src/options/options.html",
    oauth2: {
      client_id: "ISONOMIA_CHROME_EXTENSION_CLIENT_ID",
      scopes: ["profile", "arguments:write", "arguments:read"],
    },
    icons: {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png",
    },
  }, null, 2);

  const serviceWorkerCode = `// extensions/chrome/src/background/service-worker.ts

import { IsonomiaAPI } from "../shared/api-client";

// Register context menu on extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "create-isonomia-argument",
    title: "Create Isonomia Argument",
    contexts: ["selection"],
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "create-isonomia-argument") return;

  const selectedText = info.selectionText || "";
  const pageUrl = tab?.url || "";
  const pageTitle = tab?.title || "";

  // Send to popup for editing before submission
  await chrome.action.openPopup();
  chrome.runtime.sendMessage({
    type: "PREFILL_ARGUMENT",
    payload: { claim: selectedText, evidenceUrl: pageUrl, pageTitle },
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "FETCH_ARGUMENT_META") {
    IsonomiaAPI.getArgumentMeta(message.identifier)
      .then((meta) => sendResponse({ success: true, data: meta }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async sendResponse
  }
});`;

  const apiClientCode = `// extensions/chrome/src/shared/api-client.ts

import { getAuthToken, refreshToken } from "./auth";

const API_BASE = "https://isonomia.app/api";

async function fetchWithAuth(path: string, options: RequestInit = {}) {
  let token = await getAuthToken();
  if (!token) throw new Error("Not authenticated");

  let res = await fetch(\`\${API_BASE}\${path}\`, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": \`Bearer \${token}\`,
      "Content-Type": "application/json",
    },
  });

  // Refresh token on 401
  if (res.status === 401) {
    token = await refreshToken();
    if (!token) throw new Error("Session expired");
    res = await fetch(\`\${API_BASE}\${path}\`, {
      ...options,
      headers: {
        ...options.headers,
        "Authorization": \`Bearer \${token}\`,
        "Content-Type": "application/json",
      },
    });
  }

  if (!res.ok) throw new Error(\`API error: \${res.status}\`);
  return res.json();
}

const IsonomiaAPI = {
  createQuickArgument: (data: {
    claim: string;
    evidence: { url: string }[];
    reasoning?: string;
  }) => fetchWithAuth("/arguments/quick", {
    method: "POST",
    body: JSON.stringify(data),
  }),

  unfurlUrl: (url: string) =>
    fetchWithAuth(\`/unfurl?url=\${encodeURIComponent(url)}\`),

  getArgumentMeta: (identifier: string) =>
    fetchWithAuth(\`/arguments/\${identifier}/meta\`),

  searchArguments: (query: string) =>
    fetchWithAuth(\`/arguments/search?q=\${encodeURIComponent(query)}\`),

  getRecentArguments: (limit = 5) =>
    fetchWithAuth(\`/arguments/recent?limit=\${limit}\`),
};`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500/12 to-blue-500/12 text-sky-600">
          <FileCode className="w-4 h-4" />
        </div>
        <p className="font-semibold text-slate-900 text-lg">Extension Architecture</p>
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-sky-500/10 to-blue-500/10 text-sky-700 border border-sky-500/20">Reference</span>
      </div>
      <p className="text-sm text-slate-500">
        Key files from the Chrome extension: manifest.json (Manifest V3), the background service worker, and the authenticated API client.
      </p>

      <Tabs defaultValue="manifest" className="space-y-3">
        <TabsList className="bg-white border shadow-sm">
          <TabsTrigger value="manifest" className="gap-1.5 text-xs">
            <Braces className="w-3.5 h-3.5" />
            manifest.json
          </TabsTrigger>
          <TabsTrigger value="worker" className="gap-1.5 text-xs">
            <Terminal className="w-3.5 h-3.5" />
            service-worker.ts
          </TabsTrigger>
          <TabsTrigger value="api" className="gap-1.5 text-xs">
            <Globe className="w-3.5 h-3.5" />
            api-client.ts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manifest">
          <div className="rounded-lg border border-slate-200 bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
              <span className="text-xs font-mono text-slate-400">extensions/chrome/manifest.json</span>
              <button
                onClick={() => copy(manifestJson, "manifest")}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-all"
              >
                {copiedKey === "manifest" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedKey === "manifest" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="p-4 text-xs text-emerald-400 font-mono overflow-x-auto max-h-80 overflow-y-auto leading-relaxed">
              {manifestJson}
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="worker">
          <div className="rounded-lg border border-slate-200 bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
              <span className="text-xs font-mono text-slate-400">extensions/chrome/src/background/service-worker.ts</span>
              <button
                onClick={() => copy(serviceWorkerCode, "worker")}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-all"
              >
                {copiedKey === "worker" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedKey === "worker" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="p-4 text-xs text-sky-400 font-mono overflow-x-auto max-h-80 overflow-y-auto leading-relaxed whitespace-pre-wrap">
              {serviceWorkerCode}
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="api">
          <div className="rounded-lg border border-slate-200 bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
              <span className="text-xs font-mono text-slate-400">extensions/chrome/src/shared/api-client.ts</span>
              <button
                onClick={() => copy(apiClientCode, "api")}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-all"
              >
                {copiedKey === "api" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedKey === "api" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="p-4 text-xs text-amber-400 font-mono overflow-x-auto max-h-80 overflow-y-auto leading-relaxed whitespace-pre-wrap">
              {apiClientCode}
            </pre>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function EmbeddableWidgetPhase3Page() {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <Toaster position="bottom-right" richColors closeButton />

        <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-sky-500/10 to-blue-500/10 text-sky-700 border border-sky-500/20 text-xs font-semibold">
                <Chrome className="w-3.5 h-3.5" />
                Phase 3
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 border border-amber-200/80 text-amber-600">
                Planning &amp; Architecture
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Distribution — Browser Extension
            </h1>
            <p className="text-base text-slate-600 max-w-3xl leading-relaxed">
              Enable argument creation from anywhere on the web. Right-click any text to create an Isonomia argument. The extension detects Isonomia links on Reddit, Twitter/X, and Hacker News and renders rich inline previews — turning every supported comment section into a structured argumentation surface.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: "Manifest V3 Chrome Extension", color: "bg-sky-100 text-sky-700" },
                { label: "Context menu creation", color: "bg-emerald-100 text-emerald-700" },
                { label: "Shadow DOM previews", color: "bg-violet-100 text-violet-700" },
                { label: "OAuth2 auth", color: "bg-amber-100 text-amber-700" },
                { label: "Firefox + Safari ports", color: "bg-orange-100 text-orange-700" },
              ].map((chip) => (
                <span key={chip.label} className={`text-xs font-medium px-2.5 py-1 rounded-full ${chip.color}`}>
                  {chip.label}
                </span>
              ))}
            </div>
          </div>

          {/* Success criteria */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 shrink-0">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <p className="font-semibold text-emerald-800 text-sm">Success Criteria</p>
                <p className="text-sm text-emerald-700 mt-1 leading-relaxed">
                  A user can highlight text on any webpage, right-click, select &quot;Create Isonomia Argument,&quot; and have a link copied to their clipboard in under 15 seconds.
                </p>
              </div>
            </div>
          </div>

          {/* Funnel progress */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4">The distribution funnel — Phase 3 expands reach</p>
            <div className="flex items-stretch gap-1">
              {[
                { step: "1", label: "OG image is the draw", sub: "Looks better than everything else in the thread", phase: "Phase 1", done: true },
                { step: "2", label: "Permalink is the invitation", sub: "Zero-friction, full argument, visible depth", phase: "Phase 1", done: true },
                { step: "3", label: "Quick Builder arms users", sub: "Turns them into distribution vectors", phase: "Phase 2", done: true },
                { step: "4", label: "Extension expands reach", sub: "Create from anywhere, detect everywhere", phase: "Phase 3", done: false, active: true },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-lg p-3 border transition-all ${
                    item.active
                      ? "border-sky-300 bg-sky-50 ring-2 ring-sky-200"
                      : item.done
                      ? "border-slate-200 bg-slate-50"
                      : "border-slate-100 bg-white opacity-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                      item.active ? "bg-sky-500 text-white" : item.done ? "bg-slate-300 text-white" : "bg-slate-100 text-slate-400"
                    }`}>{item.step}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                      item.active ? "bg-sky-100 text-sky-700" : item.done ? "bg-slate-100 text-slate-500" : "bg-white text-slate-300 border"
                    }`}>{item.phase}</span>
                  </div>
                  <p className={`text-xs font-semibold leading-tight ${item.active ? "text-sky-800" : item.done ? "text-slate-700" : "text-slate-400"}`}>{item.label}</p>
                  <p className={`text-[11px] mt-0.5 leading-snug ${item.active ? "text-sky-600" : item.done ? "text-slate-400" : "text-slate-300"}`}>{item.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Deliverables grid */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-800">Phase 3 Deliverables</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  6 steps. A full browser extension with context menus, content scripts, popup builder, and cross-browser ports.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PHASE3_FEATURES.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
          </section>

          {/* Interactive demos */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Interactive Demos</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Walk through the context menu creation flow, see inline previews on simulated platforms, explore the extension popup, and review the extension architecture.
              </p>
            </div>
            <Tabs defaultValue="context" className="space-y-4">
              <TabsList className="bg-white border shadow-sm">
                <TabsTrigger value="context" className="gap-1.5">
                  <MousePointerClick className="w-4 h-4" />
                  Context Menu
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1.5">
                  <Eye className="w-4 h-4" />
                  Inline Previews
                </TabsTrigger>
                <TabsTrigger value="popup" className="gap-1.5">
                  <Puzzle className="w-4 h-4" />
                  Popup Builder
                </TabsTrigger>
                <TabsTrigger value="architecture" className="gap-1.5">
                  <FileCode className="w-4 h-4" />
                  Architecture
                </TabsTrigger>
              </TabsList>

              <TabsContent value="context">
                <ContextMenuDemo />
              </TabsContent>

              <TabsContent value="preview">
                <InlinePreviewDemo />
              </TabsContent>

              <TabsContent value="popup">
                <PopupBuilderDemo />
              </TabsContent>

              <TabsContent value="architecture">
                <ManifestDemo />
              </TabsContent>
            </Tabs>
          </section>

          {/* Architecture summary */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">How It&apos;s Built</h2>
              <p className="text-sm text-slate-500 mt-0.5">Four layers working together in the browser extension.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-sky-500/15 text-sky-600 text-[11px] font-bold flex items-center justify-center">1</span>
                  <Terminal className="w-3.5 h-3.5 text-sky-600" />
                  <p className="text-sm font-semibold text-slate-800">Service Worker</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-sky-700">service-worker.ts</div>
                </div>
                <p className="text-xs text-slate-500">
                  Registers context menus, routes messages between content scripts and popup, manages extension lifecycle events.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 text-[11px] font-bold flex items-center justify-center">2</span>
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-sm font-semibold text-slate-800">Content Scripts</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-emerald-700">link-detector.ts</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-teal-700">inline-renderer.ts</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-cyan-700">selection-handler.ts</div>
                </div>
                <p className="text-xs text-slate-500">
                  Detect Isonomia URLs on supported sites, render previews via Shadow DOM, handle text selection for argument creation.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-600 text-[11px] font-bold flex items-center justify-center">3</span>
                  <Puzzle className="w-3.5 h-3.5 text-amber-600" />
                  <p className="text-sm font-semibold text-slate-800">Popup UI</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-amber-700">popup.tsx</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-orange-700">popup.css</div>
                </div>
                <p className="text-xs text-slate-500">
                  Compact Quick Argument Builder with create, search, and recent views. Pre-fills current page URL as evidence.
                </p>
              </div>

              <div className="sidebarv2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-violet-500/15 text-violet-600 text-[11px] font-bold flex items-center justify-center">4</span>
                  <Lock className="w-3.5 h-3.5 text-violet-600" />
                  <p className="text-sm font-semibold text-slate-800">Auth &amp; API</p>
                </div>
                <div className="space-y-1.5 mb-3">
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-violet-700">auth.ts</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-purple-700">api-client.ts</div>
                  <div className="rounded-lg bg-white/60 border border-slate-900/10 p-2 font-mono text-xs text-fuchsia-700">types.ts</div>
                </div>
                <p className="text-xs text-slate-500">
                  OAuth2 flow via <code className="bg-white/50 px-1 rounded">chrome.identity</code>, token in <code className="bg-white/50 px-1 rounded">chrome.storage.local</code>, auto-refresh on 401.
                </p>
              </div>
            </div>
          </section>

          {/* Cross-browser support */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Cross-Browser Support</h2>
              <p className="text-sm text-slate-500 mt-0.5">Chrome first, then Firefox and Safari ports using the shared WebExtension API.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  browser: "Chrome",
                  icon: Chrome,
                  color: "text-sky-600",
                  bgColor: "from-sky-500/10 to-blue-500/15",
                  status: "Primary target",
                  statusColor: "bg-sky-100 text-sky-700 border-sky-200",
                  notes: [
                    "Manifest V3 — required since Nov 2024",
                    "Build with webpack, separate entry bundles",
                    "OAuth2 via chrome.identity API",
                    "Submit to Chrome Web Store",
                  ],
                },
                {
                  browser: "Firefox",
                  icon: Globe,
                  color: "text-orange-600",
                  bgColor: "from-orange-500/10 to-red-500/15",
                  status: "Port — Step 3.5",
                  statusColor: "bg-orange-100 text-orange-700 border-orange-200",
                  notes: [
                    "background.scripts vs background.service_worker",
                    "webextension-polyfill for browser namespace",
                    "Test on Firefox Developer Edition",
                    "Submit to Firefox Add-ons",
                  ],
                },
                {
                  browser: "Safari",
                  icon: Smartphone,
                  color: "text-blue-600",
                  bgColor: "from-blue-500/10 to-cyan-500/15",
                  status: "Port — Step 3.6",
                  statusColor: "bg-blue-100 text-blue-700 border-blue-200",
                  notes: [
                    "Same WebExtension API",
                    "Xcode project wrapper required",
                    "xcrun safari-web-extension-converter",
                    "App Store (macOS + iOS)",
                  ],
                },
              ].map((b) => {
                const BrowserIcon = b.icon;
                return (
                  <div key={b.browser} className="cardv2">
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-xl bg-gradient-to-br ${b.bgColor} ${b.color}`}>
                          <BrowserIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{b.browser}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${b.statusColor}`}>{b.status}</span>
                        </div>
                      </div>
                      <ul className="space-y-1.5">
                        {b.notes.map((note, i) => (
                          <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-600 leading-snug">
                            <div className="w-1 h-1 rounded-full bg-sky-400/70 flex-shrink-0 mt-[5px]" />
                            {note}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Files to create */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Files to Create</h2>
              <p className="text-sm text-slate-500 mt-0.5">All new — a self-contained extension project in extensions/chrome/.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y">
              {PHASE3_FILES.map((file, i) => (
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

          {/* Completion checklist */}
          <section>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-800">Completion Checklist</h2>
              <p className="text-sm text-slate-500 mt-0.5">All criteria from the roadmap for Phase 3 sign-off.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y">
              {[
                "Chrome extension installable from local build",
                "Right-click → \"Create Isonomia Argument\" works with text selection",
                "Popup quick builder creates argument and copies link",
                "Content script detects and enhances Isonomia links on Reddit",
                "Content script detects and enhances Isonomia links on Twitter/X",
                "Extension options page allows account connection and per-site toggles",
                "Firefox extension published",
                "Safari extension published",
                "Chrome Web Store submission",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-4 h-4 rounded border-2 border-slate-300 shrink-0" />
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <footer className="py-6 border-t border-slate-900/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-500">Embeddable Argument Widget — Phase 3</span>
            <div className="flex items-center gap-3">
              <a href="/test/embeddable-widget" className="text-indigo-500 hover:underline">← Phase 1 demo</a>
              <span className="text-slate-300">·</span>
              <a href="/test/embeddable-widget-phase2" className="text-indigo-500 hover:underline">← Phase 2 demo</a>
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
