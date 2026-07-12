/**
 * Server-rendered card for a single argument search result.
 *
 * Surfaces the substrate-product features (per
 * /memories/repo/isonomia-substrate-product-claim.md): standingState,
 * dialecticalFitness, attestationUrl, and a deep link into counter-arg
 * discovery (`?against={moid}`). Synthesis-quality features are
 * intentionally absent.
 */
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  ShieldOff,
  Circle,
  HelpCircle,
  Layers,
  Activity,
  Sparkles,
  Cross,
  ArrowUpRight,
  Swords,
  FileSignature,
  CrosshairIcon,
  Columns2,
  Network,
} from "lucide-react";
import type { StandingState } from "@/lib/citations/argumentAttestation";

export type SearchResult = {
  argumentId: string;
  permalink: string;
  shortCode: string;
  version: number;
  text: string;
  conclusion: { claimId: string; moid: string | null; text: string } | null;
  scheme: { key: string; name: string | null; title: string | null } | null;
  standingState: StandingState;
  accessCount: number;
  createdAt: string | null;
  attestationUrl: string;
  lexicalCoverage?: { matched: number; outOf: number };
  hybrid?: {
    rrfScore: number;
    sparseRank: number | null;
    denseRank: number | null;
    denseDistance: number | null;
  };
  dialecticalFitness?: number;
  fitnessBreakdown?: Record<string, number> | null;
  /**
   * Phase 5 — counter-citation discovery. Present iff the request
   * passed `include_strongest_counter=1`. `null` is honest: "we looked
   * and there is no structural contester on file."
   */
  strongestCounter?: {
    argumentId: string;
    shortCode: string;
    permalink: string;
    attestationUrl: string;
    conclusion: { claimId: string; moid: string | null; text: string } | null;
    source: "edge" | "conflict" | "edge+conflict";
  } | null;
  /**
   * Phase 10a (10.3) — downstream cited-by summary. Present iff the request
   * passed `include_cited_by=1`. `contests` is surfaced so the card can never
   * present cited-by as pure applause; `total` counts internal + trusted
   * external only (M-1 honesty).
   */
  citedBy?: {
    total: number;
    contests: number;
    buildsOn: number;
    reuses: number;
    supports: number;
    externalTrusted: number;
    strongest: {
      kind: "supports" | "contests" | "builds-on" | "reuses";
      shortCode: string | null;
      permalink: string | null;
      text: string | null;
      standingState: string | null;
    } | null;
  } | null;
};

type Tone = "good" | "warn" | "bad" | "neutral" | "muted";

const STANDING_LABELS: Record<
  StandingState,
  { label: string; tone: Tone; Icon: typeof ShieldCheck }
> = {
  "tested-survived": { label: "Tested · Survived", tone: "good", Icon: ShieldCheck },
  "tested-attacked": { label: "Tested · Under attack", tone: "warn", Icon: AlertTriangle },
  "tested-undermined": { label: "Tested · Undermined", tone: "bad", Icon: ShieldOff },
  "untested-supported": { label: "Untested · Supported", tone: "neutral", Icon: Circle },
  "untested-default": { label: "Untested", tone: "muted", Icon: HelpCircle },
};

const STANDING_TONE_CLASSES: Record<Tone, string> = {
  good: "bg-emerald-50 border-emerald-200 text-emerald-700",
  warn: "bg-amber-50 border-amber-200 text-amber-700",
  bad: "bg-rose-50 border-rose-200 text-rose-700",
  neutral: "bg-sky-50 border-sky-200 text-sky-700",
  muted: "bg-slate-50 border-slate-200 text-slate-600",
};

const CARD_HOVER_BORDER: Record<Tone, string> = {
  good: "hover:border-emerald-300",
  warn: "hover:border-amber-300",
  bad: "hover:border-rose-300",
  neutral: "hover:border-sky-300",
  muted: "hover:border-indigo-300",
};

function truncate(s: string, n: number): string {
  if (!s) return "";
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

export default function ArgumentResultCard({
  result,
}: {
  result: SearchResult;
}) {
  const standing =
    STANDING_LABELS[result.standingState] ?? STANDING_LABELS["untested-default"];
  const StandingIcon = standing.Icon;
  const conclusionText = result.conclusion?.text ?? null;
  const argumentText = result.text;
  const moid = result.conclusion?.moid ?? null;
  const counterHref = moid
    ? `/search/arguments?against=${encodeURIComponent(moid)}`
    : null;

  return (
    <article
      className={`group relative rounded-2xl result-surface hover:border-indigo-600 transition-all p-5 ${CARD_HOVER_BORDER[standing.tone]}`}
    >
      {/* Badge row */}
      <header className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-[0.08em] uppercase ${STANDING_TONE_CLASSES[standing.tone]}`}
        >
          <StandingIcon className="w-3 h-3" />
          {standing.label}
        </span>
        {result.scheme?.key ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-medium text-indigo-700"
            title={result.scheme.title ?? undefined}
          >
            <Layers className="w-3 h-3" />
            {result.scheme.title || result.scheme.name || result.scheme.key}
          </span>
        ) : null}
        {typeof result.dialecticalFitness === "number" ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-200 text-[11px] font-medium text-violet-700"
            title="Dialectical fitness — CQs answered + supports − attacks − conflicts + provenance"
          >
            <Activity className="w-3 h-3" />
            fitness {result.dialecticalFitness.toFixed(2)}
          </span>
        ) : null}
        {result.hybrid ? (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-medium text-slate-600"
            title={`RRF ${result.hybrid.rrfScore.toFixed(3)} · sparse #${result.hybrid.sparseRank ?? "—"} · dense #${result.hybrid.denseRank ?? "—"}`}
          >
            <Columns2 className="w-2.5 h-2.5" />
            hybrid
          </span>
        ) : null}
      </header>

      {conclusionText ? (
        <Link href={`/a/${result.shortCode}`} className="block group/link">
          <h2 className="text-base sm:text-lg font-semibold text-slate-900 group-hover/link:text-indigo-600 leading-snug tracking-tight transition-colors">
            {truncate(conclusionText, 240)}
            <ArrowUpRight className="inline-block w-4 h-4 ml-1 -mt-1 text-slate-300 group-hover/link:text-indigo-500 transition-colors" />
          </h2>
        </Link>
      ) : null}

      {argumentText && argumentText !== conclusionText ? (
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {truncate(argumentText, 320)}
        </p>
      ) : null}

      {result.strongestCounter !== undefined ? (
        result.strongestCounter ? (
          <aside
            className="mt-3 w-full flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200/70"
            title={`Structural contester (${result.strongestCounter.source})`}
          >
            <CrosshairIcon className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 w-full  text-xs leading-relaxed">
              <span className="font-bold tracking-wide uppercase text-[10px] text-rose-700 mr-1.5 whitespace-nowrap">
                Strongest counter:
              </span>
              <Link
                href={`/a/${result.strongestCounter.shortCode}`}
                className="text-slate-700 hover:text-rose-700 hover:underline underline-offset-2"
              >
                {truncate(
                  result.strongestCounter.conclusion?.text ??
                    `/a/${result.strongestCounter.shortCode}`,
                  200,
                )}
              </Link>
            </div>
          </aside>
        ) : (
          <aside
            className="mt-3 w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500"
            title="No structural contester on file"
          >
            <CrosshairIcon className="w-3 h-3 shrink-0" />
            <span className="font-bold tracking-wide uppercase text-[10px] text-slate-500 whitespace-nowrap">
              Strongest counter:
            </span>
            <span className="italic">none on file</span>
          </aside>
        )
      ) : null}

      {result.citedBy !== undefined ? (
        result.citedBy && result.citedBy.total > 0 ? (
          <aside
            className="mt-3 w-full flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/70"
            title="Downstream cited-by (who uses or contests this)"
          >
            <Network className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 text-xs leading-relaxed">
              <span className="font-bold tracking-wide uppercase text-[10px] text-slate-600 mr-1">
                Cited by {result.citedBy.total}
              </span>
              {result.citedBy.contests > 0 ? (
                <span className="text-rose-600 font-semibold mr-1">
                  · {result.citedBy.contests} contest
                  {result.citedBy.contests === 1 ? "" : "s"}
                </span>
              ) : null}
              {result.citedBy.strongest?.shortCode ? (
                <Link
                  href={`/a/${result.citedBy.strongest.shortCode}`}
                  className="text-slate-700 hover:text-indigo-700 hover:underline underline-offset-2"
                >
                  {truncate(
                    result.citedBy.strongest.text ??
                      `/a/${result.citedBy.strongest.shortCode}`,
                    140,
                  )}
                </Link>
              ) : null}
            </div>
          </aside>
        ) : (
          <aside
            className="mt-3 w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-[11px] text-slate-500"
            title="No downstream citations on file"
          >
            <Network className="w-3 h-3 shrink-0" />
            <span className="font-bold tracking-wide uppercase text-[10px] text-slate-500 whitespace-nowrap">
              Cited by:
            </span>
            <span className="italic">none on file yet</span>
          </aside>
        )
      ) : null}

      <footer className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
        <Link
          href={`/a/${result.shortCode}`}
          className="font-mono text-indigo-600 hover:text-indigo-700 hover:underline underline-offset-2"
        >
          /a/{result.shortCode}
        </Link>
        <span className="text-slate-300">·</span>
        <span>v{result.version}</span>
        <span className="text-slate-300">·</span>
        <a
          href={result.attestationUrl}
          rel="nofollow noopener"
          title="Compact citation envelope (JSON)"
          className="inline-flex items-center gap-1 text-slate-600 hover:text-indigo-600 hover:underline underline-offset-2"
        >
          <FileSignature className="w-3 h-3" />
          attestation
        </a>
        {counterHref ? (
          <>
            <span className="text-slate-300">·</span>
            <Link
              href={counterHref}
              title="Search arguments that contest this conclusion"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-rose-600 hover:underline underline-offset-2"
            >
              <Swords className="w-3 h-3" />
              counter-arguments
            </Link>
          </>
        ) : null}
        {result.lexicalCoverage ? (
          <>
            <span className="text-slate-300">·</span>
            <span>
              {result.lexicalCoverage.matched}/{result.lexicalCoverage.outOf} terms
            </span>
          </>
        ) : null}
      </footer>
    </article>
  );
}
