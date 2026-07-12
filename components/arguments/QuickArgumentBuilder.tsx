// components/arguments/QuickArgumentBuilder.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  Globe,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvidenceItem {
  id: string;
  url: string;
  title: string | null;
  favicon: string | null;
  unfurling: boolean;
  quote: string;
}

interface QuickArgResult {
  argument: { id: string; text: string };
  claim: { id: string; text: string; moid: string };
  permalink: { shortCode: string; slug?: string; url: string };
  embedCodes: {
    link: string;
    iframe: string;
    markdown: string;
    plainText: string;
  };
}

function makeEvidenceItem(): EvidenceItem {
  return {
    id: Math.random().toString(36).slice(2),
    url: "",
    title: null,
    favicon: null,
    unfurling: false,
    quote: "",
  };
}

// ─── URL unfurl hook ──────────────────────────────────────────────────────────

function useUnfurl() {
  const cache = useRef<Record<string, { title: string | null; favicon: string | null }>>({});

  const unfurl = useCallback(async (url: string) => {
    if (cache.current[url]) return cache.current[url];
    try {
      const res = await fetch(
        `/api/unfurl?url=${encodeURIComponent(url)}`
      );
      if (!res.ok) return { title: null, favicon: null };
      const data = await res.json();
      const result = {
        title: data.data?.title ?? null,
        favicon: data.data?.favicon ?? null,
      };
      cache.current[url] = result;
      return result;
    } catch {
      return { title: null, favicon: null };
    }
  }, []);

  return unfurl;
}

// ─── Evidence input row ───────────────────────────────────────────────────────

function EvidenceRow({
  item,
  onChange,
  onRemove,
  onUnfurl,
}: {
  item: EvidenceItem;
  onChange: (updated: Partial<EvidenceItem>) => void;
  onRemove: () => void;
  onUnfurl: (url: string) => Promise<{ title: string | null; favicon: string | null }>;
}) {
  const handleUrlBlur = async () => {
    if (!item.url || !/^https?:\/\//.test(item.url)) return;
    onChange({ unfurling: true });
    const meta = await onUnfurl(item.url);
    onChange({
      unfurling: false,
      title: meta.title ?? item.title,
      favicon: meta.favicon,
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2 items-center">
        {item.favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.favicon} alt="" className="w-4 h-4 flex-shrink-0" />
        ) : (
          <Globe className="w-4 h-4 flex-shrink-0 text-slate-400" />
        )}
        <Input
          type="url"
          placeholder="https://example.com/article"
          value={item.url}
          onChange={(e) => onChange({ url: e.target.value, title: null, favicon: null })}
          onBlur={handleUrlBlur}
          className="text-sm"
        />
        {item.unfurling && (
          <Loader2 className="w-4 h-4 animate-spin text-slate-400 flex-shrink-0" />
        )}
        <button
          type="button"
          onClick={onRemove}
          className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
          title="Remove source"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {item.title && (
        <p className="text-xs text-slate-500 pl-6 truncate">{item.title}</p>
      )}
      <Input
        type="text"
        placeholder="Optional: paste a relevant quote from this source"
        value={item.quote}
        onChange={(e) => onChange({ quote: e.target.value })}
        className="text-xs text-slate-600 pl-6"
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface QuickArgumentBuilderProps {
  /** Pre-fill the claim field (e.g. from browser extension) */
  initialClaim?: string;
  /** Pre-fill the first evidence URL (e.g. from browser extension) */
  initialUrl?: string;
}

export function QuickArgumentBuilder({
  initialClaim = "",
  initialUrl = "",
}: QuickArgumentBuilderProps) {
  const [claim, setClaim] = useState(initialClaim);
  const [reasoning, setReasoning] = useState("");
  const [showReasoning, setShowReasoning] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceItem[]>(() => {
    const first = makeEvidenceItem();
    if (initialUrl) first.url = initialUrl;
    return [first];
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuickArgResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const unfurl = useUnfurl();

  // ── Evidence helpers ─────────────────────────────────────────────────────
  const updateEvidence = (id: string, patch: Partial<EvidenceItem>) => {
    setEvidence((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };
  const removeEvidence = (id: string) => {
    setEvidence((prev) => prev.filter((item) => item.id !== id));
  };
  const addEvidence = () => {
    setEvidence((prev) => [...prev, makeEvidenceItem()]);
  };

  // ── Copy helper ───────────────────────────────────────────────────────────
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (
    action: "link" | "embed" | "share-reddit" | "share-twitter"
  ) => {
    if (!claim.trim()) {
      toast.error("Please enter a claim");
      return;
    }

    setSubmitting(true);
    try {
      const validEvidence = evidence
        .filter((e) => e.url.trim() && /^https?:\/\//.test(e.url))
        .map((e) => ({
          url: e.url.trim(),
          title: e.title ?? undefined,
          quote: e.quote.trim() || undefined,
        }));

      const res = await fetch("/api/arguments/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim: claim.trim(),
          evidence: validEvidence,
          reasoning: reasoning.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to create argument");
      }

      setResult(data);
      toast.success("Argument created!");

      if (action === "link") {
        await copy(data.embedCodes.link, "link");
      } else if (action === "embed") {
        await copy(data.embedCodes.iframe, "embed");
      } else if (action === "share-reddit") {
        const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(data.embedCodes.link)}&title=${encodeURIComponent(claim.slice(0, 300))}`;
        window.open(redditUrl, "_blank", "noopener,noreferrer");
      } else if (action === "share-twitter") {
        const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(claim.slice(0, 200))}&url=${encodeURIComponent(data.embedCodes.link)}`;
        window.open(tweetUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success state ─────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-green-800">
            Argument created!
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={result.embedCodes.link}
              className="font-mono text-sm bg-white"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => copy(result.embedCodes.link, "link-success")}
              title="Copy link"
            >
              {copiedKey === "link-success" ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(result.embedCodes.iframe, "iframe-success")}
              className="gap-1.5"
            >
              {copiedKey === "iframe-success" ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              Copy Embed Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(result.embedCodes.markdown, "md-success")}
              className="gap-1.5"
            >
              {copiedKey === "md-success" ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              Copy Markdown
            </Button>
            <a
              href={result.embedCodes.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="w-3 h-3" />
                View
              </Button>
            </a>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setResult(null);
            setClaim("");
            setReasoning("");
            setEvidence([makeEvidenceItem()]);
          }}
        >
          Create another argument
        </Button>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Claim */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-800">
          What are you claiming?
          <span className="text-red-500 ml-0.5">*</span>
        </label>
        <textarea
          rows={3}
          placeholder="State your claim clearly and specifically…"
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          maxLength={2000}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
        />
        <p className="text-xs text-slate-400 text-right">
          {claim.length}/2000
        </p>
      </div>

      {/* Evidence */}
      <div className="space-y-2.5">
        <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <LinkIcon className="w-3.5 h-3.5" />
          Sources <span className="text-slate-400 font-normal">(optional)</span>
        </label>

        <div className="space-y-3">
          {evidence.map((item) => (
            <EvidenceRow
              key={item.id}
              item={item}
              onChange={(patch) => updateEvidence(item.id, patch)}
              onRemove={() => removeEvidence(item.id)}
              onUnfurl={unfurl}
            />
          ))}
        </div>

        {evidence.length < 10 && (
          <button
            type="button"
            onClick={addEvidence}
            className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add another source
          </button>
        )}
      </div>

      {/* Reasoning (collapsible) */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setShowReasoning((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
        >
          {showReasoning ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
          Add reasoning
          <span className="text-slate-400 font-normal">(optional)</span>
        </button>

        {showReasoning && (
          <textarea
            rows={3}
            placeholder="Why does your evidence support this claim?"
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            maxLength={5000}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
          />
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <div className="flex gap-2">
          <Button
            className="flex-1 gap-1.5"
            onClick={() => handleSubmit("link")}
            disabled={submitting || !claim.trim()}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : copiedKey === "link" ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            Create & Copy Link
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-1.5"
            onClick={() => handleSubmit("embed")}
            disabled={submitting || !claim.trim()}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : copiedKey === "embed" ? (
              <Check className="w-4 h-4" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            Copy Embed
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => handleSubmit("share-reddit")}
            disabled={submitting || !claim.trim()}
          >
            <ExternalLink className="w-3 h-3" />
            Share to Reddit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => handleSubmit("share-twitter")}
            disabled={submitting || !claim.trim()}
          >
            <ExternalLink className="w-3 h-3" />
            Share to Twitter
          </Button>
        </div>
      </div>
    </div>
  );
}

export default QuickArgumentBuilder;
