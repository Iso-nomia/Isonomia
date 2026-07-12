// ─────────────────────────────────────────────────────────────────────────────
// Extension popup — Quick Argument Builder
//
// Compact UI with three tabs: Create, Search, Recent.
// Built with Preact for fast popup load times.
// ─────────────────────────────────────────────────────────────────────────────

import { h, render } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import { IsonomiaAPI, getApiBase } from "../shared/api-client";
import { isLoggedIn, initiateLogin, getUser, clearAuth } from "../shared/auth";
import type {
  QuickArgumentResponse,
  ArgumentMeta,
  UnfurlResponse,
} from "../shared/types";

import "./popup.css";

// ─── SVG Icons (inline to avoid asset loading) ──────────────────────────────

const icons = {
  zap: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  clock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  plus: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  copy: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  code: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  external: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  lock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  x: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  globe: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
};

function Icon({ name, className }: { name: keyof typeof icons; className?: string }) {
  return h("span", {
    class: className,
    dangerouslySetInnerHTML: { __html: icons[name] },
    style: { display: "inline-flex", alignItems: "center" },
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = "create" | "search" | "recent";

interface EvidenceItem {
  url: string;
  title: string | null;
  favicon: string | null;
  loading: boolean;
}

interface PrefillData {
  claim: string;
  evidenceUrl: string;
  pageTitle: string;
  timestamp: number;
}

// ─── Create Tab ──────────────────────────────────────────────────────────────

function CreateTab() {
  const [claim, setClaim] = useState("");
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuickArgumentResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const claimRef = useRef<HTMLTextAreaElement>(null);

  // Check for prefill data from context menu
  useEffect(() => {
    chrome.storage.session.get("prefill").then((data) => {
      const prefill = data.prefill as PrefillData | undefined;
      if (!prefill) return;
      // Only use prefill data if it's recent (within 30 seconds)
      if (Date.now() - prefill.timestamp > 30_000) return;

      setClaim(prefill.claim);
      if (prefill.evidenceUrl && prefill.evidenceUrl.startsWith("http")) {
        setEvidence([
          {
            url: prefill.evidenceUrl,
            title: prefill.pageTitle || null,
            favicon: `https://www.google.com/s2/favicons?domain=${new URL(prefill.evidenceUrl).hostname}&sz=32`,
            loading: false,
          },
        ]);
      }
      // Clear prefill data after consuming
      chrome.storage.session.remove("prefill");
    });
  }, []);

  // Also pre-fill from the currently active tab
  useEffect(() => {
    if (evidence.length > 0) return; // Already have evidence from prefill
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      if (tab?.url && tab.url.startsWith("http")) {
        setEvidence([
          {
            url: tab.url,
            title: tab.title || null,
            favicon: tab.favIconUrl || `https://www.google.com/s2/favicons?domain=${new URL(tab.url).hostname}&sz=32`,
            loading: false,
          },
        ]);
      }
    });
  }, []);

  const addEvidence = async () => {
    const url = newUrl.trim();
    if (!url) return;
    try {
      new URL(url); // Validate URL
    } catch {
      setError("Invalid URL");
      return;
    }

    const item: EvidenceItem = {
      url,
      title: null,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`,
      loading: true,
    };
    setEvidence((prev) => [...prev, item]);
    setNewUrl("");

    // Auto-unfurl
    try {
      const res = await IsonomiaAPI.unfurlUrl(url);
      if (res.ok && res.data) {
        setEvidence((prev) =>
          prev.map((e) =>
            e.url === url
              ? { ...e, title: res.data.title, favicon: res.data.favicon || e.favicon, loading: false }
              : e
          )
        );
      } else {
        setEvidence((prev) =>
          prev.map((e) => (e.url === url ? { ...e, loading: false } : e))
        );
      }
    } catch {
      setEvidence((prev) =>
        prev.map((e) => (e.url === url ? { ...e, loading: false } : e))
      );
    }
  };

  const removeEvidence = (url: string) => {
    setEvidence((prev) => prev.filter((e) => e.url !== url));
  };

  const handleSubmit = async () => {
    if (!claim.trim()) {
      setError("Claim text is required");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await IsonomiaAPI.createQuickArgument({
        claim: claim.trim(),
        evidence: evidence.map((e) => ({
          url: e.url,
          title: e.title || undefined,
        })),
        isPublic: true,
      });
      setResult(res);
      // Auto-copy the permalink
      await navigator.clipboard.writeText(res.permalink.url);
      setCopied("link");
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create argument");
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const reset = () => {
    setClaim("");
    setEvidence([]);
    setResult(null);
    setError(null);
    claimRef.current?.focus();
  };

  // Success state
  if (result) {
    return h("div", { class: "popup-content" },
      h("div", { class: "success-state" },
        h("div", { class: "success-icon" }, h(Icon, { name: "check" })),
        h("div", { class: "success-title" }, "Argument created!"),
        h("div", { class: "success-subtitle" }, "Link copied to clipboard. Paste it in the conversation."),
        h("div", { class: "permalink-row" },
          h("code", null, result.permalink.url),
          h("button", {
            class: "copy-btn",
            onClick: () => copyToClipboard(result.permalink.url, "link"),
          }, copied === "link" ? "Copied!" : "Copy"),
        ),
        h("div", { class: "success-actions" },
          h("button", {
            class: "btn-secondary",
            onClick: () => copyToClipboard(result.embedCodes.iframe, "embed"),
          }, h(Icon, { name: "code" }), copied === "embed" ? "Copied!" : "Copy Embed"),
          h("button", {
            class: "btn-secondary",
            onClick: () => copyToClipboard(result.embedCodes.markdown, "md"),
          }, copied === "md" ? "Copied!" : "Copy Markdown"),
          h("button", {
            class: "btn-secondary",
            onClick: async () => {
              const base = await getApiBase();
              window.open(`${base}/a/${result.permalink.shortCode}`, "_blank");
            },
          }, h(Icon, { name: "external" }), "View"),
        ),
        h("button", { class: "reset-link", onClick: reset }, "Create another"),
      ),
    );
  }

  // Create form
  return h("div", { class: "popup-content" },
    // Claim
    h("div", { class: "field" },
      h("label", { class: "field-label" }, "Claim"),
      h("textarea", {
        ref: claimRef,
        class: "field-textarea",
        rows: 3,
        maxLength: 2000,
        placeholder: "What are you claiming?",
        value: claim,
        onInput: (e: Event) => setClaim((e.target as HTMLTextAreaElement).value),
        disabled: submitting,
      }),
      h("div", { class: "field-char-count" }, `${claim.length}/2000`),
    ),

    // Evidence
    h("div", { class: "field" },
      h("label", { class: "field-label" }, "Evidence"),
      ...evidence.map((item) =>
        h("div", { class: "evidence-row" },
          item.favicon
            ? h("img", { class: "favicon", src: item.favicon, alt: "", width: 14, height: 14 })
            : h(Icon, { name: "globe" }),
          h("span", { class: "title" }, item.title || new URL(item.url).hostname),
          item.loading
            ? h("span", { class: "spinner", style: { borderColor: "#94a3b8", borderTopColor: "transparent", width: "12px", height: "12px", borderWidth: "1.5px" } })
            : h("span", { class: "status-icon" }, h(Icon, { name: "check" })),
          h("button", {
            class: "remove-btn",
            onClick: () => removeEvidence(item.url),
            title: "Remove",
            disabled: submitting,
          }, h(Icon, { name: "x" })),
        ),
      ),
      h("div", { style: { display: "flex", gap: "4px", marginTop: "4px" } },
        h("input", {
          class: "field-input",
          type: "url",
          placeholder: "https://example.com/source",
          value: newUrl,
          onInput: (e: Event) => setNewUrl((e.target as HTMLInputElement).value),
          onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); addEvidence(); } },
          disabled: submitting,
          style: { flex: 1 },
        }),
        h("button", {
          class: "btn-secondary",
          onClick: addEvidence,
          disabled: submitting,
          style: { padding: "6px 8px" },
        }, h(Icon, { name: "plus" })),
      ),
    ),

    // Submit
    h("button", {
      class: "btn-primary",
      onClick: handleSubmit,
      disabled: submitting || !claim.trim(),
    },
      submitting
        ? h("span", null, h("span", { class: "spinner" }), " Creating...")
        : h("span", null, h(Icon, { name: "zap" }), " Create & Copy Link"),
    ),

    error && h("div", { class: "error-msg" }, error),
  );
}

// ─── Search Tab ──────────────────────────────────────────────────────────────

function SearchTab() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArgumentMeta[]>([]);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await IsonomiaAPI.searchArguments(q);
      if (res.ok) setResults(res.results);
    } catch {
      // Silently fail — search is best-effort
    } finally {
      setSearching(false);
    }
  };

  const handleInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const copyLink = async (arg: ArgumentMeta) => {
    const base = await getApiBase();
    const url = arg.permalink?.fullUrl || `${base}/a/${arg.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(arg.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return h("div", { class: "popup-content" },
    h("div", { class: "search-input-wrapper" },
      h(Icon, { name: "search" }),
      h("input", {
        class: "field-input",
        type: "text",
        placeholder: "Search Isonomia arguments...",
        value: query,
        onInput: (e: Event) => handleInput((e.target as HTMLInputElement).value),
      }),
    ),

    searching && h("div", { class: "empty-state" }, "Searching..."),

    !searching && query.length >= 2 && results.length === 0 &&
      h("div", { class: "empty-state" }, "No arguments found"),

    !searching && query.length < 2 &&
      h("div", { class: "empty-state" }, "Type at least 2 characters to search"),

    ...results.map((arg) => {
      const claimText = arg.conclusion?.text || arg.text;
      return h("div", {
        class: "search-result",
        onClick: () => copyLink(arg),
      },
        h("span", { class: "claim-text" }, claimText),
        h("span", { class: "copy-action" },
          copied === arg.id
            ? h(Icon, { name: "check" })
            : h(Icon, { name: "copy" }),
        ),
      );
    }),
  );
}

// ─── Recent Tab ──────────────────────────────────────────────────────────────

function RecentTab() {
  const [args, setArgs] = useState<ArgumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    IsonomiaAPI.getRecentArguments(10)
      .then((res) => {
        if (res.ok) setArgs(res.arguments);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const copyLink = async (arg: ArgumentMeta) => {
    const base = await getApiBase();
    const url = arg.permalink?.fullUrl || `${base}/a/${arg.id}`;
    await navigator.clipboard.writeText(url);
    setCopied(arg.id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) {
    return h("div", { class: "popup-content" },
      h("div", { class: "empty-state" }, "Loading recent arguments..."),
    );
  }

  if (args.length === 0) {
    return h("div", { class: "popup-content" },
      h("div", { class: "empty-state" }, "No arguments yet. Create your first one!"),
    );
  }

  return h("div", { class: "popup-content" },
    ...args.map((arg) => {
      const claimText = arg.conclusion?.text || arg.text;
      return h("div", {
        class: "recent-item",
        onClick: () => copyLink(arg),
      },
        h("span", { class: "claim-text" }, claimText),
        h("span", { class: "copy-action" },
          copied === arg.id
            ? h(Icon, { name: "check" })
            : h(Icon, { name: "copy" }),
        ),
      );
    }),
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null); // null = loading
  const [activeTab, setActiveTab] = useState<Tab>("create");
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    // Check auth state
    Promise.all([isLoggedIn(), getUser()]).then(([li, user]) => {
      setLoggedIn(li);
      setUserName(user?.displayName || user?.email || null);
    });

    // Listen for auth changes
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.isonomia_auth) {
        isLoggedIn().then(setLoggedIn);
        getUser().then((user) => setUserName(user?.displayName || user?.email || null));
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  // Check URL params for context menu source
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "contextmenu") {
      setActiveTab("create");
    }
  }, []);

  // Loading state
  if (loggedIn === null) {
    return h("div", null,
      h("div", { class: "popup-header" },
        h("div", { class: "popup-header-logo" }, "I"),
        h("div", { class: "popup-header-title" }, "Isonomia"),
      ),
      h("div", { class: "popup-content" },
        h("div", { class: "empty-state" }, "Loading..."),
      ),
    );
  }

  // Not logged in
  if (!loggedIn) {
    return h("div", null,
      h("div", { class: "popup-header" },
        h("div", { class: "popup-header-logo" }, "I"),
        h("div", { class: "popup-header-title" }, "Isonomia"),
      ),
      h("div", { class: "login-prompt" },
        h("div", { class: "login-icon" }, h(Icon, { name: "lock" })),
        h("div", { class: "login-title" }, "Sign in to Isonomia"),
        h("div", { class: "login-desc" }, "Connect your account to create and share arguments from any page."),
        h("button", {
          class: "btn-primary",
          onClick: () => initiateLogin(),
          style: { width: "auto", display: "inline-flex", padding: "9px 20px" },
        }, "Sign in with Isonomia"),
      ),
    );
  }

  // Logged in — full UI
  return h("div", null,
    // Header
    h("div", { class: "popup-header" },
      h("div", { class: "popup-header-logo" }, "I"),
      h("div", { class: "popup-header-title" }, "Isonomia"),
      userName && h("span", { class: "popup-header-user" }, userName),
    ),

    // Tabs
    h("div", { class: "popup-tabs" },
      h("button", {
        class: `popup-tab ${activeTab === "create" ? "active" : ""}`,
        onClick: () => setActiveTab("create"),
      }, h(Icon, { name: "plus" }), " Create"),
      h("button", {
        class: `popup-tab ${activeTab === "search" ? "active" : ""}`,
        onClick: () => setActiveTab("search"),
      }, h(Icon, { name: "search" }), " Search"),
      h("button", {
        class: `popup-tab ${activeTab === "recent" ? "active" : ""}`,
        onClick: () => setActiveTab("recent"),
      }, h(Icon, { name: "clock" }), " Recent"),
    ),

    // Tab content
    activeTab === "create" && h(CreateTab, null),
    activeTab === "search" && h(SearchTab, null),
    activeTab === "recent" && h(RecentTab, null),
  );
}

// ─── Mount ───────────────────────────────────────────────────────────────────

const root = document.getElementById("app");
if (root) {
  render(h(App, null), root);
}
