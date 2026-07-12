// lib/tiptap/extensions/proposition-node.tsx
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import React, { useEffect, useState } from "react";
import { Lightbulb, Image as ImageIcon, Link as LinkIcon } from "lucide-react";
import { LiveBadgeStrip } from "@/lib/thesis/LiveBadgeStrip";
import { useOpenInspector } from "@/lib/thesis/ThesisLiveContext";

// React component for rendering the proposition
function PropositionNodeView({ node }: NodeViewProps) {
  const { propositionId, propositionText, mediaUrl, authorName, citationCount } = node.attrs as {
    propositionId: string;
    propositionText: string;
    mediaUrl?: string;
    authorName?: string;
    citationCount?: number;
  };
  const openInspector = useOpenInspector();

  const [citations, setCitations] = useState<any[]>([]);
  const [loadingCitations, setLoadingCitations] = useState(false);

  // Fetch citations on mount and when citationCount changes
  useEffect(() => {
    if (citationCount && citationCount > 0 && propositionId) {
      setLoadingCitations(true);
      fetch(`/api/propositions/${propositionId}/citations`)
        .then(res => res.json())
        .then(data => {
          setCitations(data.citations || []);
        })
        .catch(err => {
          console.error("Failed to fetch citations:", err);
        })
        .finally(() => {
          setLoadingCitations(false);
        });
    }
  }, [propositionId, citationCount]);

  // Listen for citation changes and refetch
  useEffect(() => {
    const handleCitationChange = (event: any) => {
      if (event.detail?.targetId === propositionId && event.detail?.targetType === 'proposition') {
        // Refetch citations when they change
        fetch(`/api/propositions/${propositionId}/citations`)
          .then(res => res.json())
          .then(data => {
            setCitations(data.citations || []);
          })
          .catch(err => {
            console.error("Failed to refetch citations:", err);
          });
      }
    };

    window.addEventListener('citations:changed', handleCitationChange);
    return () => window.removeEventListener('citations:changed', handleCitationChange);
  }, [propositionId]);

  return (
    <NodeViewWrapper
      as="div"
      className="proposition-embed not-prose my-4"
      data-proposition-id={propositionId}
    >
      <div
        className="rounded-lg border-2 border-purple-200 bg-purple-50 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() =>
          propositionId &&
          openInspector({ kind: "proposition", id: propositionId, tab: "overview" })
        }
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && propositionId) {
            e.preventDefault();
            openInspector({ kind: "proposition", id: propositionId, tab: "overview" });
          }
        }}
      >
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Proposition
              </span>
              {mediaUrl && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-medium">
                  <ImageIcon className="w-3 h-3" />
                  Has media
                </span>
              )}
              {citationCount && citationCount > 0 && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                  <LinkIcon className="w-3 h-3" />
                  {citationCount} {citationCount === 1 ? 'citation' : 'citations'}
                </span>
              )}
            </div>
            <p className="text-slate-900 font-medium leading-relaxed">
              {propositionText}
            </p>
            <div
              className="mt-2"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <LiveBadgeStrip
                id={propositionId}
                kind="proposition"
                hideLabel
              />
            </div>
            {mediaUrl && (
              <div className="mt-3">
                <img
                  src={mediaUrl}
                  alt="Proposition media"
                  className="max-w-md rounded-lg border border-slate-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
            {citations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-purple-200">
                <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">
                  Citations
                </div>
                <div className="space-y-2">
                  {citations.map((citation: any, idx: number) => (
                    <div key={citation.id || idx} className="text-sm">
                      {citation.url ? (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 hover:text-sky-800 hover:underline flex items-center gap-1"
                        >
                          <LinkIcon className="w-3 h-3" />
                          {citation.title || citation.url}
                        </a>
                      ) : (
                        <span className="text-slate-700">{citation.title || citation.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {authorName && (
              <p className="text-xs text-slate-500 mt-2">— {authorName}</p>
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// TipTap extension definition
export const PropositionNode = Node.create({
  name: "propositionNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      propositionId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-proposition-id"),
        renderHTML: (attributes) => ({
          "data-proposition-id": attributes.propositionId,
        }),
      },
      propositionText: {
        default: "",
      },
      mediaUrl: {
        default: null,
      },
      authorName: {
        default: null,
      },
      citationCount: {
        default: 0,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="proposition-node"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "proposition-node" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PropositionNodeView);
  },
});
