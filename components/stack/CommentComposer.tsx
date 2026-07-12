// components/stack/CommentComposer.tsx
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useFormStatus } from "react-dom";
import { addStackComment } from "@/lib/actions/stack.actions";
import CitePickerInlinePro from "@/components/citations/CitePickerInlinePro";
import CitePickerModal from "../citations/CitePickerModal";
function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="w-fit px-6 items-center justify-center py-0 align-center bg-white/70 h-full mx-auto sendbutton rounded-md text-slate-700 disabled:opacity-20"
      disabled={pending}
    >
      <Image src="/assets/send (2).svg" alt="share" width={24} height={24} className="cursor-pointer object-contain ml-1" />
    </button>
  );
}

export default function CommentComposer({ rootId }: { rootId: bigint | number | string }) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [inlineOpen, setInlineOpen] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalPrefill, setModalPrefill] = React.useState<{
    initialUrl?: string;
    initialDOI?: string;
    initialLocator?: string;
    initialQuote?: string;
    initialNote?: string;
    anchorType?: string;
    anchorId?: string;
    anchorData?: Record<string, unknown>;
  }>({});
  const [justPostedId, setJustPostedId] = React.useState<string | null>(null);

  async function ensureTargetComment() {
    // If user typed, post that as the target
    if (text.trim()) {
      const fd = new FormData();
      fd.set("rootId", String(rootId));
      fd.set("text", text);
      const id = await addStackComment(fd);
      setJustPostedId(String(id));
      setText("");
      return String(id);
    }
    // If we already have a target, reuse it
    if (justPostedId) return justPostedId;
    // Otherwise, create a single "Sources:" anchor we can reuse
    const fd = new FormData();
    fd.set("rootId", String(rootId));
    fd.set("text", "Sources:");
    const id = await addStackComment(fd);
    setJustPostedId(String(id));
    return String(id);
  }

  async function onSubmit(formData: FormData) {
    const id = await addStackComment(formData);
    setText("");
    setJustPostedId(String(id));
    router.refresh();
  }

  // Handle events coming from tiles / PdfLightbox
  React.useEffect(() => {
    async function handleCite(ev: Event) {
      const d = (ev as CustomEvent)?.detail || {};
      const mode: "quick" | "details" = d.mode || "quick";
      const libId: string | undefined = d.libraryPostId;
      const locator: string | undefined = d.locator;
      const quote: string | undefined = d.quote;
      const note: string | undefined = d.note;
      const relevance: number | undefined = d.relevance;
      // Phase 2.1: Anchor data for executable citations
      const anchorType: string | undefined = d.anchorType;
      const anchorId: string | undefined = d.anchorId;
      const anchorData: Record<string, unknown> | undefined = d.anchorData;

      const targetId = await ensureTargetComment();

      if (libId && mode === "quick") {
        // Resolve + attach immediately, then refresh chips
        const r = await fetch("/api/citations/resolve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ libraryPostId: String(libId) }),
        });
        const j = await r.json();
        const sourceId = j?.source?.id;
        if (sourceId) {
          await fetch("/api/citations/attach", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ 
              targetType: "comment", 
              targetId, 
              sourceId, 
              locator, 
              quote, 
              note, 
              relevance,
              // Phase 2.1: Include anchor data
              anchorType,
              anchorId,
              anchorData,
            }),
          }).catch(() => {});
          window.dispatchEvent(new CustomEvent("citations:changed", { detail: { targetType: "comment", targetId, sourceId, locator } }));
          router.refresh();
        }
        return;
      }

      // DETAILS: open the modal (prefill locator/quote if provided)
      if (mode === "details") {
        setModalPrefill({
          initialLocator: locator,
          initialQuote: quote,
          initialNote: note,
          // Phase 2.1: Pass anchor data to modal
          anchorType: anchorType as any,
          anchorId,
          anchorData,
          // initialUrl/DOI optional; leave empty to search in picker
        });
        setModalOpen(true);
      } else {
        // graceful fallback: open inline picker if no item was specified
        setInlineOpen(true);
      }
    }

    window.addEventListener("composer:cite", handleCite as any);
    return () => window.removeEventListener("composer:cite", handleCite as any);
  }, [rootId, justPostedId, text, router]);

  return (
    <div className="flex flex-col gap-2">
      <form action={onSubmit} className="flex items-start gap-3">
        <input type="hidden" name="rootId" value={String(rootId)} />
        <textarea
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment…"
          className="commentfield flex w-full flex-1 py-3 px-3 max-h-[180px] border rounded-xl bg-white/70 text-sm"
          rows={2}
        />
        <div className="flex flex-col align-center my-auto items-center gap-1.5">
          <button
            type="button"
            className="w-fit px-3 items-center justify-center py-0.5 align-center bg-white/70 h-full mx-auto sendbutton rounded-md text-sm text-slate-700 disabled:opacity-20"
            onClick={async () => {
              const targetId = await ensureTargetComment();
              setInlineOpen(true);
              // No refresh here; picker should render immediately for targetId
            }}
            title="Attach a citation to your newest comment"
          >
            Citations
          </button>
          <SubmitBtn />
        </div>
      </form>

      {/* INLINE PICKER + tiny close button */}
      {inlineOpen && justPostedId && (
        <div className="flex w-full items-start gap-2">
          <CitePickerInlinePro
            targetType="comment"
            targetId={justPostedId}
            onDone={() => {
              setInlineOpen(false);
              // keep justPostedId so user can add more later
              router.refresh();
            }}
          />
          <button
            className="px-2 py-1 text-xs rounded border bg-white/90 hover:bg-slate-50"
            onClick={() => setInlineOpen(false)}
            title="Close"
            aria-label="Close citation picker"
          >
            ×
          </button>
        </div>
      )}

      {/* MODAL PICKER (Cite with details…) */}
      {modalOpen && justPostedId && (
        <CitePickerModal
          open={modalOpen}
          onOpenChange={(v) => setModalOpen(v)}
          targetType="comment"
          targetId={justPostedId}
          title="Attach citation"
          initialUrl={modalPrefill.initialUrl}
          initialDOI={undefined}
          initialLocator={modalPrefill.initialLocator}
          initialQuote={modalPrefill.initialQuote}
          initialNote={modalPrefill.initialNote}
          onDone={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
