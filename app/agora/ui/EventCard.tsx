// components/agora/EventCard.tsx
"use client";
import Link from "next/link";
import useSWR from 'swr';
import type { AgoraEvent } from "@/lib/server/bus";
function isExternal(href: string) {
  try { const u = new URL(href); return !!u.protocol && !!u.host; } catch { return false; }
}

export function EventCard({
  ev, onSelect, isFollowing, onFollow, onUnfollow, pending = false, ok = false,
}: {
  ev: AgoraEvent; onSelect?: (e: AgoraEvent) => void;
  isFollowing?: boolean; onFollow?: () => void; onUnfollow?: () => void;
  pending?: boolean; ok?: boolean;
}) {
  const isBundle = ev.type === ("bundle" as any);
  const bundleSub = (ev as any).subtype as string | undefined;
  const iconKind = isBundle ? (bundleSub === "citations" ? "link" : "move") : ev.icon;

  const chips = ev.chips ?? [];
  const MAX_CHIPS = 5;
  const displayChips = chips.slice(0, MAX_CHIPS);
  const extra = Math.max(0, chips.length - MAX_CHIPS);
const statusUrl = (ev.type === "bundle" as AgoraEvent["type"]) && ev.deliberationId
    ? `/api/dialogues/${ev.deliberationId}/status`
    : null;
  const { data: st } = useSWR(
    statusUrl,
    (u)=>fetch(u).then(r=>r.ok ? r.json() : Promise.resolve(null)),
    { revalidateOnFocus:false, shouldRetryOnError:false }
  );
  return (
    <div
      role="button" tabIndex={0}
      className="rounded-xl border bg-white/70 p-3 hover:bg-white transition cursor-default focus:outline-none focus:ring-2 focus:ring-slate-300"
      onClick={() => onSelect?.(ev)}
      onKeyDown={(e) => { if (e.key === "Enter") onSelect?.(ev); }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="h-6 w-6 grid place-items-center rounded border bg-white text-[11px]" aria-hidden>
            {iconEmoji(iconKind)}
          </div>
          <div>
            <div className="text-sm font-medium line-clamp-2">
              {isBundle
                ? (bundleSub === "citations" ? `${(ev as any).count || 2} sources attached` : "Activity in this room")
                : ev.title}
            </div>

            {ev.meta && (
              <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{ev.meta}</div>
            )}
            <div className="text-[11px] text-slate-600">
     
  {st?.ok && typeof st.openBranches==='number' && (
    <> · Open branches: {st.openBranches}</>
  )}
</div>

            {!!displayChips.length && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {displayChips.map((t) => {
                  const s = String(t);
                  const isQuote = s.startsWith("“");
                  const isNote  = s.startsWith("Note:");
                  return (
                    <span
                      key={s}
                      className={[
                        "text-[11px] px-1.5 py-0.5 rounded border bg-white/80",
                        isQuote ? "italic" : "",
                        isNote  ? "text-slate-600 border-slate-200" : "",
                      ].join(" ")}
                      title={s}
                    >
                      {s}
                    </span>
                  );
                })}
                {extra > 0 && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded border bg-white/80" title={`${extra} more`}>
                    +{extra}
                  </span>
                )}
              </div>
            )}

            {isBundle && bundleSub !== "citations" && (ev as any).kinds && (
              <div className="mt-1 text-[11px] text-slate-600">
                {Object.entries((ev as any).kinds as Record<string, number>)
                  .map(([kk, v]) => `${v} ${kk}`)
                  .join(" · ")}
              </div>
            )}
          </div>
        </div>
        <div className="text-[11px] text-slate-500 whitespace-nowrap">
          {new Date(ev.ts).toLocaleTimeString()}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* Generic Open (hide for citations, which have their own CTAs) */}
{ev.link && ev.type !== "citations:changed" && (
    isExternal(ev.link) ? (
      <a href={ev.link} target="_blank" rel="noreferrer noopener" className="text-xs px-2 py-1 rounded-md btnv2--ghost" aria-label="Open">
        Open
      </a>
    ) : (
      <Link href={ev.link} className="text-xs px-2 py-1 rounded-md btnv2--ghost" aria-label="Open">
        Open
      </Link>
    )
  )}

        {ev.type === "dialogue:changed" && ev.deliberationId && (
          <Link href={`/deliberation/${ev.deliberationId}?mode=forum`} className="text-xs px-2 py-1 rounded-md btnv2--ghost" aria-label="Reply in forum">
            Reply
          </Link>
        )}

        {/* Citations: dual CTAs */}
        {ev.type === "citations:changed" && (ev as any).contextLink && (
          <Link href={(ev as any).contextLink} className="text-xs px-2 py-1 rounded-md btnv2--ghost" aria-label="Open context">
            Context
          </Link>
        )}
        {ev.type === "citations:changed" && ev.link && (
          <Link href={ev.link} className="text-xs px-2 py-1 rounded-md btnv2--ghost" aria-label="Open source">
            Open Source
          </Link>
        )}

        {ev.type === "stacks:changed" && ev.link && (
          <Link href={ev.link} className="text-xs px-2 py-1 rounded-md btnv2--ghost" aria-label="Open stack">
            Open Stack
          </Link>
        )}

        {!!ev.deliberationId && (
          <div className="inline-flex items-center gap-2 ml-auto" aria-live="polite">
            {isFollowing ? (
              <button
                type="button"
                className={`text-xs px-2 py-1 rounded-md border ${
                  pending ? "bg-rose-50/50 border-rose-200/60 text-rose-600 cursor-not-allowed"
                          : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                }`}
                onClick={(e) => { e.stopPropagation(); if (!pending) onUnfollow?.(); }}
                disabled={pending}
                aria-busy={pending}
                title="Unfollow this room"
              >
                {pending ? "Unfollowing…" : "Following"}
              </button>
            ) : (
              <button
                type="button"
                className={`text-xs px-2 py-1 rounded-md btnv2--ghost ${pending ? "text-slate-500 bg-slate-100 cursor-not-allowed" : ""}`}
                onClick={(e) => { e.stopPropagation(); if (!pending) onFollow?.(); }}
                disabled={pending}
                aria-busy={pending}
                title="Follow this room"
              >
                {pending ? "Following…" : "Follow"}
              </button>
            )}
            {ok && <span className="text-[11px] text-emerald-700">✓ saved</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function iconEmoji(kind?: string) {
  switch (kind) {
    case "move": return "»";

    case "link":  return "⛓";
    case "check": return "✓";
    case "vote":  return "☑";
    case "branch":return "⑂";
    case "plus":  return "⊕";
    case "stack": return "⧉";
    case "chat":  return "✉";
    default:      return "•";
  }
}
