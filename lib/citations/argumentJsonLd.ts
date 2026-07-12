/**
 * Argument JSON-LD builder
 *
 * Track A.2 of the AI-Epistemic-Infrastructure Roadmap.
 *
 * Produces the rich, composite JSON-LD that ships in the <head> of the
 * public argument page (/a/[identifier]). The graph is composed of:
 *   - The argument itself, typed as both a Schema.org CreativeWork /
 *     ScholarlyArticle / Claim (composite) and an aif:RA node
 *   - The conclusion claim and premise claims as Schema.org Claim and
 *     aif:InformationNode entries
 *   - The argumentation scheme (with stable scheme URI when available)
 *   - Evidence as Schema.org WebPage citations with provenance fields
 *   - The dialectical-status snapshot from the attestation envelope
 *   - Conditionally, a Schema.org ClaimReview when the argument has been
 *     dialectically tested (see argumentAttestation.computeIsTested)
 *
 * The graph deliberately uses both Schema.org and AIF vocabularies so that
 *   (a) Google / Bing / fact-check crawlers see Schema.org primitives, and
 *   (b) argumentation-research tools see AIF/Argdown-aliased terms.
 */

import type { ArgumentAttestation } from "./argumentAttestation";
import { resolveDeliberationName } from "@/lib/deliberations/resolveName";

const SCHEME_BASE_URI = "http://arg.tech/ont/schemes#";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

/**
 * Composite @context that exposes both Schema.org terms (the default
 * vocabulary, so unprefixed terms like `name` / `text` / `citation` are
 * Schema.org) and the AIF / argumentation-scheme namespaces under prefixes.
 */
function composeContext() {
  return [
    "https://schema.org",
    {
      aif: "http://www.arg.dundee.ac.uk/aif#",
      as: SCHEME_BASE_URI,
      cq: "http://arg.tech/ont/cq#",
      iso: `${BASE_URL}/ns#`,
      contentHash: "iso:contentHash",
      dialecticalStatus: "iso:dialecticalStatus",
      attestation: "iso:attestation",
      schemeKey: "as:appliesSchemeKey",
      hasCriticalQuestion: "as:hasCriticalQuestion",
    },
  ];
}

function schemeIri(schemeKey: string | null | undefined): string | null {
  if (!schemeKey) return null;
  return `${SCHEME_BASE_URI}${schemeKey}`;
}

function claimNode(claim: { claimId: string; moid: string | null; text: string }) {
  const id = claim.moid
    ? `${BASE_URL}/c/${claim.moid}`
    : `${BASE_URL}/claim/${claim.claimId}`;
  return {
    "@id": id,
    "@type": ["Claim", "aif:InformationNode"],
    text: claim.text,
    "aif:text": claim.text,
    ...(claim.moid ? { identifier: `moid:${claim.moid}` } : {}),
  };
}

function evidenceNode(e: ArgumentAttestation["evidence"][number]) {
  if (!e.uri) {
    return {
      "@type": "CreativeWork",
      name: e.title || e.citation || "Evidence",
      ...(e.citation ? { description: e.citation } : {}),
    };
  }
  return {
    "@type": "WebPage",
    url: e.uri,
    "@id": e.uri,
    name: e.title || e.uri,
    ...(e.citation ? { description: e.citation } : {}),
    ...(e.contentSha256 ? { identifier: e.contentSha256 } : {}),
    ...(e.archivedUrl
      ? {
          archivedAt: {
            "@type": "WebPage",
            url: e.archivedUrl,
            ...(e.archivedAt ? { dateCreated: e.archivedAt } : {}),
          },
        }
      : {}),
  };
}

/**
 * Build the rich composite JSON-LD for an argument. Returns a single
 * top-level object suitable for embedding in a `<script type="application/ld+json">`
 * tag. When the argument has been dialectically tested, the result is a
 * `@graph` array containing the primary argument node plus a ClaimReview.
 */
export function buildArgumentJsonLd(att: ArgumentAttestation): Record<string, unknown> {
  const context = composeContext();

  const aifEndpoint = `${BASE_URL}/api/a/${att.identifier}/aif`;
  const conclusion = att.conclusion;
  const premiseNodes = att.premises.map(claimNode);
  const conclusionGraphNode = conclusion ? claimNode(conclusion) : null;

  const schemeNode = att.scheme
    ? {
        "@id": schemeIri(att.scheme.key) || `${BASE_URL}/scheme/${att.scheme.id}`,
        "@type": ["DefinedTerm", "aif:Scheme"],
        name: att.scheme.title || att.scheme.name || att.scheme.key || "Argumentation Scheme",
        ...(att.scheme.key ? { termCode: att.scheme.key } : {}),
      }
    : null;

  const headlineText =
    (conclusion?.text && conclusion.text.length > 0 ? conclusion.text : null) ??
    "Argument";

  const argumentNode: Record<string, unknown> = {
    "@id": att.permalink,
    "@type": ["CreativeWork", "ScholarlyArticle", "Claim", "aif:RA"],
    url: att.permalink,
    sameAs: [att.immutablePermalink, att.isoUrl, aifEndpoint].filter(Boolean),
    identifier: [
      { "@type": "PropertyValue", propertyID: "iso", value: att.isoId },
      { "@type": "PropertyValue", propertyID: "iso:permalink", value: att.identifier },
      { "@type": "PropertyValue", propertyID: "iso:contentHash", value: att.contentHash },
      { "@type": "PropertyValue", propertyID: "iso:version", value: String(att.version) },
      ...(att.doi
        ? [{ "@type": "PropertyValue", propertyID: "doi", value: att.doi }]
        : []),
    ],
    name: headlineText.slice(0, 140),
    headline: headlineText.slice(0, 140),
    abstract: headlineText,
    text: conclusion?.text || headlineText,
    ...(att.confidence !== null
      ? {
          "iso:confidence": att.confidence,
        }
      : {}),
    ...(att.createdAt ? { dateCreated: att.createdAt, datePublished: att.createdAt } : {}),
    ...(att.updatedAt ? { dateModified: att.updatedAt } : {}),
    ...(att.author?.displayName || att.author?.id
      ? {
          author: {
            "@type": "Person",
            ...(att.author.displayName ? { name: att.author.displayName } : {}),
            ...(att.author.id ? { identifier: att.author.id } : {}),
          },
        }
      : {}),
    publisher: {
      "@type": "Organization",
      name: "Isonomia",
      url: BASE_URL,
    },
    ...(att.deliberation
      ? {
          isPartOf: {
            "@type": "CreativeWork",
            "@id": `${BASE_URL}/deliberations/${att.deliberation.id}`,
            name: resolveDeliberationName(att.deliberation, { fallback: "Deliberation" }),
            url: `${BASE_URL}/deliberations/${att.deliberation.id}`,
          },
        }
      : {}),
    ...(conclusionGraphNode
      ? {
          about: conclusionGraphNode,
          "aif:hasConclusion": conclusionGraphNode["@id"],
        }
      : {}),
    ...(premiseNodes.length
      ? {
          "iso:premises": premiseNodes,
          "aif:hasPremise": premiseNodes.map((n: any) => n["@id"]),
        }
      : {}),
    ...(schemeNode
      ? {
          "aif:usesScheme": schemeNode,
          schemeKey: att.scheme?.key ?? null,
        }
      : {}),
    ...(att.evidence.length
      ? {
          citation: att.evidence.map(evidenceNode),
        }
      : {}),
    contentHash: att.contentHash,
    dialecticalStatus: {
      "@type": "PropertyValue",
      "iso:incomingAttacks": att.dialecticalStatus.incomingAttacks,
      "iso:incomingAttackEdges": att.dialecticalStatus.incomingAttackEdges,
      "iso:incomingSupports": att.dialecticalStatus.incomingSupports,
      "iso:criticalQuestionsRequired": att.dialecticalStatus.criticalQuestionsRequired,
      "iso:criticalQuestionsAnswered": att.dialecticalStatus.criticalQuestionsAnswered,
      "iso:criticalQuestionsOpen": att.dialecticalStatus.criticalQuestionsOpen,
      "iso:standingScore": att.dialecticalStatus.standingScore,
      "iso:isTested": att.dialecticalStatus.isTested,
    },
    attestation: {
      "@type": "PropertyValue",
      "iso:permalink": att.permalink,
      "iso:immutablePermalink": att.immutablePermalink,
      "iso:contentHash": att.contentHash,
      "iso:version": att.version,
      "iso:retrievedAt": att.retrievedAt,
    },
  };

  // Conditional ClaimReview emission: only when dialectically tested.
  // This gates the strongest Schema.org signal behind a real activation rule.
  if (att.dialecticalStatus.isTested && conclusion) {
    const reviewNode = {
      "@type": "ClaimReview",
      "@id": `${att.permalink}#review`,
      url: att.permalink,
      datePublished: att.updatedAt || att.createdAt || att.retrievedAt,
      author: {
        "@type": "Organization",
        name: "Isonomia",
        url: BASE_URL,
      },
      claimReviewed: conclusion.text,
      itemReviewed: {
        "@type": "Claim",
        text: conclusion.text,
        ...(conclusion.moid ? { identifier: `moid:${conclusion.moid}` } : {}),
        ...(att.author?.displayName
          ? {
              author: { "@type": "Person", name: att.author.displayName },
            }
          : {}),
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: att.dialecticalStatus.standingScore ?? 0,
        bestRating: 1,
        worstRating: 0,
        ratingExplanation:
          `Standing score derived from ${att.dialecticalStatus.criticalQuestionsAnswered} of ` +
          `${att.dialecticalStatus.criticalQuestionsRequired} critical questions answered, ` +
          `${att.dialecticalStatus.incomingAttacks} inbound attacks, ` +
          `${att.dialecticalStatus.incomingSupports} inbound supports.`,
      },
    };

    return {
      "@context": context,
      "@graph": [argumentNode, reviewNode],
    };
  }

  return {
    "@context": context,
    ...argumentNode,
  };
}

/**
 * Build the <meta name="citation_*"> tag set for Zotero / Google Scholar
 * auto-detection, plus Dublin Core and PRISM tags for library harvesters
 * and the iso: identifier so iso-aware tooling can round-trip our URN.
 *
 * (Track E.1 — extended in tandem with E.2 once the attestation envelope
 * carries the iso:id.)
 *
 * Author rendering follows the AI-EPI Pt. 3 §5 attribution rules — see
 * `renderAuthorPlain` in `lib/citation/formats.ts`.
 */
export function buildCitationMetaTags(
  att: ArgumentAttestation
): Array<{ name: string; content: string }> {
  const tags: Array<{ name: string; content: string }> = [];
  const title = att.conclusion?.text || "Argument";
  const isoDate = att.createdAt ? att.createdAt.split("T")[0] : null;
  // Lazy import to avoid a circular dep between the JSON-LD module and
  // the format module (formats.ts already imports the attestation type).
  const { renderAuthorPlain } = require("@/lib/citation/formats") as {
    renderAuthorPlain: (a: ArgumentAttestation["author"]) => string;
  };
  const authorPlain = renderAuthorPlain(att.author);

  // ----- Highwire / Google Scholar / Zotero "citation_*" tags -----
  tags.push({ name: "citation_title", content: title });
  tags.push({ name: "citation_public_url", content: att.permalink });
  tags.push({ name: "citation_fulltext_html_url", content: att.permalink });
  tags.push({ name: "citation_abstract_html_url", content: att.permalink });
  tags.push({ name: "citation_abstract", content: title });
  tags.push({ name: "citation_publisher", content: "Isonomia" });
  tags.push({ name: "citation_journal_title", content: "Isonomia Arguments" });
  tags.push({ name: "citation_author", content: authorPlain });
  if (isoDate) {
    tags.push({ name: "citation_publication_date", content: isoDate });
    tags.push({ name: "citation_date", content: isoDate });
  }
  if (att.doi) tags.push({ name: "citation_doi", content: att.doi });
  for (const e of att.evidence) {
    if (e.uri) tags.push({ name: "citation_reference", content: e.uri });
  }

  // ----- Dublin Core (library harvesters: OAI-PMH, OpenAIRE) -----
  tags.push({ name: "DC.title", content: title });
  tags.push({ name: "DC.creator", content: authorPlain });
  if (isoDate) tags.push({ name: "DC.date", content: isoDate });
  tags.push({ name: "DC.publisher", content: "Isonomia" });
  tags.push({ name: "DC.identifier", content: att.isoId });
  tags.push({ name: "DC.identifier", content: att.immutablePermalink });
  if (att.doi) tags.push({ name: "DC.identifier", content: `doi:${att.doi}` });
  tags.push({ name: "DC.type", content: "InteractiveResource" });
  tags.push({ name: "DC.format", content: "text/html" });
  tags.push({ name: "DC.language", content: "en" });

  // ----- PRISM (publishing-industry metadata) -----
  if (isoDate) tags.push({ name: "prism.publicationDate", content: isoDate });
  tags.push({ name: "prism.url", content: att.immutablePermalink });
  if (att.doi) tags.push({ name: "prism.doi", content: att.doi });

  // ----- Custom Isonomia identifiers -----
  tags.push({ name: "iso_id", content: att.isoId });
  tags.push({ name: "iso_url", content: att.isoUrl });
  tags.push({ name: "iso_permalink", content: att.permalink });
  tags.push({ name: "iso_immutable_permalink", content: att.immutablePermalink });
  tags.push({ name: "iso_content_hash", content: att.contentHash });
  tags.push({ name: "iso_version", content: String(att.version) });
  tags.push({
    name: "iso_standing_state",
    content: att.dialecticalStatus.standingState,
  });
  return tags;
}
