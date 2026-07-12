// components/thesis/ThesisLiveContent.tsx
//
// Living Thesis — Phase 1.4: read-only TipTap renderer for the published
// thesis view. Uses the same extensions as the editor so the Phase 1.3
// retrofits (LiveBadgeStrip, click-to-inspect, live label overrides) are
// picked up automatically. Mounts inside `<ThesisLiveProvider>` (set up
// by the view page) so the embedded nodes can read live stats.
//
// This replaces the previous hand-rolled JSON renderer in
// app/deliberations/[id]/thesis/[thesisId]/view/page.tsx, which
// re-implemented the custom node UIs and therefore could not benefit
// from the live data layer.

"use client";

import React, { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { JSONContent } from "@tiptap/core";

import { ClaimNode } from "@/lib/tiptap/extensions/claim-node";
import { ArgumentNode } from "@/lib/tiptap/extensions/argument-node";
import { CitationNode } from "@/lib/tiptap/extensions/citation-node";
import { TheoryWorkNode } from "@/lib/tiptap/extensions/theorywork-node";
import { PropositionNode } from "@/lib/tiptap/extensions/proposition-node";
import { ArgumentChainNode } from "@/lib/tiptap/extensions/argument-chain-node";

interface ThesisLiveContentProps {
  content: JSONContent | null | undefined;
}

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function ThesisLiveContent({ content }: ThesisLiveContentProps) {
  const editor = useEditor({
    editable: false,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: "text-teal-600 underline hover:text-teal-700",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      ClaimNode,
      ArgumentNode,
      CitationNode,
      TheoryWorkNode,
      PropositionNode,
      ArgumentChainNode,
    ],
    content: content ?? EMPTY_DOC,
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none focus:outline-none thesis-live-content",
      },
    },
  });

  // Keep editor content in sync if the thesis content prop changes
  // (e.g. on reload or live re-fetch of the document body).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (!content) return;
    const current = editor.getJSON();
    // Cheap structural comparison — if nothing changed, skip resetting
    // (resetting would cause node-views to remount and lose any local UI state).
    try {
      if (JSON.stringify(current) === JSON.stringify(content)) return;
    } catch {
      // fall through to setContent on stringify failure
    }
    editor.commands.setContent(content, false);
  }, [editor, content]);

  if (!content || (Array.isArray(content.content) && content.content.length === 0)) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>No content available</p>
      </div>
    );
  }

  return <EditorContent editor={editor} />;
}
