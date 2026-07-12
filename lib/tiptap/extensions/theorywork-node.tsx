// lib/tiptap/extensions/theorywork-node.tsx
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import React from "react";
import { BookOpen, Sparkles } from "lucide-react";

// React component for rendering the theorywork
function TheoryWorkNodeView({ node }: NodeViewProps) {
  const { theoryWorkId, name, description, category } = node.attrs as {
    theoryWorkId: string;
    name: string;
    description?: string;
    category?: string;
  };

  return (
    <NodeViewWrapper
      as="div"
      className="theorywork-embed not-prose my-4"
      data-theorywork-id={theoryWorkId}
    >
      <div className="rounded-lg border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Theoretical Framework
              </span>
              {category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">
                  {category}
                </span>
              )}
            </div>
            <h4 className="text-slate-900 font-bold text-lg mb-1">{name}</h4>
            {description && (
              <p className="text-sm text-slate-700 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// TipTap extension definition
export const TheoryWorkNode = Node.create({
  name: "theoryWorkNode",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      theoryWorkId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-theorywork-id"),
        renderHTML: (attributes) => ({
          "data-theorywork-id": attributes.theoryWorkId,
        }),
      },
      name: {
        default: "",
      },
      description: {
        default: null,
      },
      category: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="theorywork-node"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "theorywork-node" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TheoryWorkNodeView);
  },
});
