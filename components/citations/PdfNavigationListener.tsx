"use client";

/**
 * PdfNavigationListener
 * 
 * Phase 2.1 of Stacks Improvement Roadmap
 * 
 * Listens for pdf:open events dispatched by CitationCard and opens
 * the PDF in a lightbox at the specified page with highlight.
 */

import * as React from "react";
import PdfLightbox from "@/components/modals/PdfLightbox";

interface PdfOpenEvent {
  postId: string;
  page?: number;
  highlight?: string;
  rect?: { x: number; y: number; width: number; height: number };
}

export default function PdfNavigationListener() {
  const [open, setOpen] = React.useState(false);
  const [postId, setPostId] = React.useState<string | null>(null);
  const [startPage, setStartPage] = React.useState(1);
  // highlight and rect stored for future use with annotation highlighting
  const [highlightId, setHighlightId] = React.useState<string | null>(null);
  const [highlightRect, setHighlightRect] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  React.useEffect(() => {
    function handlePdfOpen(ev: Event) {
      const detail = (ev as CustomEvent<PdfOpenEvent>).detail;
      if (!detail?.postId) return;

      setPostId(detail.postId);
      setStartPage(detail.page || 1);
      setHighlightId(detail.highlight || null);
      setHighlightRect(detail.rect || null);
      setOpen(true);
    }

    window.addEventListener("pdf:open", handlePdfOpen);
    return () => window.removeEventListener("pdf:open", handlePdfOpen);
  }, []);

  if (!postId) return null;

  return (
    <PdfLightbox
      open={open}
      onOpenChange={setOpen}
      postId={postId}
      startPage={startPage}
      title="PDF Viewer"
    />
  );
}
