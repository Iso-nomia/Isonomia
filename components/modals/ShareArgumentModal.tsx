// components/modals/ShareArgumentModal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Share2,
  Loader2,
  Code,
  AlignLeft,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

interface ShareArgumentModalProps {
  argumentId: string;
  claimText: string;
  confidence?: number | null;
  schemeName?: string | null;
  evidenceCount?: number;
  authorName?: string | null;
}

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success("Copied!");
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };
  return { copiedKey, copy };
}

export function ShareArgumentModal({
  argumentId,
  claimText,
  confidence,
  schemeName,
  evidenceCount = 0,
  authorName,
}: ShareArgumentModalProps) {
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { copiedKey, copy } = useCopy();

  useEffect(() => {
    fetch(`/api/arguments/${argumentId}/permalink`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.data?.shortCode) {
          setShortCode(data.data.shortCode);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [argumentId]);

  const permalink = shortCode ? `${BASE_URL}/a/${shortCode}` : null;
  const embedUrl = shortCode
    ? `${BASE_URL}/embed/argument/${shortCode}`
    : null;
  const ogImage = shortCode
    ? `${BASE_URL}/api/og/argument/${shortCode}`
    : null;

  const truncated =
    claimText.length > 120 ? claimText.slice(0, 120) + "…" : claimText;

  const iframeCode = embedUrl
    ? `<iframe\n  src="${embedUrl}?theme=auto"\n  width="600"\n  height="400"\n  frameborder="0"\n  allow="clipboard-read; clipboard-write"\n  loading="lazy"\n  title="Isonomia Argument"\n></iframe>`
    : "";

  const markdownLines = [
    `**Claim:** ${claimText}`,
    "",
    evidenceCount > 0
      ? `**Evidence:** ${evidenceCount} source${evidenceCount !== 1 ? "s" : ""} cited`
      : null,
    confidence != null
      ? `**Confidence:** ${Math.round(confidence)}%`
      : null,
    schemeName ? `**Scheme:** ${schemeName}` : null,
    "",
    permalink ? `[View full argument on Isonomia](${permalink})` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const plainLines = [
    `CLAIM: ${claimText}`,
    "",
    evidenceCount > 0
      ? `Evidence: ${evidenceCount} source${evidenceCount !== 1 ? "s" : ""} cited`
      : null,
    confidence != null ? `Confidence: ${Math.round(confidence)}%` : null,
    schemeName ? `Scheme: ${schemeName}` : null,
    "",
    permalink ? `Link: ${permalink}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const redditUrl = permalink
    ? `https://www.reddit.com/submit?url=${encodeURIComponent(permalink)}&title=${encodeURIComponent(truncated)}`
    : "#";
  const twitterUrl = permalink
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(truncated)}&url=${encodeURIComponent(permalink)}`
    : "#";
  const linkedinUrl = permalink
    ? `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(permalink)}&title=${encodeURIComponent(truncated)}`
    : "#";

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Share2 className="w-4 h-4" />
          Share Argument
        </DialogTitle>
      </DialogHeader>

      {/* OG image preview */}
      {ogImage && (
        <div className="rounded-lg overflow-hidden border border-slate-200 aspect-[1200/630] bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ogImage}
            alt="Argument social preview"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Generating link…
        </div>
      )}

      {!loading && !shortCode && (
        <p className="text-sm text-slate-500 text-center py-4">
          Could not generate share link. Please try again.
        </p>
      )}

      {!loading && permalink && (
        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="link" className="gap-1 text-xs">
              <ExternalLink className="w-3 h-3" />
              Link
            </TabsTrigger>
            <TabsTrigger value="embed" className="gap-1 text-xs">
              <Code className="w-3 h-3" />
              Embed
            </TabsTrigger>
            <TabsTrigger value="markdown" className="gap-1 text-xs">
              <AlignLeft className="w-3 h-3" />
              Markdown
            </TabsTrigger>
            <TabsTrigger value="text" className="gap-1 text-xs">
              <FileText className="w-3 h-3" />
              Plain
            </TabsTrigger>
          </TabsList>

          {/* ── Link tab ── */}
          <TabsContent value="link" className="space-y-3 pt-1">
            <div className="flex gap-2">
              <Input
                readOnly
                value={permalink}
                className="font-mono text-sm"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copy(permalink, "link")}
                title="Copy link"
              >
                {copiedKey === "link" ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <a
                href={redditUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="w-3 h-3" />
                  Reddit
                </Button>
              </a>
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="w-3 h-3" />
                  Twitter / X
                </Button>
              </a>
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ExternalLink className="w-3 h-3" />
                  LinkedIn
                </Button>
              </a>
            </div>
          </TabsContent>

          {/* ── Embed tab ── */}
          <TabsContent value="embed" className="space-y-2 pt-1">
            <textarea
              readOnly
              value={iframeCode}
              rows={5}
              className="w-full font-mono text-xs p-3 rounded-md border border-slate-200 bg-slate-50 resize-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(iframeCode, "embed")}
              className="gap-1.5"
            >
              {copiedKey === "embed" ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              Copy Embed Code
            </Button>
          </TabsContent>

          {/* ── Markdown tab ── */}
          <TabsContent value="markdown" className="space-y-2 pt-1">
            <textarea
              readOnly
              value={markdownLines}
              rows={7}
              className="w-full font-mono text-xs p-3 rounded-md border border-slate-200 bg-slate-50 resize-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(markdownLines, "markdown")}
              className="gap-1.5"
            >
              {copiedKey === "markdown" ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              Copy Markdown
            </Button>
          </TabsContent>

          {/* ── Plain text tab ── */}
          <TabsContent value="text" className="space-y-2 pt-1">
            <textarea
              readOnly
              value={plainLines}
              rows={7}
              className="w-full font-mono text-xs p-3 rounded-md border border-slate-200 bg-slate-50 resize-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(plainLines, "text")}
              className="gap-1.5"
            >
              {copiedKey === "text" ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              Copy Plain Text
            </Button>
          </TabsContent>
        </Tabs>
      )}

      <DialogClose asChild>
        <Button variant="outline" className="w-full mt-2">
          Close
        </Button>
      </DialogClose>
    </DialogContent>
  );
}

export default ShareArgumentModal;
