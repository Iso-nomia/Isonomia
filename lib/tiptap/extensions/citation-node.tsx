// lib/tiptap/extensions/citation-node.tsx
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import React from "react";
import { Link as LinkIcon, ExternalLink } from "lucide-react";
import { useOpenInspector } from "@/lib/thesis/ThesisLiveContext";

// React component for rendering the citation
function CitationNodeView({ node }: NodeViewProps) {
  const { citationId, title, url, author, year } = node.attrs as {
    citationId: string;
    title: string;
    url?: string;
    author?: string;
    year?: string;
  };
  const openInspector = useOpenInspector();

  return (
    <NodeViewWrapper
      as="div"
      className="citation-embed not-prose my-4"
      data-citation-id={citationId}
    >
      <div
        className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        role="button"
        tabIndex={0}
        onClick={() =>
          citationId &&
          openInspector({ kind: "citation", id: citationId, tab: "overview" })
        }
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && citationId) {
            e.preventDefault();
            openInspector({ kind: "citation", id: citationId, tab: "overview" });
          }
        }}
      >
        <div className="flex items-start gap-3">
          <LinkIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Citation
              </span>
            </div>
            <div className="space-y-1">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-900 font-semibold hover:text-amber-700 transition-colors inline-flex items-center gap-1"
                >
                  {title}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <p className="text-slate-900 font-semibold">{title}</p>
              )}
              {(author || year) && (
                <p className="text-sm text-slate-600">
                  {author}
                  {author && year && ", "}
                  {year}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// TipTap extension definition
export const CitationNode = Node.create({
  name: "citationNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      citationId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-citation-id"),
        renderHTML: (attributes) => ({
          "data-citation-id": attributes.citationId,
        }),
      },
      title: {
        default: "",
      },
      url: {
        default: null,
      },
      author: {
        default: null,
      },
      year: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="citation-node"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "citation-node" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CitationNodeView);
  },
});
