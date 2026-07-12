// lib/tiptap/extensions/draft-proposition-node.tsx
import { Node, mergeAttributes, type CommandProps, type RawCommands } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import React, { useState } from "react";
import { PropositionComposerEmbeddable, type PropositionData } from "@/components/propositions/PropositionComposerEmbeddable";
import { Lightbulb, Image } from "lucide-react";

/**
 * React component for rendering draft proposition composer
 * This renders inline in the thesis editor during composition
 */
function DraftPropositionNodeView({ node, editor, getPos }: NodeViewProps) {
  const { draftId, text, mediaUrl, deliberationId } = node.attrs as {
    draftId: string;
    text?: string;
    mediaUrl?: string;
    deliberationId: string;
  };

  const [isSaved, setIsSaved] = useState(!!text);

  const handleSave = (data: PropositionData) => {
    // Update the node attributes with saved data
    const pos = getPos();
    if (typeof pos === "number") {
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            text: data.text,
            mediaUrl: data.mediaUrl || "",
          });
          return true;
        })
        .run();
      
      setIsSaved(true);
    }
  };

  const handleCancel = () => {
    // Remove the draft node from editor
    const pos = getPos();
    if (typeof pos === "number") {
      editor
        .chain()
        .focus()
        .deleteRange({ from: pos, to: pos + node.nodeSize })
        .run();
    }
  };

  const handleEdit = () => {
    setIsSaved(false);
  };

  // If saved, show compact preview card
  if (isSaved && text) {
    return (
      <NodeViewWrapper
        as="div"
        className="draft-proposition-preview not-prose my-4"
        data-draft-id={draftId}
      >
        <div className="rounded-lg border-2 border-purple-300 bg-purple-50/50 p-4 shadow-sm relative group">
          {/* Draft Badge */}
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full font-medium border border-amber-300">
              DRAFT PROPOSITION
            </span>
            <button
              onClick={handleEdit}
              className="text-xs px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100"
            >
              Edit
            </button>
          </div>

          {/* Content */}
          <div className="flex items-start gap-3 pr-40">
            <Lightbulb className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Proposition
                </span>
                {mediaUrl && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-medium">
                    <Image className="w-3 h-3" />
                    Has media
                  </span>
                )}
              </div>
              <p className="text-slate-800 leading-relaxed">{text}</p>
              {mediaUrl && (
                <div className="mt-2">
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
            </div>
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  // Otherwise, show the composer
  return (
    <NodeViewWrapper
      as="div"
      className="draft-proposition-composer not-prose"
      data-draft-id={draftId}
    >
      <PropositionComposerEmbeddable
        mode="embedded"
        deliberationId={deliberationId}
        initialText={text}
        initialMediaUrl={mediaUrl}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </NodeViewWrapper>
  );
}

/**
 * TipTap extension for draft proposition nodes
 * 
 * These are temporary proposition nodes that exist only in the thesis during composition.
 * When the thesis is published, draft propositions are converted to real Proposition objects
 * in the deliberation and replaced with live proposition nodes (if we create those in the future).
 */
export const DraftPropositionNode = Node.create({
  name: "draftPropositionNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      draftId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-draft-id"),
        renderHTML: (attributes) => ({
          "data-draft-id": attributes.draftId,
        }),
      },
      text: {
        default: "",
      },
      mediaUrl: {
        default: "",
      },
      deliberationId: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="draft-proposition-node"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "draft-proposition-node" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DraftPropositionNodeView);
  },

  addCommands() {
    return {
      insertDraftProposition:
        (attributes?: { deliberationId: string; text?: string; mediaUrl?: string }) =>
        ({ commands }: CommandProps) => {
          const draftId = `draft_prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return commands.insertContent({
            type: this.name,
            attrs: {
              draftId,
              text: attributes?.text || "",
              mediaUrl: attributes?.mediaUrl || "",
              deliberationId: attributes?.deliberationId || "",
            },
          });
        },
    } as Partial<RawCommands>;
  },
});
