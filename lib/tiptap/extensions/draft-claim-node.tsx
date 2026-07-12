// lib/tiptap/extensions/draft-claim-node.tsx
import { Node, mergeAttributes, type CommandProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import React, { useState } from "react";
import { ClaimComposerEmbeddable, type ClaimData } from "@/components/claims/ClaimComposerEmbeddable";

/**
 * React component for rendering draft claim composer
 * This renders inline in the thesis editor during composition
 */
function DraftClaimNodeView({ node, editor, getPos, deleteNode }: NodeViewProps) {
  const { draftId, text, position, deliberationId } = node.attrs as {
    draftId: string;
    text?: string;
    position?: "IN" | "OUT" | "UNDEC";
    deliberationId: string;
  };

  const [isSaved, setIsSaved] = useState(!!text);

  const handleSave = (data: ClaimData) => {
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
            position: data.position,
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
        className="draft-claim-preview not-prose my-4"
        data-draft-id={draftId}
      >
        <div className="rounded-lg border-2 border-teal-300 bg-teal-50/50 p-4 shadow-sm relative group">
          {/* Draft Badge */}
          <div className="absolute top-2 right-2 flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full font-medium border border-amber-300">
              DRAFT CLAIM
            </span>
            <button
              onClick={handleEdit}
              className="text-xs px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors opacity-0 group-hover:opacity-100"
            >
              Edit
            </button>
          </div>

          {/* Content */}
          <div className="flex items-start gap-3 pr-32">
            <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
              position === "IN" ? "bg-emerald-500" :
              position === "OUT" ? "bg-rose-500" :
              "bg-slate-500"
            }`} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Claim
                </span>
                {position && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    position === "IN" ? "bg-emerald-100 text-emerald-800" :
                    position === "OUT" ? "bg-rose-100 text-rose-800" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {position}
                  </span>
                )}
              </div>
              <p className="text-slate-800 leading-relaxed">{text}</p>
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
      className="draft-claim-composer not-prose"
      data-draft-id={draftId}
    >
      <ClaimComposerEmbeddable
        mode="embedded"
        deliberationId={deliberationId}
        initialText={text}
        initialPosition={position}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </NodeViewWrapper>
  );
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    draftClaimNode: {
      insertDraftClaim: (attributes?: {
        deliberationId: string;
        text?: string;
        position?: string;
      }) => ReturnType;
    };
  }
}

/**
 * TipTap extension for draft claim nodes
 * 
 * These are temporary claim nodes that exist only in the thesis during composition.
 * When the thesis is published, draft claims are converted to real Claim objects
 * in the deliberation and replaced with live claim nodes.
 */
export const DraftClaimNode = Node.create({
  name: "draftClaimNode",
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
      position: {
        default: "UNDEC",
      },
      deliberationId: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="draft-claim-node"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "draft-claim-node" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DraftClaimNodeView);
  },

  addCommands() {
    return {
      insertDraftClaim:
        (attributes?: { deliberationId: string; text?: string; position?: string }) =>
        ({ commands }: CommandProps) => {
          const draftId = `draft_claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return commands.insertContent({
            type: this.name,
            attrs: {
              draftId,
              text: attributes?.text || "",
              position: attributes?.position || "UNDEC",
              deliberationId: attributes?.deliberationId || "",
            },
          });
        },
    };
  },
});
