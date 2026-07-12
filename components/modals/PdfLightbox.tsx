// components/modals/PdfLightbox.tsx
"use client";
import * as React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import CitePickerInlinePro from "@/components/citations/CitePickerInlinePro";
import CitePickerModal from "@/components/citations/CitePickerModal";
import { IntentSelector, CitationIntentType, IntentBadge } from "@/components/citations/IntentSelector";
import { ChevronUpIcon, ChevronDownIcon, QuoteIcon, BookOpenIcon } from "lucide-react";

type BaseProps = {
  title?: string;
  /** start at X (appended to #page=X) */
  startPage?: number;
  /** optional: attach directly if provided */
  citeTargetType?: "comment" | "claim" | "argument" | "card";
  citeTargetId?: string;
};

type TriggeredProps = BaseProps & {
  trigger: React.ReactNode;
  /** Provide either a direct fileUrl OR a postId */
  fileUrl?: string;
  postId?: string;
  open?: never;
  onOpenChange?: never;
};

type ControlledProps = BaseProps & {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  fileUrl?: string;
  postId?: string;
  trigger?: never;
};

type PdfLightboxProps = TriggeredProps | ControlledProps;

type PostInfo = {
  id: string;
  title: string | null;
  fileUrl: string;
  pageCount: number;
  thumbUrls: string[];
};

export default function PdfLightbox(props: PdfLightboxProps) {
  const isControlled = "open" in props && typeof props.open === "boolean";
  const [selfOpen, setSelfOpen] = React.useState(false);
  const open = isControlled ? (props as ControlledProps).open : selfOpen;
  const setOpen = isControlled ? (props as ControlledProps).onOpenChange : setSelfOpen;

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<PostInfo | null>(null);

  const directFileUrl = props.fileUrl;
  const title = props.title ?? info?.title ?? "PDF";
  const startPage = props.startPage ?? 1;

  // “Cite” overlay state
  const [citeOpen, setCiteOpen] = React.useState(false);
  const [citeExpanded, setCiteExpanded] = React.useState(true);
  const [locator, setLocator] = React.useState(startPage ? `p. ${startPage}` : "");
  const [quote, setQuote] = React.useState("");
  const [note, setNote] = React.useState("");
  const [intent, setIntent] = React.useState<CitationIntentType | null>(null);

  // When opened and a postId is provided (and no direct URL), fetch details.
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open) return;
      if (!("postId" in props) || !props.postId || directFileUrl) return;
      setLoading(true);
      setErr(null);
      try {
        const qs = new URLSearchParams({ id: props.postId! });
        const res = await fetch(`/api/library/post?${qs.toString()}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as PostInfo;
        if (!cancelled) setInfo(json);
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, directFileUrl, props]);

  const resolvedUrl = directFileUrl ?? info?.fileUrl ?? "";
  const iframeSrc =
    resolvedUrl && startPage > 1
      ? `${resolvedUrl}#page=${startPage}&view=FitH`
      : resolvedUrl ? `${resolvedUrl}#view=FitH` : "";

      function dispatchCite(mode: "quick" | "details") {
        const libId = ("postId" in props ? props.postId : undefined) || info?.id;
        const detail: any = { 
          mode, 
          locator, 
          quote, 
          note,
          // Phase 2.1: Add page anchor data for executable citations
          anchorType: "page",
          anchorData: { page: startPage },
          // Phase 2.3: Include intent if selected
          intent: intent || undefined,
        };
        if (libId) detail.libraryPostId = libId;
        window.dispatchEvent(new CustomEvent("composer:cite", { detail }));
      }
    

  const Header = (
    <DialogHeader>
      <div className="flex items-start justify-between gap-3">
        <DialogTitle className="truncate">{title}</DialogTitle>
        {resolvedUrl ? (
          <div className="flex items-center gap-2">
            <a href={resolvedUrl} target="_blank" rel="noreferrer" className="text-xs bg-white px-2 py-0.5 rounded-xl border">
              Open
            </a>
            <a href={`${resolvedUrl}${resolvedUrl.includes("?") ? "&" : "?"}download=1`} className="text-xs bg-white px-2 py-0.5 rounded-xl border">
              Download
            </a>
          </div>
        ) : null}
      </div>
    </DialogHeader>
  );

  const Body = (
    <div className="relative flex w-full h-[82vh] rounded-xl shadow-lg bg-white">
      {loading && (
        <div className="absolute inset-0 grid place-items-center text-sm text-gray-500">
          Loading PDF…
        </div>
      )}
      {err && <div className="p-3 text-sm text-red-600">Failed to load PDF: {err}</div>}
      {!loading && !err && iframeSrc && (
        <iframe
          title={title}
          src={iframeSrc}
          className="w-full rounded-xl"
          style={{ border: "none" }}
          referrerPolicy="no-referrer"
        />
      )}

      {/* Improved cite overlay - collapsible panel */}
      <div className="absolute bottom-3 right-3 z-10">
        <div className="w-[300px] rounded-lg border border-slate-200 bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden">
          {/* Header - always visible */}
          <button
            onClick={() => setCiteExpanded(!citeExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between bg-gradient-to-r bg-emerald-50 btnv2--ghost transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpenIcon className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-medium text-slate-700">Cite from PDF</span>
              {intent && <IntentBadge intent={intent} showLabel={false} />}
            </div>
            {citeExpanded ? (
              <ChevronDownIcon className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUpIcon className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Expanded content */}
          {citeExpanded && (
            <div className="p-3 space-y-3">
              {/* Locator & Note row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 mb-0.5 block">Page/Location</label>
                  <input
                    className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-emerald-300 focus:border-emerald-300 outline-none"
                    placeholder="p. 5, fig. 2"
                    value={locator}
                    onChange={(e) => setLocator(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-0.5 block">Annotation</label>
                  <input
                    className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-emerald-300 focus:border-emerald-300 outline-none"
                    placeholder="Add Note?"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>

              {/* Quote */}
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block flex items-center gap-1">
                  <QuoteIcon className="w-3 h-3" />
                  Quote (paste selection)
                </label>
                <textarea
                  className="w-full border minorfield border-slate-200 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-emerald-300 focus:border-emerald-300 outline-none resize-none"
                  rows={2}
                  placeholder="Select text in PDF and paste here..."
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                />
              </div>

              {/* Intent selector */}
              {/* <div>
                <label className="text-xs text-slate-500 mb-0.5 block">Purpose</label>
                <IntentSelector
                  value={intent}
                  onChange={setIntent}
                  compact
                  clearable
                />
              </div> */}

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  onClick={() => dispatchCite("quick")}
                  title="Attach citation immediately"
                >
                  Quick Cite
                </button>
                <button
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                  onClick={() => dispatchCite("details")}
                  title="Open full citation picker"
                >
                  More Options…
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  

  // Triggered (self-managed)
  if (!isControlled) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <div onClick={() => setOpen(true)}>{(props as TriggeredProps).trigger}</div>
        </DialogTrigger>
        <DialogContent className="max-w-[55rem] w-full h-[93vh] overflow-hidden bg-slate-100 border">
          {Header}
          {Body}
        </DialogContent>
      </Dialog>
    );
  }

  // Controlled
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[50rem] w-full h-[93vh] overflow-hidden bg-slate-100 border">
        {Header}
        {Body}
      </DialogContent>
    </Dialog>
  );
}
