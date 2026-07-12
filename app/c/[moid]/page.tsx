import { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prismaclient";
import {
  getClaimPermalinkUrl,
  getClaimOgImageUrl,
  getClaimOembedUrl,
  getClaimEmbedUrl,
  generateClaimIframeCode,
} from "@/lib/citations/claimPermalinkService";
import { GET as stancesGET } from "@/app/api/v3/claims/[moid]/stances/route";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ moid: string }>;
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { moid } = await params;

  const claim = await prisma.claim.findUnique({
    where: { moid },
    select: { text: true },
  });

  if (!claim) {
    return { title: "Claim not found — Isonomia" };
  }

  const title = claim.text.length > 80
    ? claim.text.slice(0, 80) + "…"
    : claim.text;

  const canonicalUrl = getClaimPermalinkUrl(moid);
  const ogImageUrl = getClaimOgImageUrl(moid);
  const embedUrl = getClaimEmbedUrl(moid);

  return {
    title: `${title} — Isonomia`,
    description: claim.text.slice(0, 200),
    metadataBase: new URL(BASE_URL),
    alternates: {
      canonical: canonicalUrl,
      types: {
        "application/json+oembed": getClaimOembedUrl(moid),
      },
    },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: `${title} — Isonomia`,
      description: claim.text.slice(0, 200),
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
      description: claim.text.slice(0, 200),
      images: [ogImageUrl],
    },
  };
}

export default async function ClaimPage({ params }: PageProps) {
  const { moid } = await params;

  const claim = await prisma.claim.findUnique({
    where: { moid },
    select: {
      id: true,
      text: true,
      moid: true,
      deliberationId: true,
      deliberation: { select: { id: true, title: true } },
      ClaimEvidence: {
        select: { id: true, title: true, uri: true, citation: true },
        take: 10,
      },
      arguments: {
        select: {
          id: true,
          text: true,
          confidence: true,
          permalink: { select: { shortCode: true } },
        },
        take: 10,
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          attacksReceived: true,
          defensesFor: true,
          arguments: true,
        },
      },
    },
  });

  const canonicalUrl = getClaimPermalinkUrl(moid);

  if (!claim) {
    return (
      <main className="page">
        <style>{pageStyles()}</style>
        <div className="not-found">
          <h1>Claim not found</h1>
          <p>This claim may have been removed or the link is invalid.</p>
          <Link href={BASE_URL}>← Back to Isonomia</Link>
        </div>
      </main>
    );
  }

  const iframeEmbed = generateClaimIframeCode(moid);

  const supportCount = claim._count.defensesFor;
  const challengeCount = claim._count.attacksReceived;
  const argumentCount = claim._count.arguments;

  // Phase 6 — fetch dual-stance view (for/against) so the claim page
  // doesn't visually present only the supporting side. Failure is
  // non-fatal: the existing supporters section still renders and the
  // dual-column block is simply omitted.
  type StanceResult = {
    argumentId: string;
    shortCode: string;
    permalink: string;
    text: string;
    conclusion: { text: string } | null;
    standingState: string;
    dialecticalFitness?: number;
  };
  let stancesData:
    | { for: StanceResult[]; against: StanceResult[] }
    | null = null;
  try {
    const stancesReq = new NextRequest(
      `http://localhost/api/v3/claims/${encodeURIComponent(moid)}/stances?limit=10&sort=dialectical_fitness`,
    );
    const stancesRes = await stancesGET(stancesReq, {
      params: Promise.resolve({ moid }),
    });
    if (stancesRes.ok) {
      const body = (await stancesRes.json()) as {
        for?: StanceResult[];
        against?: StanceResult[];
      };
      stancesData = {
        for: Array.isArray(body.for) ? body.for : [],
        against: Array.isArray(body.against) ? body.against : [],
      };
    }
  } catch {
    stancesData = null;
  }

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Claim",
    url: canonicalUrl,
    text: claim.text,
    identifier: moid,
    provider: {
      "@type": "Organization",
      name: "Isonomia",
      url: BASE_URL,
    },
  };

  return (
    <main className="page">
      <style>{pageStyles()}</style>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Nav */}
      <nav className="topnav">
        <a href={BASE_URL} className="brand">
          <span className="brand-mesh">Isonomia</span>
          <span className="brand-sub">Digital Agora</span>
        </a>
        <div className="nav-actions">
          {claim.deliberation && (
            <a
              href={`${BASE_URL}/deliberations/${claim.deliberation.id}`}
              className="btn btn-ghost"
            >
              View deliberation
            </a>
          )}
          <a href={`${BASE_URL}/signup`} className="btn btn-primary">
            Respond on Isonomia
          </a>
        </div>
      </nav>

      <div className="content">

        {/* Header badges */}
        <div className="breadcrumb">
          <span className="badge-type">Claim</span>
          <span className="badge-moid">{moid}</span>
          {claim.deliberation?.title && (
            <>
              <span className="breadcrumb-sep">·</span>
              <a
                href={`${BASE_URL}/deliberations/${claim.deliberation.id}`}
                className="breadcrumb-link"
              >
                {claim.deliberation.title}
              </a>
            </>
          )}
        </div>

        {/* Claim hero */}
        <section className="claim-hero">
          <h1 className="claim-text">{claim.text}</h1>

          {/* Engagement stats */}
          {(argumentCount > 0 || supportCount > 0 || challengeCount > 0) && (
            <div className="stats-row">
              {argumentCount > 0 && (
                <span className="stat">
                  {argumentCount} argument{argumentCount !== 1 ? "s" : ""}
                </span>
              )}
              {supportCount > 0 && (
                <span className="stat stat-support">
                  ↑ {supportCount} support{supportCount !== 1 ? "s" : ""}
                </span>
              )}
              {challengeCount > 0 && (
                <span className="stat stat-challenge">
                  ↓ {challengeCount} challenge{challengeCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </section>

        {/* Evidence */}
        {claim.ClaimEvidence.length > 0 && (
          <section className="card-section">
            <h3 className="card-section-title">
              Evidence ({claim.ClaimEvidence.length})
            </h3>
            <div className="evidence-grid">
              {claim.ClaimEvidence.map((ev) => (
                <a
                  key={ev.id}
                  href={ev.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="evidence-card"
                >
                  <div className="evidence-title">{ev.title || ev.uri}</div>
                  {ev.citation && (
                    <div className="evidence-citation">{ev.citation}</div>
                  )}
                  <div className="evidence-uri">{ev.uri}</div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Phase 6 — Dialectical view (dual columns: for / against) */}
        {stancesData && (stancesData.for.length > 0 || stancesData.against.length > 0) && (
          <section className="card-section">
            <h3 className="card-section-title">Dialectical view</h3>
            <p className="stances-hint">
              Public arguments concluding to this claim, and structural counter-arguments
              that contest it. Each side may be empty — that is honest, not absent.
            </p>
            <div className="stances-grid">
              <div className="stances-col stances-for">
                <h4 className="stances-col-title">
                  Arguments for{" "}
                  <span className="stances-count">({stancesData.for.length})</span>
                </h4>
                {stancesData.for.length === 0 ? (
                  <p className="stances-empty">No public arguments concluding to this claim are on file.</p>
                ) : (
                  <ul className="stances-list">
                    {stancesData.for.map((r) => (
                      <li key={r.argumentId} className="stances-item">
                        <a href={`${BASE_URL}/a/${r.shortCode}`} className="stances-link">
                          {(r.conclusion?.text ?? r.text ?? "").slice(0, 200)}
                        </a>
                        <span className={`stances-standing tone-${r.standingState}`}>
                          {r.standingState}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="stances-col stances-against">
                <h4 className="stances-col-title">
                  Arguments against{" "}
                  <span className="stances-count">({stancesData.against.length})</span>
                </h4>
                {stancesData.against.length === 0 ? (
                  <p className="stances-empty">No structural counter-arguments are on file.</p>
                ) : (
                  <ul className="stances-list">
                    {stancesData.against.map((r) => (
                      <li key={r.argumentId} className="stances-item">
                        <a href={`${BASE_URL}/a/${r.shortCode}`} className="stances-link">
                          {(r.conclusion?.text ?? r.text ?? "").slice(0, 200)}
                        </a>
                        <span className={`stances-standing tone-${r.standingState}`}>
                          {r.standingState}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <p className="stances-foot">
              <a
                href={`${BASE_URL}/search/arguments?against=${encodeURIComponent(moid)}`}
                className="stances-more"
              >
                Browse all counter-arguments to this claim →
              </a>
            </p>
          </section>
        )}

        {/* Arguments for this claim */}
        {claim.arguments.length > 0 && (
          <section className="card-section">
            <h3 className="card-section-title">
              Arguments ({argumentCount})
            </h3>
            <div className="argument-list">
              {claim.arguments.map((arg) => {
                const argConfidence =
                  arg.confidence !== null && arg.confidence !== undefined
                    ? Math.round(arg.confidence * 100)
                    : null;
                const argUrl = arg.permalink?.shortCode
                  ? `${BASE_URL}/a/${arg.permalink.shortCode}`
                  : null;

                return (
                  <div key={arg.id} className="argument-card">
                    <p className="argument-text">{arg.text}</p>
                    <div className="argument-meta">
                      {argConfidence !== null && (
                        <span className="arg-confidence">{argConfidence}% confidence</span>
                      )}
                      {argUrl && (
                        <a href={argUrl} className="arg-view-link">
                          View argument →
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="cta-section">
          <div className="cta-inner">
            <div className="cta-text">
              <h3 className="cta-heading">Respond to this claim on Isonomia</h3>
              <p className="cta-sub">
                Build or challenge arguments with structured reasoning in the
                Digital Agora.
              </p>
            </div>
            <div className="cta-buttons">
              <a href={`${BASE_URL}/signup`} className="btn btn-primary cta-btn">
                Join & respond
              </a>
            </div>
          </div>
        </section>

        {/* Embed */}
        <section className="embed-section">
          <h3 className="card-section-title">Embed this claim</h3>
          <pre className="embed-code">{iframeEmbed}</pre>
          <p className="embed-hint">
            Copy and paste into any website or forum that supports HTML.
          </p>
        </section>

        {/* Footer */}
        <footer className="page-footer">
          <a href={BASE_URL} className="footer-brand">
            Isonomia
          </a>
          <span className="footer-sep">·</span>
          <span className="footer-meta">{moid}</span>
        </footer>
      </div>
    </main>
  );
}

function pageStyles(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }

    body {
      margin: 0;
      padding: 0;
      background: #f8fafc;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      font-size: 15px;
      line-height: 1.6;
    }

    a { color: inherit; }
    .page { min-height: 100vh; }

    .topnav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: #fff;
      border-bottom: 1px solid #e2e8f0;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .brand {
      display: flex;
      align-items: baseline;
      gap: 6px;
      text-decoration: none;
    }

    .brand-mesh {
      font-size: 18px;
      font-weight: 800;
      color: #6366f1;
      letter-spacing: -0.03em;
    }

    .brand-sub {
      font-size: 13px;
      color: #94a3b8;
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      border: none;
      transition: background 0.15s;
    }

    .btn-ghost {
      background: transparent;
      color: #475569;
    }

    .btn-ghost:hover { background: #f1f5f9; color: #1e293b; }

    .btn-primary {
      background: #6366f1;
      color: #fff;
    }

    .btn-primary:hover { background: #4f46e5; }

    .content {
      max-width: 760px;
      margin: 0 auto;
      padding: 40px 24px 80px;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .badge-type {
      display: inline-flex;
      align-items: center;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      background: #eef2ff;
      color: #4338ca;
    }

    .badge-moid {
      font-family: monospace;
      font-size: 11px;
      color: #94a3b8;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .breadcrumb-sep { color: #cbd5e1; }

    .breadcrumb-link {
      font-size: 13px;
      color: #64748b;
      text-decoration: none;
    }

    .breadcrumb-link:hover { color: #6366f1; text-decoration: underline; }

    .claim-hero {
      margin-bottom: 28px;
    }

    .claim-text {
      font-size: 24px;
      font-weight: 700;
      line-height: 1.35;
      margin: 0 0 16px 0;
      color: #0f172a;
    }

    .stats-row {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .stat { font-size: 13px; color: #64748b; }
    .stat-support { color: #10b981; font-weight: 600; }
    .stat-challenge { color: #ef4444; font-weight: 600; }

    .card-section {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 16px;
    }

    .card-section-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #94a3b8;
      margin: 0 0 14px 0;
    }

    .evidence-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .evidence-card {
      display: block;
      padding: 12px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      text-decoration: none;
      transition: border-color 0.15s;
    }

    .evidence-card:hover { border-color: #6366f1; }

    .evidence-title {
      font-size: 13px;
      font-weight: 500;
      color: #1e293b;
      margin-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .evidence-citation { font-size: 12px; color: #6b7280; margin-bottom: 2px; }

    .evidence-uri {
      font-size: 11px;
      color: #94a3b8;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .argument-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .argument-card {
      padding: 14px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }

    .argument-text {
      font-size: 14px;
      line-height: 1.6;
      color: #374151;
      margin: 0 0 10px 0;
    }

    .argument-meta {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .arg-confidence { font-size: 12px; color: #6366f1; font-weight: 600; }

    .arg-view-link {
      font-size: 12px;
      color: #6366f1;
      text-decoration: none;
    }

    .arg-view-link:hover { text-decoration: underline; }

    .not-found {
      max-width: 480px;
      margin: 120px auto;
      padding: 0 24px;
      text-align: center;
    }

    .not-found h1 { font-size: 22px; margin-bottom: 8px; }
    .not-found p { color: #64748b; margin-bottom: 20px; }
    .not-found a { color: #6366f1; text-decoration: none; }

    .cta-section { margin: 24px 0; }

    .cta-inner {
      background: linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%);
      border: 1px solid #c7d2fe;
      border-radius: 16px;
      padding: 28px;
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }

    .cta-text { flex: 1; min-width: 200px; }

    .cta-heading {
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 6px 0;
      color: #1e1b4b;
    }

    .cta-sub { font-size: 14px; color: #4c1d95; opacity: 0.7; margin: 0; }

    .cta-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
    .cta-btn { white-space: nowrap; }

    .embed-section {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 24px;
    }

    .embed-code {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 12px;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      white-space: pre-wrap;
      word-break: break-all;
      color: #374151;
      margin: 0 0 10px 0;
    }

    .embed-hint { font-size: 12px; color: #94a3b8; margin: 0; }

    .page-footer {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      color: #94a3b8;
      padding-top: 24px;
    }

    .footer-brand {
      color: #6366f1;
      text-decoration: none;
      font-weight: 600;
    }

    .footer-sep { color: #e2e8f0; }
    .footer-meta { color: #94a3b8; }

    /* Phase 6 — dialectical view (dual columns) */
    .stances-hint {
      color: #64748b;
      font-size: 13px;
      margin: 0 0 16px 0;
    }
    .stances-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 720px) {
      .stances-grid { grid-template-columns: 1fr; }
    }
    .stances-col {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      background: #fafbfc;
    }
    .stances-for { border-left: 3px solid #16a34a; }
    .stances-against { border-left: 3px solid #dc2626; }
    .stances-col-title {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }
    .stances-count { color: #94a3b8; font-weight: 400; }
    .stances-empty {
      color: #94a3b8;
      font-size: 13px;
      font-style: italic;
      margin: 0;
    }
    .stances-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .stances-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 10px;
      background: #ffffff;
      border: 1px solid #f1f5f9;
      border-radius: 6px;
    }
    .stances-link {
      color: #1e293b;
      text-decoration: none;
      font-size: 14px;
      line-height: 1.4;
    }
    .stances-link:hover { color: #6366f1; text-decoration: underline; }
    .stances-standing {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .stances-foot { margin: 16px 0 0 0; }
    .stances-more {
      color: #6366f1;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
    }
    .stances-more:hover { text-decoration: underline; }
  `;
}
