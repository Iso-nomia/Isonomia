// "use client";

// import * as React from "react";
// import { z } from "zod";
// import { invalidateDeliberation } from "@/lib/deepdive/invalidate";

// type MediaType = "text" | "image";

// export type Proposition = {
//   id: string;
//   deliberationId: string;
//   authorId: string;
//   text: string;
//   mediaType: MediaType | null;
//   mediaUrl: string | null;
//   status: string;
//   promotedClaimId: string | null;
//   voteUpCount: number;
//   voteDownCount: number;
//   endorseCount: number;
//   replyCount: number;
//   createdAt: string;
// };

// type Props = {
//   deliberationId: string;
//   onCreated?: (p: Proposition) => void;
//   placeholder?: string;
//   className?: string;
// } & React.HTMLAttributes<HTMLDivElement>;

// const schema = z.object({
//   text: z.string().trim().min(1, "Please enter your proposition.").max(5000),
//   mediaUrl: z.string().url().optional(),
//   mediaType: z.enum(["text", "image"]).optional(),
// });

// export default function PropositionComposer({
//   deliberationId,
//   onCreated,
//   placeholder = "State your proposition…",
//   className,
//   ...rest
// }: Props) {
//   const [text, setText] = React.useState("");
//   const [imageUrl, setImageUrl] = React.useState("");
//   const [pending, setPending] = React.useState(false);
//   const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

//   // Auto-grow text area (cap at ~320px)
//   React.useEffect(() => {
//     const el = textareaRef.current;
//     if (!el) return;
//     el.style.height = "0px";
//     el.style.height = Math.min(320, el.scrollHeight) + "px";
//   }, [text]);

//   // Cmd/Ctrl + Enter to submit (same UX pattern as DeliberationComposer)
//   React.useEffect(() => {
//     const onKey = (e: KeyboardEvent) => {
//       if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && text.trim() && !pending) {
//         e.preventDefault();
//         submit();
//       }
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [text, pending]);

//   async function submit() {
//     const payload = {
//       text: text.trim(),
//       ...(imageUrl
//         ? { mediaType: "image" as const, mediaUrl: imageUrl.trim() }
//         : { mediaType: "text" as const }),
//     };

//     const parsed = schema.safeParse(payload);
//     if (!parsed.success) {
//       alert(parsed.error.issues[0]?.message ?? "Please check your input.");
//       return;
//     }

//     setPending(true);
//     try {
//       // POST /api/deliberations/:id/propositions
//       const res = await fetch(`/api/deliberations/${deliberationId}/propositions`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(parsed.data),
//       });

//       const textRes = await res.text();
//       let json: any = null;
//       try {
//         json = JSON.parse(textRes);
//       } catch {
//         // leave as text
//       }

//       if (!res.ok) {
//         const msg = json?.error || json?.message || textRes || `HTTP ${res.status}`;
//         throw new Error(msg);
//       }

//       // Allow { ok, proposition } or { proposition } shapes
//       const proposition: Proposition = (json?.proposition ?? json) as Proposition;

//       // Revalidate the deliberation-scoped views
//       invalidateDeliberation(deliberationId);

//       // Reset + inform parent
//       setText("");
//       setImageUrl("");
//       onCreated?.(proposition);
//     } catch (err: any) {
//       console.error(err);
//       alert(err?.message ?? "Could not post proposition.");
//     } finally {
//       setPending(false);
//     }
//   }

//   const used = text.length;
//   const max = 5000;
//   const pct = Math.min(1, used / max);

//   return (
//     <div
//       {...rest}
//       className={[
//         "group relative rounded-2xl panel-edge bg-indigo-50/70 p-4 backdrop-blur space-y-3",
//         "scroll-mt-24",
//         className || "",
//       ].join(" ")}
//     >
//       {/* Header */}
//       <div className="flex items-center justify-between">
//         <div className="text-md font-semibold text-slate-700">New proposition</div>
//         <div className="text-[11px] text-neutral-500">
//           {pending ? "Posting…" : "⌘/Ctrl + Enter to post"}
//         </div>
//       </div>

//       {/* Textarea + counter bar */}
//       <div className="space-y-2">
//         <textarea
//           ref={textareaRef}
//           rows={4}
//           placeholder={placeholder}
//           className="w-full resize-none rounded-lg articlesearchfield px-3 py-2 mt-1 bg-white text-sm"
//           value={text}
//           onChange={(e) => setText(e.target.value)}
//           disabled={pending}
//         />
//         <div className="h-1.5 overflow-hidden rounded bg-slate-200/70">
//           <div
//             className="h-full rounded bg-[linear-gradient(90deg,theme(colors.indigo.400),theme(colors.fuchsia.400),theme(colors.sky.400))]"
//             style={{ width: `${pct * 100}%` }}
//           />
//         </div>
//         <div className="text-[11px] text-neutral-500 tabular-nums">
//           {used}/{max}
//         </div>
//       </div>

//       {/* Optional image attachment via URL */}
//       <div className="space-y-1">
//         <div className="flex items-center gap-2">
//           <input
//             type="url"
//             placeholder="Paste image URL (optional)"
//             className="w-full rounded articlesearchfield px-2 py-2 text-xs"
//             value={imageUrl}
//             onChange={(e) => setImageUrl(e.target.value)}
//             disabled={pending}
//           />
//           {imageUrl && (
//             <button
//               type="button"
//               className="btnv2--ghost btnv2--sm"
//               onClick={() => setImageUrl("")}
//               disabled={pending}
//             >
//               Clear
//             </button>
//           )}
//         </div>
//         {imageUrl && (
//           <div className="rounded border border-slate-200 bg-white/80 p-2">
//             {/* eslint-disable-next-line @next/next/no-img-element */}
//             <img src={imageUrl} alt="preview" className="mx-auto max-h-40 object-contain" />
//           </div>
//         )}
//       </div>

//       {/* Post */}
//       <div className="flex justify-start">
//         <button
//           type="button"
//           className="btnv2 px-5 py-2 text-xs tracking-wide"
//           onClick={submit}
//           disabled={pending || !text.trim()}
//         >
//           {pending ? "Posting…" : "Post"}
//         </button>
//       </div>
//     </div>
//   );
// }
"use client";

import * as React from "react";
import { z } from "zod";
import { invalidateDeliberation } from "@/lib/deepdive/invalidate";

type MediaType = "text" | "image";

export type Proposition = {
  id: string;
  deliberationId: string;
  authorId: string;
  text: string;
  mediaType: MediaType | null;
  mediaUrl: string | null;
  status: string;
  promotedClaimId: string | null;
  voteUpCount: number;
  voteDownCount: number;
  endorseCount: number;
  replyCount: number;
  createdAt: string;
};

type Props = {
  deliberationId: string;
  onCreated?: (p: Proposition) => void;
  placeholder?: string;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

const schema = z.object({
  text: z.string().trim().min(1, "Please enter your proposition.").max(5000),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(["text", "image"]).optional(),
});

/* ---------------------------
   Hooks: autosize + debounce
---------------------------- */
function useAutoResizeTextArea(
  ref: React.RefObject<HTMLTextAreaElement>,
  value: string,
  maxPx = 320
) {
  const max = maxPx;
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = requestAnimationFrame(() => {
      // Minimize layout thrash: set to 0 then measure once
      el.style.height = "0px";
      const h = Math.min(max, el.scrollHeight);
      el.style.height = h + "px";
    });
    return () => cancelAnimationFrame(raf);
  }, [ref, value, max]);
}

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ---------------------------
   Component
---------------------------- */
export default function PropositionComposer({
  deliberationId,
  onCreated,
  placeholder = "State your proposition…",
  className,
  ...rest
}: Props) {
  const [text, setText] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const debouncedImageUrl = useDebouncedValue(imageUrl, 300);

  const [pending, setPending] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // keep UI responsive & avoid setState-after-unmount
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      submitAbortRef.current?.abort("unmount");
    };
  }, []);

  // autosize without flicker
  useAutoResizeTextArea(textareaRef, text, 320);

  // local submit guards
  const pendingRef = React.useRef(false);
  const submitAbortRef = React.useRef<AbortController | null>(null);

  // CTA enablement
  const used = text.length;
  const max = 5000;
  const pct = Math.min(1, used / max);

  // Inline, non-blocking error helper
  const showError = React.useCallback((msg: string) => {
    setErrorMsg(msg);
    // auto-clear after a beat
    window.setTimeout(() => {
      if (mountedRef.current) setErrorMsg(null);
    }, 3500);
  }, []);

  const submit = React.useCallback(async () => {
    if (pendingRef.current) return;
    const payload =
      debouncedImageUrl.trim().length > 0
        ? { text: text.trim(), mediaType: "image" as const, mediaUrl: debouncedImageUrl.trim() }
        : { text: text.trim(), mediaType: "text" as const };

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      showError(parsed.error.issues[0]?.message ?? "Please check your input.");
      return;
    }

    pendingRef.current = true;
    setPending(true);

    // abort any in-flight request (rapid double-clicks, etc.)
    submitAbortRef.current?.abort("replaced");
    const ctrl = new AbortController();
    submitAbortRef.current = ctrl;

    try {
      const res = await fetch(
        `/api/deliberations/${encodeURIComponent(deliberationId)}/propositions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
          signal: ctrl.signal,
        }
      );

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
      }

      const proposition: Proposition = (json?.proposition ?? json) as Proposition;

      // Don’t block the paint while we invalidate
      React.startTransition(() => {
        invalidateDeliberation(deliberationId);
      });

      // Reset + notify
      if (mountedRef.current) {
        setText("");
        setImageUrl("");
        onCreated?.(proposition);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error(err);
      showError(err?.message ?? "Could not post proposition.");
    } finally {
      if (mountedRef.current) setPending(false);
      pendingRef.current = false;
    }
  }, [text, debouncedImageUrl, deliberationId, onCreated, showError]);

  return (
    <div
      {...rest}
      aria-busy={pending}
      className={[
        "group relative rounded-2xl panel-edge bg-indigo-50/70 p-4 backdrop-blur space-y-3",
        "scroll-mt-24",
        className || "",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-md font-semibold text-slate-700">New proposition</div>
        <div className="text-[11px] text-neutral-500">
          {pending ? "Posting…" : "⌘/Ctrl + Enter to post"}
        </div>
      </div>

      {/* Textarea + counter bar */}
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          rows={4}
          placeholder={placeholder}
          className="w-full h-full resize-none rounded-lg articlesearchfield px-3 py-3 mt-1 bg-white text-sm"
          value={text}
          maxLength={max}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !pending && text.trim()) {
              e.preventDefault();
              submit();
            }
          }}
          disabled={pending}
          spellCheck
          aria-label="Proposition text"
          enterKeyHint="done"
        />
        <div className="h-1.5 overflow-hidden rounded bg-slate-200/70">
          <div
            className="h-full rounded bg-[linear-gradient(90deg,theme(colors.indigo.400),theme(colors.fuchsia.400),theme(colors.sky.400))]"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <div className="text-[11px] text-neutral-500 tabular-nums">
          {used}/{max}
        </div>
        {errorMsg && (
          <div
            role="status"
            aria-live="polite"
            className="text-[12px] text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1"
          >
            {errorMsg}
          </div>
        )}
      </div>

      {/* Optional image attachment via URL (debounced preview) */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input
            type="url"
            placeholder="Paste image URL (optional)"
            className="w-full rounded-lg articlesearchfield px-3 py-2 text-xs"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            disabled={pending}
            aria-label="Image URL"
          />
          {imageUrl && (
            <button
              type="button"
              className="btnv2--ghost btnv2--sm"
              onClick={() => setImageUrl("")}
              disabled={pending}
            >
              Clear
            </button>
          )}
        </div>

        {debouncedImageUrl && (
          <div className="rounded border border-slate-200 bg-white/80 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={debouncedImageUrl}
              alt="image preview"
              className="mx-auto max-h-40 object-contain"
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => showError("Image failed to load. Check the URL.")}
            />
          </div>
        )}
      </div>

      {/* Post */}
      <div className="flex justify-start">
        <button
          type="button"
          className="btnv2 px-5 py-2 text-xs tracking-wide"
          onClick={submit}
          disabled={pending || !text.trim()}
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
    </div>
  );
}
