import { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolvePermalink } from "@/lib/citations/permalinkService";
import {
  buildArgumentAttestation,
  type ArgumentAttestation,
} from "@/lib/citations/argumentAttestation";
import {
  buildArgumentJsonLd,
  buildCitationMetaTags,
} from "@/lib/citations/argumentJsonLd";
import {
  toApa,
  toMla,
  toChicago,
  toBibTeX,
  toRis,
  toCslJson,
} from "@/lib/citation/formats";
import CitationExportWidget from "@/components/citation/CitationExportWidget";
import AnsweredCriticalQuestions, {
  type AnsweredCriticalQuestion,
} from "@/components/citation/AnsweredCriticalQuestions";
import PendingCriticalQuestions, {
  type PendingCriticalQuestion,
} from "@/components/citation/PendingCriticalQuestions";
import DialecticalStatusStrip from "@/components/citation/DialecticalStatusStrip";
import CitedBySection from "@/components/citation/CitedBySection";
import { getArgumentCitedBy } from "@/lib/citation/citedBy";
import ChallengesAndResponses from "@/components/citation/ChallengesAndResponses";
import ChallengeAnchorChip from "@/components/citation/ChallengeAnchorChip";
import { buildDialecticalLayer } from "@/lib/citations/argumentDialectic";
import { prisma } from "@/lib/prismaclient";
import {
  Scale,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  BookOpen,
  Code,
  Layers,
  ExternalLink,
  Circle,
  ListTree,
} from "lucide-react";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ identifier: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

/**
 * Track A.1 — content negotiation.
 *
 * Browsers asking for HTML get the page; AI agents and JSON-LD consumers
 * asking for `application/ld+json` (or anyone passing `?format=aif|jsonld|attestation`)
 * get redirected to the machine-citable representation at /api/a/[id]/aif.
 */
function prefersJsonLd(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  const accept = acceptHeader.toLowerCase();
  // Only treat as JSON-LD preference when *not* asking for HTML at all
  if (accept.includes("text/html")) return false;
  return (
    accept.includes("application/ld+json") ||
    accept.includes("application/json") ||
    accept.includes("application/aif+json")
  );
}

function parseFormatParam(
  raw: string | string[] | undefined,
): "aif" | "jsonld" | "attestation" | null {
  const v = (Array.isArray(raw) ? raw[0] : raw || "").toLowerCase();
  if (v === "aif") return "aif";
  if (v === "jsonld" || v === "json-ld" || v === "rich") return "jsonld";
  if (v === "attestation" || v === "envelope") return "attestation";
  return null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { identifier } = await params;

  const resolved = await resolvePermalink(identifier);
  let argumentId = identifier;
  if (resolved) argumentId = resolved.argumentId;

  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      text: true,
      conclusion: { select: { text: true } },
      deliberation: { select: { title: true } },
    },
  });

  if (!argument) {
    return { title: "Argument not found — Isonomia" };
  }

  const conclusionText = argument.conclusion?.text ?? null;
  // Keep og:title within the ~60-char sweet spot (incl. the " — Isonomia"
  // suffix) so X / LinkedIn don't truncate it; description within ~155 so
  // social cards render cleanly on mobile.
  const titleSource = conclusionText ?? argument.text;
  const title =
    titleSource.length > 48 ? `${titleSource.slice(0, 48)}…` : titleSource;
  const description =
    argument.text.length > 155
      ? `${argument.text.slice(0, 155)}…`
      : argument.text;

  const ogImageUrl = `${BASE_URL}/api/og/argument/${identifier}`;
  const embedUrl = `${BASE_URL}/embed/argument/${identifier}`;
  const canonicalUrl = `${BASE_URL}/a/${identifier}`;
  const aifUrl = `${BASE_URL}/api/a/${identifier}/aif`;

  return {
    title: `${title} — Isonomia`,
    description,
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: canonicalUrl,
      types: {
        "application/json+oembed": `${BASE_URL}/api/oembed?url=${encodeURIComponent(
          embedUrl,
        )}`,
        "application/ld+json": `${aifUrl}?format=aif`,
        "application/json": `${aifUrl}?format=attestation`,
      },
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: `${title} — Isonomia`,
      description,
      siteName: "Isonomia",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Isonomia`,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ArgumentPage({
  params,
  searchParams,
}: PageProps) {
  const { identifier } = await params;
  const sp = (await searchParams) || {};

  // ---- Track A.1: content negotiation ----
  // Explicit ?format= query wins over Accept-header sniffing.
  const explicitFormat = parseFormatParam(sp.format);
  if (explicitFormat) {
    redirect(`${BASE_URL}/api/a/${identifier}/aif?format=${explicitFormat}`);
  }
  // Note: headers() is async in Next.js 15 but compatible when awaited.
  const h = await headers();
  if (prefersJsonLd(h.get("accept"))) {
    redirect(`${BASE_URL}/api/a/${identifier}/aif?format=aif`);
  }

  const resolved = await resolvePermalink(identifier);
  let argumentId = identifier;
  if (resolved) argumentId = resolved.argumentId;

  // Build the attestation envelope in parallel with the page-render query;
  // we still hydrate the page from the existing fetch (richer relations) but
  // the JSON-LD now derives from the canonical attestation primitive.
  const attestationPromise: Promise<ArgumentAttestation | null> =
    buildArgumentAttestation(argumentId, identifier);

  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    select: {
      id: true,
      text: true,
      confidence: true,
      conclusion: {
        select: {
          id: true,
          text: true,
          moid: true,
          ClaimEvidence: {
            select: { id: true, title: true, uri: true, citation: true },
            take: 10,
          },
        },
      },
      premises: {
        select: {
          isImplicit: true,
          claim: {
            select: {
              id: true,
              text: true,
              moid: true,
              ClaimEvidence: {
                select: { id: true, title: true, uri: true, citation: true },
                take: 5,
              },
            },
          },
        },
        take: 10,
      },
      argumentSchemes: {
        select: {
          isPrimary: true,
          scheme: {
            select: { id: true, name: true, title: true, summary: true },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { order: "asc" }],
        take: 3,
      },
      deliberation: { select: { id: true, title: true } },
      permalink: {
        select: { shortCode: true, permalinkUrl: true, accessCount: true },
      },
    },
  });

  const canonicalUrl = `${BASE_URL}/a/${identifier}`;
  const embedUrl = `${BASE_URL}/embed/argument/${identifier}`;

  if (!argument) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="max-w-md mx-auto px-6 py-32 text-center">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 mb-4">
            <Scale className="w-6 h-6 text-slate-400" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Argument not found
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            This argument may have been removed or the link is invalid.
          </p>
          <Link
            href={BASE_URL}
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            ← Back to Isonomia
          </Link>
        </div>
      </main>
    );
  }

  const confidence =
    argument.confidence !== null && argument.confidence !== undefined
      ? Math.round(argument.confidence * 100)
      : null;

  const primaryScheme =
    argument.argumentSchemes.find((s) => s.isPrimary) ||
    argument.argumentSchemes[0];

  // ---- Track A.2: rich composite JSON-LD via attestation envelope ----
  // Falls back to a minimal CreativeWork node if attestation building failed
  // (defensive — should not happen in practice).
  const attestation = await attestationPromise;
  const jsonLd = attestation
    ? buildArgumentJsonLd(attestation)
    : {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        url: canonicalUrl,
        name: argument.conclusion?.text
          ? `Argument: ${argument.conclusion.text.slice(0, 100)}`
          : "Argument",
        text: argument.text,
      };

  const citationMetaTags = attestation
    ? buildCitationMetaTags(attestation)
    : [];

  // ---- Answered critical questions ----------------------------------------
  // The attestation aggregate carries each answered CQ's question text +
  // cqStatusId (primary scheme). Join those to the canonical CQResponse to
  // surface the actual answer body + sources. Best-effort: a CQ marked
  // satisfied without a canonical response (e.g. legacy/deprecated grounds) is
  // skipped so the section never shows an empty answer.
  //
  // A CQ that was answered and is now contested moves to `statusEnum=DISPUTED`,
  // which the aggregate buckets under `unanswered` (Challenging-Answered-CQ
  // §11.6). Those still carry a canonical answer, so we fold them into this
  // card too — the component renders the amber "Disputed" badge + challenge
  // ledger for them.
  const answeredCqAggregate = [
    ...(attestation?.criticalQuestions?.answered ?? []),
    ...(attestation?.criticalQuestions?.unanswered ?? []).filter(
      (cq) => cq.cqStatusEnum === "DISPUTED",
    ),
  ];
  let answeredCriticalQuestions: AnsweredCriticalQuestion[] = [];
  if (answeredCqAggregate.length > 0) {
    const answeredStatusIds = answeredCqAggregate
      .map((cq) => cq.cqStatusId)
      .filter((id): id is string => !!id);
    if (answeredStatusIds.length > 0) {
      const statusRows = await prisma.cQStatus.findMany({
        where: { id: { in: answeredStatusIds } },
        select: {
          id: true,
          groundsText: true,
          canonicalResponse: {
            select: {
              groundsText: true,
              sourceUrls: true,
              createdAt: true,
            },
          },
        },
      });
      const rowById = new Map(statusRows.map((r) => [r.id, r]));
      answeredCriticalQuestions = answeredCqAggregate
        .map((cq): AnsweredCriticalQuestion | null => {
          const row = cq.cqStatusId ? rowById.get(cq.cqStatusId) : undefined;
          const answer =
            row?.canonicalResponse?.groundsText ?? row?.groundsText ?? null;
          if (!answer) return null;
          return {
            cqKey: cq.cqKey,
            question: cq.text,
            answer,
            sourceUrls: row?.canonicalResponse?.sourceUrls ?? [],
            schemeKey: cq.schemeKey,
            answeredAt:
              row?.canonicalResponse?.createdAt?.toISOString() ?? null,
            cqStatusEnum: cq.cqStatusEnum,
            challengeCount: cq.challengeCount,
            argumentId,
            cqRequiresEvidence: cq.cqRequiresEvidence,
            cqBurden: cq.cqBurden,
            answerSelfCanonical: cq.answerSelfCanonical,
            answerAuthorKind: cq.answerAuthorKind,
          };
        })
        .filter((cq): cq is AnsweredCriticalQuestion => cq !== null);
    }
  }

  // ---- Pending critical questions -----------------------------------------
  // The outstanding challenges the argument's scheme must still withstand:
  // everything the aggregate buckets as partially-answered or unanswered,
  // minus DISPUTED (those carry a canonical answer and are shown in the
  // answered card above). These have no *canonical* answer yet, but a
  // partially-answered / under-review CQ may carry an in-progress draft answer
  // (`CQStatus.groundsText` or a non-canonical `CQResponse`) — surface it so
  // readers can see the work in flight.
  const pendingCqAggregate = [
    ...(attestation?.criticalQuestions?.partiallyAnswered ?? []),
    ...(attestation?.criticalQuestions?.unanswered ?? []).filter(
      (cq) => cq.cqStatusEnum !== "DISPUTED",
    ),
  ];
  const pendingAnswerByStatusId = new Map<
    string,
    { answer: string | null; sourceUrls: string[] }
  >();
  const pendingStatusIds = pendingCqAggregate
    .map((cq) => cq.cqStatusId)
    .filter((id): id is string => !!id);
  if (pendingStatusIds.length > 0) {
    const pendingStatusRows = await prisma.cQStatus.findMany({
      where: { id: { in: pendingStatusIds } },
      select: {
        id: true,
        canonicalResponse: {
          select: { groundsText: true, sourceUrls: true },
        },
        // The pending draft answer lives on a non-canonical CQResponse (the MCP
        // `answer_critical_question` flow writes CQResponse, not the deprecated
        // CQStatus.groundsText). Pull the newest PENDING response as the draft.
        responses: {
          where: { responseStatus: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { groundsText: true, sourceUrls: true },
        },
      },
    });
    for (const row of pendingStatusRows) {
      const draft = row.canonicalResponse ?? row.responses[0] ?? null;
      pendingAnswerByStatusId.set(row.id, {
        answer: draft?.groundsText ?? null,
        sourceUrls: draft?.sourceUrls ?? [],
      });
    }
  }
  // ---- Dialectical layer -----------------------------------------------------
  // The filed attacks + their responses that live on the deliberation graph.
  // Standing / depth are read from the attestation's dialecticalStatus (never
  // recomputed here). Built only when the attestation resolved. Built before
  // the pending-CQ list so a filed attack that instantiates a latent CQ can be
  // cross-referenced onto that CQ card (spec §6.2).
  const dialectical = attestation
    ? await buildDialecticalLayer({
        argumentId,
        deliberationId: argument.deliberation.id,
        conclusionClaimId: argument.conclusion?.id ?? null,
        premises: argument.premises.map((p, i) => ({
          claimId: p.claim.id,
          index: i,
          label: p.claim.text,
        })),
        dialecticalStatus: attestation.dialecticalStatus,
      })
    : null;

  // Anchor lookups: which thread to scroll to from each targeted node.
  const rebutThread = dialectical?.threads.find((t) => t.attackType === "REBUT");
  const rebutCount =
    dialectical?.threads.filter((t) => t.attackType === "REBUT").length ?? 0;
  const undercutThread = dialectical?.threads.find(
    (t) => t.attackType === "UNDERCUT",
  );
  const undercutCount =
    dialectical?.threads.filter((t) => t.attackType === "UNDERCUT").length ?? 0;
  const undermineByPremiseIndex = new Map<
    number,
    { threadId: string; count: number }
  >();
  for (const t of dialectical?.threads ?? []) {
    if (t.attackType !== "UNDERMINE" || t.target.premiseIndex === undefined)
      continue;
    const existing = undermineByPremiseIndex.get(t.target.premiseIndex);
    if (existing) {
      existing.count += 1;
    } else {
      undermineByPremiseIndex.set(t.target.premiseIndex, {
        threadId: t.id,
        count: 1,
      });
    }
  }

  // CQ ↔ attack cross-reference: a latent CQ that a filed attack instantiates
  // (spec §6.2). First matching thread wins the back-link.
  const threadIdByInstantiatedCqKey = new Map<string, string>();
  for (const t of dialectical?.threads ?? []) {
    if (t.instantiatesCqKey && !threadIdByInstantiatedCqKey.has(t.instantiatesCqKey)) {
      threadIdByInstantiatedCqKey.set(t.instantiatesCqKey, t.id);
    }
  }

  const pendingCriticalQuestions: PendingCriticalQuestion[] =
    pendingCqAggregate.map((cq) => {
      const draft = cq.cqStatusId
        ? pendingAnswerByStatusId.get(cq.cqStatusId)
        : undefined;
      return {
        cqKey: cq.cqKey,
        question: cq.text,
        schemeKey: cq.schemeKey,
        status: cq.status,
        premiseType: cq.premiseType,
        isSchemeRequired: cq.isSchemeRequired,
        answer: draft?.answer ?? null,
        sourceUrls: draft?.sourceUrls ?? [],
        challengedThreadId:
          threadIdByInstantiatedCqKey.get(cq.cqKey) ?? null,
      };
    });

  const iframeEmbed = `<iframe src="${embedUrl}" width="600" height="400" frameborder="0" style="border:1px solid #e5e7eb;border-radius:8px;" title="Isonomia Argument" loading="lazy"></iframe>`;

  // ---- Phase 10a: cited-by graph -------------------------------------------
  // Composed in-process (no HTTP hop) exactly like the rest of the page.
  // includeStanding is affordable here since the page is already cached.
  const citedBy = await getArgumentCitedBy(argument.id, {
    limit: 20,
    includeStanding: true,
  }).catch(() => null);

  return (
    <main className="min-h-screen  bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* JSON-LD (rich composite: Schema.org + AIF + attestation envelope) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Citation meta tags for Zotero / Google Scholar / scholarly tooling */}
      {citationMetaTags.map((tag) => (
        <meta key={tag.name} name={tag.name} content={tag.content} />
      ))}

      {/* Phase 10a (10.6) — Webmention endpoint: external pages that link this
          argument can notify us, and the backlink becomes an external citation. */}
      <link rel="webmention" href={`${BASE_URL}/api/webmention`} />

      {/* Track A.1 — alternate machine-citable representations */}
      <link
        rel="alternate"
        type="application/ld+json"
        href={`${BASE_URL}/api/a/${identifier}/aif?format=aif`}
        title="AIF-JSON-LD subgraph"
      />
      <link
        rel="alternate"
        type="application/ld+json"
        href={`${BASE_URL}/api/a/${identifier}/aif?format=jsonld`}
        title="Rich composite JSON-LD"
      />
      <link
        rel="alternate"
        type="application/json"
        href={`${BASE_URL}/api/a/${identifier}/aif?format=attestation`}
        title="Attestation envelope"
      />

      {/* Track AI-EPI E.1 — citation format alternates (Zotero/citation.js pick these up) */}
      <link
        rel="alternate"
        type="application/vnd.citationstyles.csl+json"
        href={`${BASE_URL}/api/a/${identifier}/cite?format=csl`}
        title="CSL-JSON citation"
      />
      <link
        rel="alternate"
        type="application/x-bibtex"
        href={`${BASE_URL}/api/a/${identifier}/cite?format=bibtex`}
        title="BibTeX citation"
      />
      <link
        rel="alternate"
        type="application/x-research-info-systems"
        href={`${BASE_URL}/api/a/${identifier}/cite?format=ris`}
        title="RIS citation"
      />

      {/* Nav bar */}
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-indigo-300/70">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href={BASE_URL} className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs">I</span>
            </div>
            <span className="font-bold text-slate-900 text-[24px] group-hover:text-indigo-600 transition-colors">
              Isonomia
            </span>
          </a>
          <div className="flex items-center gap-4">
            <a
              href={`${BASE_URL}/deliberations/${argument.deliberation.id}`}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm  text-indigo-600 border-indigo-600 hover:text-indigo-800 hover:bg-slate-100 transition-colors btnv2--ghost"
            >
              View deliberation
            </a>
            <a
              href={`${BASE_URL}/signup`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm  text-white bg-indigo-600 hover:bg-indigo-800 transition-all btnv2--ghost"
            >
              Join & respond
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-6 pb-12">
        {/* Breadcrumb / context */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-widest uppercase bg-gradient-to-r from-indigo-500/10 to-violet-500/10 text-indigo-700 border border-indigo-500/20">
            <Scale className="w-3 h-3" />
            Argument
          </span>
          {argument.deliberation.title && (
            <>
              <span className="text-slate-300">·</span>
              <a
                href={`${BASE_URL}/deliberations/${argument.deliberation.id}`}
                className="text-xs text-slate-600 hover:text-indigo-600 transition-colors"
              >
                {argument.deliberation.title}
              </a>
            </>
          )}
        </div>

        {/* Conclusion claim (hero) */}
        {argument.conclusion && (
          <section className="mb-6  bg-white conclusion-surface rounded-2xl p-6 ">
            <div className="flex items-center mb-2 gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/15 text-indigo-600">
                <Circle className="w-3.5 h-3.5" />
              </div>

              <h2 className="text-[12px] font-bold tracking-[0.12em] uppercase text-slate-700 ">
                Conclusion
              </h2>
              {rebutThread && (
                <span className="ml-auto">
                  <ChallengeAnchorChip
                    attackType="REBUT"
                    threadId={rebutThread.id}
                    count={rebutCount}
                  />
                </span>
              )}
            </div>
            <h1 className="text-xl  font-semibold text-slate-900 mb-2 tracking-tight">
              {argument.conclusion.text}
            </h1>
            {argument.conclusion.moid && (
              <a
                href={`${BASE_URL}/c/${argument.conclusion.moid}`}
                className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                View claim page
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            )}
          </section>
        )}

        {/* Argument core */}
        <section className="rounded-2xl  p-6 mb-6  panelv2">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500/10 to-indigo-500/15 text-sky-600">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-[12px] font-bold tracking-[0.1em] uppercase text-slate-700">
                Argument
              </h2>
              {undercutThread && (
                <ChallengeAnchorChip
                  attackType="UNDERCUT"
                  threadId={undercutThread.id}
                  count={undercutCount}
                />
              )}
            </div>
            {confidence !== null && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    background:
                      confidence >= 70
                        ? "#10b981"
                        : confidence >= 40
                        ? "#f59e0b"
                        : "#ef4444",
                  }}
                />
                {confidence}% confidence
              </div>
            )}
          </div>

          {confidence !== null && (
            <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                style={{ width: `${confidence}%` }}
              />
            </div>
          )}

          <p className="text-[16px] font-medium rounded-lg p-2.5 border border-indigo-200 leading-relaxed text-slate-900 mb-3">
            {argument.text}
          </p>

          {primaryScheme && (
            <div className="flex items-baseline gap-2 px-2.5 py-2.5 bg-slate-50 border border-indigo-200 rounded-lg text-sm">
              <span className="text-indigo-600 font-bold ">⟨ ⟩</span>
              <span className="font-semibold text-slate-700">
                {primaryScheme.scheme.name || primaryScheme.scheme.title}
              </span>
              {primaryScheme.scheme.summary && (
                <span className="text-slate-600 text-xs">
                  {primaryScheme.scheme.summary.slice(0, 120)}
                </span>
              )}
            </div>
          )}
        </section>

        {/* Dialectical status strip — standing + depth, learned before the debate */}
        {/* {dialectical && (
          <DialecticalStatusStrip
            standing={dialectical.standing}
            counts={dialectical.counts}
          />
        )} */}

        {/* Premises */}
        {argument.premises.length > 0 && (
          <section className="rounded-2xl  p-6 mb-6  panelv2">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500/10 to-teal-500/15 text-emerald-600">
                <ListTree className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-[12px] font-bold tracking-[0.1em] uppercase text-slate-700">
                Premises ({argument.premises.length})
              </h3>
            </div>
            <ul className="flex flex-col gap-4">
              {argument.premises.map(({ claim, isImplicit }, premiseIndex) => {
                const premiseEvidence = claim.ClaimEvidence ?? [];
                const undermine = undermineByPremiseIndex.get(premiseIndex);
                return (
                  <li
                    key={claim.id}
                    className="border-[2px] border-indigo-200 bg-slate-50  rounded-lg transition-colors"
                  >
                    <div className="flex items-start gap-2 px-3 py-2.5">
                      {isImplicit && (
                        <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                          unstated
                        </span>
                      )}
                      <span className="text-sm font-medium text-slate-900 flex-1 leading-relaxed">
                        {claim.text}
                      </span>
                      {undermine && (
                        <ChallengeAnchorChip
                          attackType="UNDERMINE"
                          threadId={undermine.threadId}
                          count={undermine.count}
                        />
                      )}
                      {claim.moid && (
                        <a
                          href={`${BASE_URL}/c/${claim.moid}`}
                          className="text-indigo-500 hover:text-indigo-700 flex-shrink-0 mt-0.5"
                          aria-label="View claim page"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    {premiseEvidence.length > 0 && (
                      <div className="px-3 pb-3 pt-2 border-t border-indigo-200/80">
                        <div className="flex items-center gap-1.5 mb-2">
                          <BookOpen className="w-3 h-3 text-sky-600/80" />
                          <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-600">
                            Evidence for this premise ({premiseEvidence.length})
                          </span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {premiseEvidence.map((ev) => (
                            <a
                              key={ev.id}
                              href={ev.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group block px-3 py-2 bg-white hover:bg-sky-50/40 border border-slate-300 hover:border-sky-400 rounded-md min-w-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-[14px] font-semibold text-slate-800 group-hover:text-sky-700 leading-snug break-words flex-1">
                                  {ev.title || ev.uri}
                                </div>
                                <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-sky-500 flex-shrink-0 mt-0.5 transition-colors" />
                              </div>
                              {ev.citation && (
                                <div className="text-[11px] text-slate-600 leading-relaxed mt-1 break-words">
                                  {ev.citation}
                                </div>
                              )}
                              <div className="text-[10px] text-sky-600/80 font-mono truncate mt-0.5">
                                {ev.uri}
                              </div>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Evidence */}
        {argument.conclusion?.ClaimEvidence &&
          argument.conclusion.ClaimEvidence.length > 0 && (
            <section className="rounded-2xl  p-6 mb-6  panelv2">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-sky-500/10 to-blue-500/15 text-sky-600">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-600">
                  Supporting evidence for the conclusion (
                  {argument.conclusion.ClaimEvidence.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                {argument.conclusion.ClaimEvidence.map((ev) => (
                  <a
                    key={ev.id}
                    href={ev.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block px-4 py-3 bg-slate-50 hover:bg-white border border-slate-200 hover:border-sky-400 hover:shadow-sm rounded-xl  min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="text-sm font-semibold text-slate-800 group-hover:text-sky-700 leading-snug break-words flex-1">
                        {ev.title || ev.uri}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-500 flex-shrink-0 mt-0.5 transition-colors" />
                    </div>
                    {ev.citation && (
                      <div className="text-xs text-slate-600 leading-relaxed mb-1.5 break-words">
                        {ev.citation}
                      </div>
                    )}
                    <div className="text-[11px] text-sky-600/80 font-mono truncate">
                      {ev.uri}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}

        {/* Challenges & responses — the threaded dialectical record */}
        {dialectical && (
          <ChallengesAndResponses
            threads={dialectical.threads}
            deliberationUrl={`${BASE_URL}/deliberations/${argument.deliberation.id}`}
          />
        )}

        {/* Answered critical questions */}
        <AnsweredCriticalQuestions items={answeredCriticalQuestions} />

        {/* Pending critical questions */}
        <PendingCriticalQuestions items={pendingCriticalQuestions} />

        {/* Phase 10a — cited-by graph (renders even when empty; honest about absence) */}
        {citedBy && <CitedBySection result={citedBy} />}

        {/* Track AI-EPI E.1 — citation export widget */}
        {attestation && (
          <CitationExportWidget
            isoId={attestation.isoId}
            isoUrl={attestation.isoUrl}
            shortCode={attestation.identifier}
            citeEndpoint={`${BASE_URL}/api/a/${identifier}/cite`}
            citations={{
              apa: toApa(attestation),
              mla: toMla(attestation),
              chicago: toChicago(attestation),
              bibtex: toBibTeX(attestation),
              ris: toRis(attestation),
              csl: JSON.stringify(toCslJson(attestation), null, 2),
            }}
          />
        )}

        {/* Embed code */}
        <section className="rounded-2xl search-surface p-6 mb-6 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-slate-500/10 to-slate-600/15 text-slate-600">
              <Code className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-600">
              Embed this argument
            </h3>
          </div>
          <pre className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-xs font-mono text-slate-700 whitespace-pre-wrap break-all mb-2">
            {iframeEmbed}
          </pre>
          <p className="text-xs text-slate-400">
            Copy and paste into any website or forum that supports HTML.
          </p>
        </section>

        {/* CTA section */}
        <section className="my-6">
          <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 p-6 sm:p-7 flex items-center gap-6 flex-wrap shadow-sm">
            <div className="flex-1 min-w-[200px]">
              <h3 className="text-lg font-bold text-indigo-950 mb-1 tracking-tight">
                Join the deliberation on Isonomia
              </h3>
              <p className="text-sm text-indigo-900/70 leading-relaxed">
                Support, challenge, or extend this argument with structured
                reasoning in Isonomia.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <a
                href={`${BASE_URL}/deliberations/${argument.deliberation.id}`}
                className="inline-flex items-center px-4 py-3 rounded-xl text-[14px] font-semibold text-indigo-700 bg-white/70 hover:bg-white border border-indigo-200 whitespace-nowrap transition-all btnv2"
              >
                View full deliberation
              </a>
              <a
                href={`${BASE_URL}/signup`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[14px] font-semibold bg-indigo-700 text-white btnv2"
              >
                Respond on Isonomia
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex items-center gap-2 text-xs text-slate-400 pt-6 border-t border-slate-200/70">
          <a
            href={BASE_URL}
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Isonomia
          </a>
          <span className="text-slate-300">·</span>
          <span>
            Argument #{argument.permalink?.shortCode ?? argument.id.slice(0, 8)}
          </span>
          {argument.permalink?.accessCount != null && (
            <>
              <span className="text-slate-300">·</span>
              <span>
                {argument.permalink.accessCount} view
                {argument.permalink.accessCount !== 1 ? "s" : ""}
              </span>
            </>
          )}
        </footer>
      </div>
    </main>
  );
}
