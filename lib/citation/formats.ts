/**
 * Track AI-EPI E.1 — citation format serializers.
 *
 * Pure functions that turn an `ArgumentAttestation` into the six citation
 * formats academics, librarians, and reference managers actually use:
 *
 *   - CSL-JSON  — the Citation Style Language interchange format
 *                 (Zotero, citation.js, Pandoc all consume this)
 *   - BibTeX    — LaTeX / BibLaTeX
 *   - RIS       — EndNote, Mendeley, Zotero import format
 *   - APA 7     — plain-text rendered citation
 *   - MLA 9     — plain-text rendered citation
 *   - Chicago   — author-date, plain-text rendered citation
 *
 * The plain-text APA/MLA/Chicago renderers cover the 90% case
 * (web-source citation with author + date + title + URL + accessed
 * date). They are NOT a replacement for citeproc — they implement a
 * deterministic, well-formed subset suitable for the web-resident
 * dialectical artefacts Isonomia produces.
 *
 * Author attribution rules (per AI-EPI Pt. 3 §5):
 *   - HUMAN  → displayName (or "Anonymous")
 *   - AI     → "Anonymous (AI-assisted via <model>)" or "Anonymous (AI-assisted)"
 *   - HYBRID → "<displayName> (AI-assisted via <model>)"
 *
 * The model name is read from `author.aiProvenance.model` when present.
 */

import type { ArgumentAttestation } from "@/lib/citations/argumentAttestation";

const PUBLISHER = "Isonomia";
const CONTAINER_TITLE = "Isonomia Arguments";

// ---- author ---------------------------------------------------------------

function extractModel(
  aiProvenance: Record<string, unknown> | null | undefined
): string | null {
  if (!aiProvenance) return null;
  const m = aiProvenance.model;
  return typeof m === "string" && m.trim() ? m.trim() : null;
}

/** Plain-text author string per the AI-EPI Pt. 3 §5 attribution rules. */
export function renderAuthorPlain(
  author: ArgumentAttestation["author"]
): string {
  if (!author) return "Anonymous";
  const name = author.displayName?.trim() || null;
  const model = extractModel(author.aiProvenance);
  if (author.kind === "HUMAN") return name ?? "Anonymous";
  const aiTag = model ? `AI-assisted via ${model}` : "AI-assisted";
  if (name) return `${name} (${aiTag})`;
  return `Anonymous (${aiTag})`;
}

/**
 * BibTeX-friendly author. Wraps in a brace group when the AI tag is
 * present so citeproc/biber treats the whole string as one literal
 * surname rather than parsing the parentheses as personal-name syntax.
 */
function renderAuthorBibtex(author: ArgumentAttestation["author"]): string {
  if (!author) return "Anonymous";
  const name = author.displayName?.trim() || "Anonymous";
  const model = extractModel(author.aiProvenance);
  if (author.kind === "HUMAN") return name;
  const aiTag = model ? `AI-assisted via ${model}` : "AI-assisted";
  return `{${name} (${aiTag})}`;
}

function renderAuthorCsl(
  author: ArgumentAttestation["author"]
): Array<{ literal: string }> {
  return [{ literal: renderAuthorPlain(author) }];
}

// ---- date helpers ---------------------------------------------------------

function parseDateParts(
  iso: string | null
): [number, number, number] | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function year(iso: string | null): string {
  return parseDateParts(iso)?.[0]?.toString() ?? "n.d.";
}

function isoDateOnly(iso: string | null): string | null {
  return iso ? iso.split("T")[0] ?? null : null;
}

// ---- title pick -----------------------------------------------------------

function titleOf(att: ArgumentAttestation): string {
  const t = att.conclusion?.text?.trim();
  return t || "Untitled argument";
}

// ---- CSL-JSON -------------------------------------------------------------

export interface CslJsonCitation {
  id: string;
  type: "webpage" | "article";
  title: string;
  author: Array<{ literal: string }>;
  issued?: { "date-parts": [[number, number?, number?]] };
  accessed?: { "date-parts": [[number, number?, number?]] };
  URL: string;
  DOI?: string;
  publisher: string;
  "container-title": string;
  abstract?: string;
  note?: string;
  "call-number"?: string;
  custom?: Record<string, unknown>;
}

export function toCslJson(att: ArgumentAttestation): CslJsonCitation {
  const issued = parseDateParts(att.createdAt);
  const accessed = parseDateParts(att.retrievedAt);
  const out: CslJsonCitation = {
    id: att.isoId,
    type: "webpage",
    title: titleOf(att),
    author: renderAuthorCsl(att.author),
    URL: att.immutablePermalink,
    publisher: PUBLISHER,
    "container-title": CONTAINER_TITLE,
    "call-number": att.isoId,
    abstract: titleOf(att),
    note: `Content hash ${att.contentHash}; standing ${att.dialecticalStatus.standingState}.`,
    custom: {
      "iso:id": att.isoId,
      "iso:contentHash": att.contentHash,
      "iso:permalink": att.permalink,
      "iso:standingState": att.dialecticalStatus.standingState,
    },
  };
  if (att.doi) out.DOI = att.doi;
  if (issued)
    out.issued = { "date-parts": [[issued[0], issued[1], issued[2]]] };
  if (accessed)
    out.accessed = { "date-parts": [[accessed[0], accessed[1], accessed[2]]] };
  return out;
}

// ---- BibTeX ---------------------------------------------------------------

function bibEscape(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[{}]/g, (m) => `\\${m}`)
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}");
}

export function toBibTeX(att: ArgumentAttestation): string {
  const shortCode = att.identifier.replace(/[^A-Za-z0-9]/g, "");
  const key = `iso_${shortCode}`;
  const fields: Array<[string, string]> = [
    ["author", renderAuthorBibtex(att.author)],
    ["title", bibEscape(titleOf(att))],
    ["howpublished", `\\url{${att.immutablePermalink}}`],
    ["publisher", PUBLISHER],
    ["year", year(att.createdAt)],
  ];
  const access = isoDateOnly(att.retrievedAt);
  if (access) fields.push(["urldate", access]);
  if (att.doi) fields.push(["doi", att.doi]);
  fields.push(["note", `iso-id: ${att.isoId}; sha256: ${att.contentHash}`]);
  const body = fields.map(([k, v]) => `  ${k} = {${v}}`).join(",\n");
  return `@misc{${key},\n${body}\n}\n`;
}

// ---- RIS ------------------------------------------------------------------

export function toRis(att: ArgumentAttestation): string {
  const lines: string[] = [];
  lines.push("TY  - ELEC");
  lines.push(`AU  - ${renderAuthorPlain(att.author)}`);
  lines.push(`TI  - ${titleOf(att)}`);
  const date = isoDateOnly(att.createdAt);
  if (date) {
    lines.push(`DA  - ${date.replace(/-/g, "/")}`);
    lines.push(`PY  - ${date.slice(0, 4)}`);
  }
  lines.push(`PB  - ${PUBLISHER}`);
  lines.push(`UR  - ${att.immutablePermalink}`);
  if (att.doi) lines.push(`DO  - ${att.doi}`);
  const access = isoDateOnly(att.retrievedAt);
  if (access) lines.push(`Y2  - ${access.replace(/-/g, "/")}`);
  lines.push(`AB  - ${titleOf(att)}`);
  lines.push(`N1  - iso-id: ${att.isoId}; sha256: ${att.contentHash}`);
  lines.push("ER  - ");
  return lines.join("\n") + "\n";
}

// ---- APA 7 ----------------------------------------------------------------

/**
 * APA 7 web source pattern:
 *   Author. (Year). Title. Publisher. URL
 */
export function toApa(att: ArgumentAttestation): string {
  const author = renderAuthorPlain(att.author);
  const yr = year(att.createdAt);
  const title = titleOf(att);
  const period = title.endsWith(".") ? "" : ".";
  return `${author}. (${yr}). ${title}${period} ${PUBLISHER}. ${att.immutablePermalink}`;
}

// ---- MLA 9 ----------------------------------------------------------------

/**
 * MLA 9 web source pattern:
 *   Author. "Title." Container, Publisher, Date, URL. Accessed Date.
 */
export function toMla(att: ArgumentAttestation): string {
  const author = renderAuthorPlain(att.author);
  const title = titleOf(att);
  const date = isoDateOnly(att.createdAt);
  const access = isoDateOnly(att.retrievedAt);
  const parts: string[] = [
    `${author}.`,
    `\u201c${title}.\u201d`,
    `${CONTAINER_TITLE},`,
    `${PUBLISHER},`,
  ];
  if (date) parts.push(`${date},`);
  parts.push(`${att.immutablePermalink}.`);
  if (access) parts.push(`Accessed ${access}.`);
  return parts.join(" ");
}

// ---- Chicago author-date --------------------------------------------------

/**
 * Chicago 17 (author-date) web source pattern:
 *   Author. Year. "Title." Container. Accessed Date. URL.
 */
export function toChicago(att: ArgumentAttestation): string {
  const author = renderAuthorPlain(att.author);
  const yr = year(att.createdAt);
  const title = titleOf(att);
  const access = isoDateOnly(att.retrievedAt);
  const parts: string[] = [
    `${author}.`,
    `${yr}.`,
    `\u201c${title}.\u201d`,
    `${CONTAINER_TITLE}.`,
  ];
  if (access) parts.push(`Accessed ${access}.`);
  parts.push(`${att.immutablePermalink}.`);
  return parts.join(" ");
}

// ---- registry -------------------------------------------------------------

export type CitationFormat =
  | "csl"
  | "bibtex"
  | "ris"
  | "apa"
  | "mla"
  | "chicago";

export const CITATION_FORMATS: ReadonlyArray<CitationFormat> = [
  "csl",
  "bibtex",
  "ris",
  "apa",
  "mla",
  "chicago",
];

export interface FormatDescriptor {
  format: CitationFormat;
  contentType: string;
  fileExtension: string;
  label: string;
}

export const FORMAT_DESCRIPTORS: Record<CitationFormat, FormatDescriptor> = {
  csl: {
    format: "csl",
    contentType: "application/vnd.citationstyles.csl+json; charset=utf-8",
    fileExtension: "json",
    label: "CSL-JSON",
  },
  bibtex: {
    format: "bibtex",
    contentType: "application/x-bibtex; charset=utf-8",
    fileExtension: "bib",
    label: "BibTeX",
  },
  ris: {
    format: "ris",
    contentType: "application/x-research-info-systems; charset=utf-8",
    fileExtension: "ris",
    label: "RIS",
  },
  apa: {
    format: "apa",
    contentType: "text/plain; charset=utf-8",
    fileExtension: "txt",
    label: "APA 7",
  },
  mla: {
    format: "mla",
    contentType: "text/plain; charset=utf-8",
    fileExtension: "txt",
    label: "MLA 9",
  },
  chicago: {
    format: "chicago",
    contentType: "text/plain; charset=utf-8",
    fileExtension: "txt",
    label: "Chicago 17 (author-date)",
  },
};

/**
 * Render any supported format. Returns `{ body, contentType }`. For CSL the
 * body is JSON-stringified; use `toCslJson` directly if you want the
 * object for embedding inside another JSON envelope.
 */
export function renderCitation(
  att: ArgumentAttestation,
  format: CitationFormat
): { body: string; contentType: string } {
  const desc = FORMAT_DESCRIPTORS[format];
  switch (format) {
    case "csl":
      return {
        body: JSON.stringify(toCslJson(att), null, 2),
        contentType: desc.contentType,
      };
    case "bibtex":
      return { body: toBibTeX(att), contentType: desc.contentType };
    case "ris":
      return { body: toRis(att), contentType: desc.contentType };
    case "apa":
      return { body: toApa(att), contentType: desc.contentType };
    case "mla":
      return { body: toMla(att), contentType: desc.contentType };
    case "chicago":
      return { body: toChicago(att), contentType: desc.contentType };
  }
}

export function isCitationFormat(s: string): s is CitationFormat {
  return (CITATION_FORMATS as ReadonlyArray<string>).includes(s);
}
