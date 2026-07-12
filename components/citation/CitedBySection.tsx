import {
  Network,
  ArrowUpRight,
  Swords,
  Layers,
  Repeat2,
  ThumbsUp,
  Lock,
  Globe,
} from "lucide-react";
import type {
  CitedByResult,
  CitedByEdge,
  CitedByKind,
  ExternalCitationView,
} from "@/lib/citation/citedBy";

/**
 * Phase 10a — the cited-by section on the public argument page.
 *
 * Renders *who points at / uses this argument*, split into two honest columns:
 * things that build on it (support / premise-usage / cross-room reuse) and
 * things that contest it. Unlike most page sections, this one renders even when
 * empty: an empty cited-by is information (absence of engagement), and — per the
 * M-1 discipline (docs/Phase10a_CitedBy_Spec.md §3.2/§5.3) — it must never read
 * as settledness. The contest column is always shown so attacks are never
 * visually buried, and an empty one says "No contest on file yet", never
 * "Uncontested".
 */

const KIND_CHIP: Record<
  CitedByKind,
  { label: string; className: string; icon: typeof Layers }
> = {
  supports: { label: "supports", className: "bg-emerald-100 text-emerald-700", icon: ThumbsUp },
  "builds-on": { label: "builds on", className: "bg-indigo-100 text-indigo-700", icon: Layers },
  reuses: { label: "reuses", className: "bg-sky-100 text-sky-700", icon: Repeat2 },
  contests: { label: "contests", className: "bg-rose-100 text-rose-700", icon: Swords },
};

function CiterRow({ edge }: { edge: CitedByEdge }) {
  const chip = KIND_CHIP[edge.kind];
  const { from } = edge;
  const ChipIcon = chip.icon;
  const snippet = from.text?.trim() || "(untitled)";

  const body = (
    <div className="flex items-start gap-2">
      <span className="text-sm text-slate-800 leading-snug flex-1 line-clamp-3">
        {snippet}
      </span>
      {from.permalinkUrl && (
        <ArrowUpRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
      )}
    </div>
  );

  return (
    <li className="border border-slate-200/70 bg-white/50 rounded-xl px-4 py-3">
      {from.permalinkUrl ? (
        <a href={from.permalinkUrl} className="block hover:opacity-80 transition-opacity">
          {body}
        </a>
      ) : (
        body
      )}
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.08em] uppercase ${chip.className}`}
        >
          <ChipIcon className="w-3 h-3" />
          {chip.label}
        </span>
        {from.standingState && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-[0.04em] bg-slate-100 text-slate-600">
            {from.standingState}
          </span>
        )}
        {edge.crossDeliberation && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-[0.04em] bg-violet-50 text-violet-700 border border-violet-200">
            <Network className="w-3 h-3" />
            other room
          </span>
        )}
        {!from.permalinkUrl && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium tracking-[0.04em] bg-slate-50 text-slate-400 border border-slate-200">
            <Lock className="w-3 h-3" />
            in a private deliberation
          </span>
        )}
      </div>
    </li>
  );
}

function Column({
  title,
  count,
  edges,
  emptyLabel,
}: {
  title: string;
  count: number;
  edges: CitedByEdge[];
  emptyLabel: string;
}) {
  return (
    <div className="flex-1 min-w-[240px]">
      <h4 className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-600 mb-2">
        {title} ({count})
      </h4>
      {edges.length === 0 ? (
        <p className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl px-4 py-3">
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {edges.map((e, i) => (
            <CiterRow key={`${e.via}:${e.from.id}:${i}`} edge={e} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ExternalCitations({
  items,
  unreviewedCount,
}: {
  items: ExternalCitationView[];
  unreviewedCount: number;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-5 pt-4 border-t border-slate-200/70">
      <h4 className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-600 mb-2 flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5" />
        From the web ({items.length})
      </h4>
      {unreviewedCount > 0 && (
        <p className="text-[11px] text-slate-400 mb-2.5 leading-relaxed">
          Verified backlinks. Unreviewed ones are shown but are not counted in the
          cited-by total until a moderator marks them trusted.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((x) => (
          <li
            key={x.id}
            className="flex items-center gap-2 border border-slate-200/70 bg-white/40 rounded-xl px-4 py-2.5"
          >
            <a
              href={x.sourceUrl}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
            >
              <span className="block text-sm text-slate-800 truncate">
                {x.title || x.sourceUrl}
              </span>
              <span className="block text-xs text-slate-400 truncate">{x.sourceDomain}</span>
            </a>
            <span
              className={`inline-flex items-center flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.06em] uppercase ${
                x.trustState === "trusted"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {x.trustState === "trusted" ? "trusted" : "unreviewed"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CitedBySection({ result }: { result: CitedByResult }) {
  const { counts, edges } = result;
  const buildsOn = edges.filter((e) => e.kind !== "contests");
  const contests = edges.filter((e) => e.kind === "contests");
  const buildsOnCount =
    counts.byKind.supports + counts.byKind["builds-on"] + counts.byKind.reuses;

  const summary =
    counts.total === 0
      ? "No one has cited this argument yet."
      : `Cited by ${counts.total} · ${counts.contests} contest${
          counts.contests === 1 ? "" : "s"
        }${counts.crossDeliberation ? ` · ${counts.crossDeliberation} from other rooms` : ""}`;

  return (
    <section className="rounded-2xl p-6 mb-6 panelv2">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-slate-500/10 to-slate-600/15 text-slate-600">
          <Network className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-[12px] font-bold tracking-[0.1em] uppercase text-slate-700">
          Cited by
        </h3>
      </div>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">{summary}</p>

      {edges.length === 0 && result.external.length === 0 ? (
        <p className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl px-4 py-4 leading-relaxed">
          No arguments cite this one yet — no one has built on or contested it.
          That is an absence of engagement, not a finding of soundness. Build on
          or contest it on Isonomia to change that.
        </p>
      ) : (
        <>
          {edges.length > 0 && (
            <div className="flex gap-6 flex-wrap">
              <Column
                title="Builds on this"
                count={buildsOnCount}
                edges={buildsOn}
                emptyLabel="Nothing builds on this yet."
              />
              <Column
                title="Contests this"
                count={counts.contests}
                edges={contests}
                emptyLabel="No contest on file yet."
              />
            </div>
          )}
          <ExternalCitations
            items={result.external}
            unreviewedCount={counts.externalUnreviewed}
          />
        </>
      )}

      {result.truncated && (
        <p className="text-[11px] text-slate-400 mt-3">
          Showing the most recent citations; more exist than are listed here.
        </p>
      )}
    </section>
  );
}
