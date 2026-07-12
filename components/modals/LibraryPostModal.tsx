"use client";
import React, { useState } from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useCreateLibraryPost } from "@/lib/hooks/useCreateLibraryPost";
import { useCreateFeedPost } from "@/lib/hooks/useCreateFeedPost";
import { bulkResolveCitations } from "@/lib/citation/bulkResolve";
import { useRouter } from "next/navigation";

type Props = { onOpenChange: (v: boolean) => void; stackId?: string };

async function renderFirstPagePNG(file: File): Promise<string|null> {
  // Workerless to avoid any .mjs issues in Next
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  try {
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1 });
    const targetWidth = 560;
    const scale = Math.max(0.5, Math.min(1.5, targetWidth / viewport.width));
    const scaled = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(scaled.width);
    canvas.height = Math.floor(scaled.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport: scaled }).promise;

    // free memory
    await page.cleanup?.();
    await pdf.cleanup?.();
    await pdf.destroy?.();

    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("[preview(upload)] failed:", (e as any)?.message || e);
    return null; // keep index alignment
  }
}

async function renderFirstPagePNGFromUrl(url: string): Promise<string|null> {
  const pdfjsLib: any = await import("pdfjs-dist/legacy/build/pdf.mjs");

  try {
    // fetch via proxy to dodge CORS/redirects
    const resp = await fetch(`/api/library/proxy?u=${encodeURIComponent(url)}`);
    if (!resp.ok) return null;
    const data = await resp.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1 });
    const targetWidth = 560;
    const scale = Math.max(0.5, Math.min(1.5, targetWidth / viewport.width));
    const scaled = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(scaled.width);
    canvas.height = Math.floor(scaled.height);
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport: scaled }).promise;

    await page.cleanup?.();
    await pdf.cleanup?.();
    await pdf.destroy?.();

    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("[preview(url)] failed:", (e as any)?.message || e);
    return null;
  }
}

// async function renderFirstPagePNG(file: File): Promise<string|null> {
// const pdfjsLib: any = await import("pdfjs-dist/build/pdf");
// //  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

//   const data = await file.arrayBuffer();
//   // const pdf = await pdfjsLib.getDocument({ data }).promise;
//  const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;

//   const page = await pdf.getPage(1);

//   const viewport = page.getViewport({ scale: 1 });
//   const targetWidth = 560;
//   const scale = targetWidth / viewport.width;
//   const scaled = page.getViewport({ scale });

//   const canvas = document.createElement("canvas");
//   canvas.width = Math.floor(scaled.width);
//   canvas.height = Math.floor(scaled.height);
//   const ctx = canvas.getContext("2d")!;
//   await page.render({ canvasContext: ctx, viewport: scaled }).promise;
//   return canvas.toDataURL("image/png");
// }

// async function renderFirstPagePNGFromUrl(url: string): Promise<string|null> {
//   const pdfjsLib: any = await import("pdfjs-dist/build/pdf");
//  //pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

//   // use proxy to dodge CORS
//   const resp = await fetch(`/api/library/proxy?u=${encodeURIComponent(url)}`);
//   if (!resp.ok) return null;
//   const data = await resp.arrayBuffer();

//   // const pdf = await pdfjsLib.getDocument({ data }).promise;
//   const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
//   const page = await pdf.getPage(1);

//   const viewport = page.getViewport({ scale: 1 });
//   const targetWidth = 560;
//   const scale = targetWidth / viewport.width;
//   const scaled = page.getViewport({ scale });

//   const canvas = document.createElement("canvas");
//   canvas.width = Math.floor(scaled.width);
//   canvas.height = Math.floor(scaled.height);
//   const ctx = canvas.getContext("2d")!;
//   await page.render({ canvasContext: ctx, viewport: scaled }).promise;
//   return canvas.toDataURL("image/png");
// }

export default function LibraryPostModal({ onOpenChange, stackId }: Props) {
  const createLibraryPost = useCreateLibraryPost();
  const createFeedPost = useCreateFeedPost();
  const router = useRouter();

  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [urls, setUrls] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [caption, setCaption] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const defaultName = "Untitled Stack";

async function onSubmit() {
  if (submitting) return;
  const list =
    tab === "url"
      ? urls.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];
  if (tab === "upload" && !(files && files.length)) return; // <-- guard
  if (tab === "url" && list.length === 0) return;           // <-- existing logic
  setSubmitting(true);
    try {
      const list =
        tab === "url"
          ? urls
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
      if (tab === "url" && !list.length && !(files && files.length)) return;

      // 1) build client-side previews (optional)
// let previews: string[] = [];
// if (tab === "upload" && files?.length) {
//   const results = await Promise.allSettled(
//     Array.from(files).map(renderFirstPagePNG)
//   );
//   previews = results
//     .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
//     .map((r) => r.value);
// }
//   let previews: Array<string|null> = [];

// if (tab === "upload" && files?.length) {
//   const settled = await Promise.allSettled(Array.from(files).map(renderFirstPagePNG));
//   previews = settled.map(r => (r.status === "fulfilled" ? r.value : null));
// }

// if (tab === "url" && list.length) {
//   const settled = await Promise.allSettled(list.map(renderFirstPagePNGFromUrl));
//   previews = settled.map(r => (r.status === "fulfilled" ? r.value : null));
// }


//  let previews: Array<string | null> = [];
//   if (tab === "upload" && files?.length) {
//    const results = await Promise.allSettled(Array.from(files).map(renderFirstPagePNG));
//    previews = results.map(r => (r.status === "fulfilled" ? r.value : null));
//  }

//  if (tab === "url") {
//    const list = urls.split("\n").map(s => s.trim()).filter(Boolean);
//    const results = await Promise.allSettled(list.map(renderFirstPagePNGFromUrl));
//    previews = results.map(r => (r.status === "fulfilled" ? r.value : null));
//  }

//  const result = await createLibraryPost({
//    files: tab === "upload" ? Array.from(files ?? []) : undefined,
//    urls:  tab === "url"    ? list : undefined,
//    previews,               // keep 1:1 alignment
//    isPublic, caption, stackId,
//    ...(stackId ? {} : { stackName: defaultName }),
// });

let previews: Array<string|null> = [];

if (tab === "upload" && files?.length) {
  const settled = await Promise.allSettled(Array.from(files).map(renderFirstPagePNG));
  previews = settled.map(r => (r.status === "fulfilled" ? r.value : null));
}

if (tab === "url") {
  const list = urls.split("\n").map(s => s.trim()).filter(Boolean);
  const settled = await Promise.allSettled(list.map(renderFirstPagePNGFromUrl));
  previews = settled.map(r => (r.status === "fulfilled" ? r.value : null));
}

const result = await createLibraryPost({
  files: tab === "upload" ? Array.from(files ?? []) : undefined,
  urls:  tab === "url"    ? urls.split("\n").map(s => s.trim()).filter(Boolean) : undefined,
  previews, // 👈 1:1 with files or URLs
  isPublic, caption, stackId,
  ...(stackId ? {} : { stackName: "Untitled Stack" }),
});

// Phase 7 — fire-and-forget Auto-Citation resolution for URL imports.
// We don't await: the LibraryPost rows are already created; the
// resolver fills `Source` rows in the background and the chip will
// hydrate on next render. Errors are intentionally swallowed.
if (tab === "url") {
  const importedUrls = urls.split("\n").map((s) => s.trim()).filter(Boolean);
  if (importedUrls.length) {
    bulkResolveCitations(importedUrls).catch(() => {});
  }
}


      // result MUST be { postIds: string[], stackId?: string }

      // 3) create the feed post, passing FK(s)
      const count = tab === "upload" ? files?.length ?? 0 : list.length;
      const payload =
        count <= 1
          ? {
              kind: "single",
              libraryPostId: result.postIds?.[0] ?? null,
              coverUrl: result.coverUrls?.[0] ?? null,
              coverUrls: [],
              size: 1,
            }
          : {
              kind: "stack",
              stackId: result.stackId ?? stackId ?? null,
              coverUrl: null,
              coverUrls: result.coverUrls ?? [],
              size: count,
            };

      await createFeedPost({
        type: "LIBRARY",
        content: JSON.stringify(payload),
        caption,
        isPublic,
        // `libraryPostId`/`stackId` are accepted server-side (createFeedPost)
        // but absent from ClientCreateFeedPostArgs; cast to forward them.
        libraryPostId: count === 1 ? result.postIds?.[0] : undefined,
        stackId: stackId || result.stackId || undefined,
      } as any);

      onOpenChange(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="max-w-[600px] bg-slate-300">
      <DialogHeader>
        <DialogTitle hidden> <span className="text-[20px]">New Library</span></DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-3 text-sm">
      <span className="flex font-semibold text-[22px] pb-1">New Library</span>
      <hr className="border-slate-600"></hr>
      <div className="flex gap-2 mt-1">
        <button
          className={tab === "upload" ? "flex  bg-slate-200 p-1 rounded" : "flex bg-transparent p-1 rounded "}
          onClick={() => setTab("upload")}
        >
          Upload
        </button>
        <button
          className={tab === "url" ? "flex  bg-slate-200 p-1 rounded" : "flex bg-transparent p-1 rounded"}
          onClick={() => setTab("url")}
        >
          Paste URL(s)
        </button>
        </div>
      </div>

      {tab === "upload" ? (
        <div className="mt-0 space-y-2 p-1">
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="text-sm"
            onChange={(e) => setFiles(e.target.files)}
          />
          <div className="text-xs text-muted-foreground">
            You can select multiple files.
          </div>
        </div>
      ) : (
        <textarea
          className="mt-3 w-full h-40 rounded border p-2"
          placeholder="One PDF URL per line"
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
        />
      )}

      {/* Optional visibility toggle */}
      {/* <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Public
      </label> */}

      <input
        className="mt-1 w-full text-xs rounded border p-2 commentfield rounded-lg"
        placeholder="Optional caption"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
      />

      <div className="mt-1 flex justify-end gap-2">
        <DialogClose asChild>
          <button className="text-xs px-3 py-2 rounded bg-slate-400/50 border" disabled={submitting}>
            Cancel
          </button>
        </DialogClose>
        <button
          className="px-3 py-2 rounded text-xs bg-black text-white"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "Creating…" : "Create"}
        </button>
      </div>
    </DialogContent>
  );
}
