"use client";

/**
 * Track AI-EPI E.1 — citation export widget.
 *
 * Server-renders the citation strings up-front (so the page contains the
 * APA/MLA/Chicago/BibTeX/RIS/CSL bodies in HTML — Zotero & screen-readers
 * can read them without JS) and adds copy + download interactions on the
 * client.
 *
 * Author attribution and content rendering are computed server-side via
 * `lib/citation/formats.ts` so this component is a pure presentation
 * surface — the strings are the source of truth.
 */

import { useCallback, useMemo, useState } from "react";

const TAB_ORDER = [
  { key: "apa", label: "APA 7" },
  { key: "mla", label: "MLA 9" },
  { key: "chicago", label: "Chicago" },
  { key: "bibtex", label: "BibTeX" },
  { key: "ris", label: "RIS" },
  { key: "csl", label: "CSL-JSON" },
] as const;

export type CitationFormatKey = (typeof TAB_ORDER)[number]["key"];

export interface CitationExportWidgetProps {
  /** Pre-rendered citation strings, keyed by format. */
  citations: Record<CitationFormatKey, string>;
  /** URN identifier (e.g. iso:argument:Bx7kQ2mN). */
  isoId: string;
  /** Stable resolver URL for the iso: id. */
  isoUrl: string;
  /** Permalink shortCode — used to name the downloaded file. */
  shortCode: string;
  /** Base URL for download links (server-rendered to avoid origin guessing). */
  citeEndpoint: string;
}

export default function CitationExportWidget(
  props: CitationExportWidgetProps
) {
  const [active, setActive] = useState<CitationFormatKey>("apa");
  const [copied, setCopied] = useState<CitationFormatKey | null>(null);

  const onCopy = useCallback(
    async (key: CitationFormatKey) => {
      try {
        await navigator.clipboard.writeText(props.citations[key]);
        setCopied(key);
        setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
      } catch {
        // Fallback: select the textarea so the user can copy manually.
        const ta = document.getElementById(
          `citation-body-${key}`
        ) as HTMLTextAreaElement | null;
        ta?.select();
      }
    },
    [props.citations]
  );

  const isoCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(props.isoId);
      setCopied("apa"); // reuse flag — visual cue is on the iso row
    } catch {
      /* ignore */
    }
  }, [props.isoId]);

  // Memoize file extensions so the download links are stable across renders.
  const extByKey: Record<CitationFormatKey, string> = useMemo(
    () => ({
      apa: "txt",
      mla: "txt",
      chicago: "txt",
      bibtex: "bib",
      ris: "ris",
      csl: "json",
    }),
    []
  );

  return (
    <section className="citation-widget search-surface" aria-label="Cite this argument">
      <div className="citation-widget-header">
        <h3 className="citation-widget-title">Cite this argument</h3>

        <div className="citation-iso-row">
          <code className="citation-iso-code" aria-label="Isonomia identifier">
            {props.isoId}
          </code>
          <a
            href={props.isoUrl}
            className="citation-iso-copy citation-iso-link"
            rel="noopener noreferrer"
          >
            Resolve ↗
          </a>
          <button
            type="button"
            className="citation-iso-copy"
            onClick={isoCopy}
            aria-label="Copy iso identifier"
          >
            Copy ID
          </button>
        </div>
      </div>

      <div role="tablist" className="citation-tabs" aria-label="Citation format">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            className={`citation-tab${active === tab.key ? " is-active" : ""}`}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {TAB_ORDER.map((tab) =>
        active === tab.key ? (
          <div
            key={tab.key}
            role="tabpanel"
            className="citation-panel"
            aria-label={`${tab.label} citation`}
          >
            <textarea
              id={`citation-body-${tab.key}`}
              className="citation-body custom-scrollbar"
              readOnly
              value={props.citations[tab.key]}
              rows={tab.key === "csl" ? 12 : tab.key === "bibtex" || tab.key === "ris" ? 12 : 8}
              spellCheck={false}
            />
            <div className="citation-actions">
              <button
                type="button"
                className="citation-action"
                onClick={() => onCopy(tab.key)}
              >
                {copied === tab.key ? "Copied!" : "Copy"}
              </button>
              <a
                className="citation-action"
                href={`${props.citeEndpoint}?format=${tab.key}&download=1`}
                download={`${props.shortCode}.${extByKey[tab.key]}`}
              >
                Download .{extByKey[tab.key]}
              </a>
              <a
                className="citation-action citation-action-secondary"
                href={`${props.citeEndpoint}?format=${tab.key}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View raw ↗
              </a>
            </div>
          </div>
        ) : null
      )}

      <p className="citation-footnote">
        Citations include the immutable, content-addressed permalink and an
        sha256 content hash so the cited version is unambiguous.
      </p>

      <style jsx>{`
        .citation-widget {
          margin: 2rem 0;
          padding: 1.25rem 1.5rem 1.5rem;
          border-radius: 12px;
          background: #f0f0f4bc;
        }
        .citation-widget-header {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .citation-widget-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #111827;
        }
        .citation-iso-row {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        .citation-iso-code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.8125rem;
          padding: 0.25rem 0.5rem;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          color: #374151;
        }
        .citation-iso-link {
          font-size: 0.8125rem;
          color: #4b5563;
          text-decoration: none;
        }
        .citation-iso-link:hover {
          color: #111827;
          text-decoration: underline;
        }
        .citation-iso-copy {
          font-size: 0.75rem;
          padding: 0.25rem 0.625rem;
          border: 1px solid #d1d5db;
          background: #fff;
          border-radius: 6px;
          cursor: pointer;
          color: #374151;
        }
        .citation-iso-copy:hover {
          background: #f3f4f6;
        }
        .citation-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem;
          margin-bottom: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .citation-tab {
          background: none;
          border: 1px solid transparent;
          border-bottom: none;
          padding: 0.5rem 0.875rem;
          font-size: 0.875rem;
          color: #6b7280;
          cursor: pointer;
          border-radius: 6px 6px 0 0;
        }
        .citation-tab:hover {
          color: #111827;
          background: #f3f4f6;
        }
        .citation-tab.is-active {
          color: #111827;
          background: #fff;
          border-color: #e5e7eb;
          font-weight: 600;
          margin-bottom: -1px;
        }
        .citation-panel {
          background: #fff;
          padding: 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 0 8px 8px 8px;
        }
        .citation-body {
          width: 100%;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.8125rem;
          line-height: 1.5;
          color: #111827;
          background: #fafafa;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 0.625rem 0.75rem;
          resize: vertical;
        }
        .citation-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.625rem;
          flex-wrap: wrap;
        }
        .citation-action {
          display: inline-block;
          padding: 0.375rem 0.75rem;
          font-size: 0.8125rem;
          color: #fff;
          background: #111827;
          border: 1px solid #111827;
          border-radius: 6px;
          cursor: pointer;
          text-decoration: none;
        }
        .citation-action:hover {
          background: #1f2937;
        }
        .citation-action-secondary {
          background: #fff;
          color: #374151;
          border-color: #d1d5db;
        }
        .citation-action-secondary:hover {
          background: #f3f4f6;
          color: #111827;
        }
        .citation-footnote {
          margin: 0.875rem 0 0;
          font-size: 0.75rem;
          color: #6b7280;
          line-height: 1.5;
        }
      `}</style>
    </section>
  );
}
