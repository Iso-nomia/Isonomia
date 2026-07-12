// components/modals/ShareClaimModal.tsx
"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Share2,
  Code,
  AlignLeft,
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
import {
  getClaimPermalinkUrl,
  generateClaimIframeCode,
} from "@/lib/citations/claimPermalinkService";

interface ShareClaimModalProps {
  moid: string;
  claimText: string;
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

export function ShareClaimModal({ moid, claimText }: ShareClaimModalProps) {
  const { copiedKey, copy } = useCopy();

  const permalink = getClaimPermalinkUrl(moid);
  const iframeCode = generateClaimIframeCode(moid, "auto", false);

  const truncated =
    claimText.length > 120 ? claimText.slice(0, 120) + "…" : claimText;

  const markdownText = [
    `**Claim:** ${claimText}`,
    "",
    `[View claim on Isonomia](${permalink})`,
  ].join("\n");

  const plainText = [`CLAIM: ${claimText}`, "", `Link: ${permalink}`].join(
    "\n"
  );

  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(permalink)}&title=${encodeURIComponent(truncated)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(truncated)}&url=${encodeURIComponent(permalink)}`;
  const linkedinUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(permalink)}&title=${encodeURIComponent(truncated)}`;

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Share2 className="w-4 h-4" />
          Share Claim
        </DialogTitle>
      </DialogHeader>

      <Tabs defaultValue="link" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="link" className="gap-1 text-xs">
            <ExternalLink className="w-3 h-3" />
            Link
          </TabsTrigger>
          <TabsTrigger value="embed" className="gap-1 text-xs">
            <Code className="w-3 h-3" />
            Embed
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-1 text-xs">
            <AlignLeft className="w-3 h-3" />
            Text
          </TabsTrigger>
        </TabsList>

        {/* ── Link tab ── */}
        <TabsContent value="link" className="space-y-3 pt-1">
          <div className="flex gap-2">
            <Input readOnly value={permalink} className="font-mono text-sm" />
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
            <a href={redditUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="w-3 h-3" />
                Reddit
              </Button>
            </a>
            <a href={twitterUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="w-3 h-3" />
                Twitter / X
              </Button>
            </a>
            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
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

        {/* ── Text tab ── */}
        <TabsContent value="text" className="space-y-2 pt-1">
          <textarea
            readOnly
            value={markdownText}
            rows={4}
            className="w-full font-mono text-xs p-3 rounded-md border border-slate-200 bg-slate-50 resize-none"
          />
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(markdownText, "markdown")}
              className="gap-1.5"
            >
              {copiedKey === "markdown" ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              Markdown
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(plainText, "text")}
              className="gap-1.5"
            >
              {copiedKey === "text" ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              Plain Text
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <DialogClose asChild>
        <Button variant="outline" className="w-full mt-2">
          Close
        </Button>
      </DialogClose>
    </DialogContent>
  );
}

export default ShareClaimModal;
