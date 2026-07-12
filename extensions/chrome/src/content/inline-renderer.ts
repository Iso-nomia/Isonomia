// ─────────────────────────────────────────────────────────────────────────────
// Content script — Inline rich preview renderer
//
// Renders Isonomia argument/claim preview cards next to detected links.
// Uses Shadow DOM for full style isolation from the host page.
// ─────────────────────────────────────────────────────────────────────────────

import type { ArgumentMeta, ClaimMeta, DetectedLink } from "../shared/types";
import { verifyProvenance, type ProvenanceVerdict } from "../shared/verify";

/**
 * Render a rich preview card for an argument, injected after the link element.
 * Uses Shadow DOM so host page styles cannot interfere.
 */
export function renderArgumentCard(
  link: DetectedLink,
  meta: ArgumentMeta
): void {
  const card = createCardHost(link.element);
  const shadow = card.attachShadow({ mode: "closed" });

  const claimText = meta.conclusion?.text || meta.text;
  const truncatedClaim =
    claimText.length > 180 ? claimText.slice(0, 180) + "…" : claimText;

  shadow.innerHTML = `
    <style>${getCardStyles()}</style>
    <div class="iso-card">
      <div class="iso-card-header">
        <div class="iso-badge">ARGUMENT</div>
        ${
          meta.confidence !== null
            ? `<div class="iso-confidence">${meta.confidence}% confidence</div>`
            : ""
        }
      </div>
      <div class="iso-claim">${escapeHtml(truncatedClaim)}</div>
      <div class="iso-provenance iso-prov-pending" data-iso-prov>
        <span class="iso-prov-dot"></span>
        <span class="iso-prov-text">Verifying provenance…</span>
      </div>
      <div class="iso-meta">
        ${
          meta.evidenceCount > 0
            ? `<span class="iso-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                ${meta.evidenceCount} source${meta.evidenceCount !== 1 ? "s" : ""}
              </span>`
            : ""
        }
        ${
          meta.scheme
            ? `<span class="iso-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                ${escapeHtml(meta.scheme)}
              </span>`
            : ""
        }
        ${
          meta.author
            ? `<span class="iso-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${escapeHtml(meta.author.name)}
              </span>`
            : ""
        }
      </div>
      <div class="iso-footer">
        <span class="iso-brand">isonomia.app</span>
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="iso-view-link">
          View argument →
        </a>
      </div>
    </div>
  `;

  // Verify-mode-A: offline-verify the argument's signed attestation and update
  // the provenance chip. Fire-and-forget; failures degrade to "unverified".
  void attachProvenance(shadow, link);
}

/**
 * Render a rich preview card for a claim.
 */
export function renderClaimCard(link: DetectedLink, meta: ClaimMeta): void {
  const card = createCardHost(link.element);
  const shadow = card.attachShadow({ mode: "closed" });

  const truncatedText =
    meta.text.length > 180 ? meta.text.slice(0, 180) + "…" : meta.text;

  shadow.innerHTML = `
    <style>${getCardStyles()}</style>
    <div class="iso-card">
      <div class="iso-card-header">
        <div class="iso-badge iso-badge-claim">CLAIM</div>
        <div class="iso-moid">${escapeHtml(meta.moid)}</div>
      </div>
      <div class="iso-claim">${escapeHtml(truncatedText)}</div>
      <div class="iso-meta">
        ${
          meta.evidenceCount > 0
            ? `<span class="iso-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                ${meta.evidenceCount} source${meta.evidenceCount !== 1 ? "s" : ""}
              </span>`
            : ""
        }
        ${
          meta.supportCount > 0 || meta.attackCount > 0
            ? `<span class="iso-meta-item">
                ↑${meta.supportCount} ↓${meta.attackCount}
              </span>`
            : ""
        }
        ${
          meta.author
            ? `<span class="iso-meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                ${escapeHtml(meta.author.name)}
              </span>`
            : ""
        }
      </div>
      <div class="iso-footer">
        <span class="iso-brand">isonomia.app</span>
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="iso-view-link">
          View claim →
        </a>
      </div>
    </div>
  `;
}

// ─── Provenance (verify-mode-A) ──────────────────────────────────────────────

/** Map a verdict to the chip's label, css class, and hover title. */
function provenanceView(v: ProvenanceVerdict): { label: string; cls: string; title: string } {
  switch (v.status) {
    case "verified":
      return {
        label: "Verified · signature valid",
        cls: "iso-prov-ok",
        title: `Signed by issuer key ${v.keyId}. Content and shown standing are tamper-evident.`,
      };
    case "revoked":
      return {
        label: `Revoked · ${v.reason}`,
        cls: "iso-prov-revoked",
        title: "The issuer has revoked this attestation (verified against the revocation list).",
      };
    case "modified":
      return {
        label: "Signature invalid · content may be altered",
        cls: "iso-prov-bad",
        title: v.reason,
      };
    case "unverified":
    default:
      return {
        label: "Unverified",
        cls: "iso-prov-unknown",
        // Honesty: absence of a signature is NOT evidence of tampering.
        title: `No verifiable signature (${v.reason}). This is not an accusation — the issuer may not sign, or the artifact couldn't be fetched.`,
      };
  }
}

/**
 * Run verify-mode-A for a rendered argument card and update its provenance chip.
 * Never throws; any failure degrades to an "unverified" chip.
 */
async function attachProvenance(shadow: ShadowRoot, link: DetectedLink): Promise<void> {
  const el = shadow.querySelector("[data-iso-prov]") as HTMLElement | null;
  if (!el) return;

  let base: string;
  try {
    base = new URL(link.url).origin;
  } catch {
    return;
  }

  let verdict: ProvenanceVerdict;
  try {
    verdict = await verifyProvenance(base, link.identifier);
  } catch (err: any) {
    verdict = { status: "unverified", reason: err?.message || "verification error" };
  }

  const view = provenanceView(verdict);
  el.className = `iso-provenance ${view.cls}`;
  el.title = view.title;
  const text = el.querySelector(".iso-prov-text") as HTMLElement | null;
  if (text) text.textContent = view.label;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a host element for the Shadow DOM card */
function createCardHost(anchorElement: HTMLAnchorElement): HTMLDivElement {
  const host = document.createElement("div");
  host.className = "isonomia-preview-host";
  host.style.display = "block";
  host.style.margin = "8px 0";
  host.style.maxWidth = "560px";

  // Insert after the anchor's parent paragraph/comment element,
  // or directly after the anchor if no suitable parent
  const parent = anchorElement.closest("p, .md, .comment, [data-testid]");
  if (parent && parent.parentNode) {
    parent.parentNode.insertBefore(host, parent.nextSibling);
  } else {
    anchorElement.insertAdjacentElement("afterend", host);
  }

  return host;
}

/** Escape HTML special characters to prevent XSS */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** Scoped CSS for the preview card (inside Shadow DOM) */
function getCardStyles(): string {
  return `
    :host {
      all: initial;
      display: block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    .iso-card {
      border: 1px solid #e0e7ef;
      border-left: 3px solid #0ea5e9;
      border-radius: 8px;
      padding: 12px 14px;
      background: linear-gradient(135deg, #f8fafc 0%, #f0f7ff 100%);
      font-size: 13px;
      line-height: 1.45;
      color: #334155;
      max-width: 100%;
      box-sizing: border-box;
    }

    .iso-card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .iso-badge {
      display: inline-flex;
      align-items: center;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: #dbeafe;
      color: #1d4ed8;
    }

    .iso-badge-claim {
      background: #ede9fe;
      color: #6d28d9;
    }

    .iso-confidence {
      font-size: 11px;
      font-weight: 600;
      color: #059669;
      background: #d1fae5;
      padding: 1px 6px;
      border-radius: 4px;
    }

    .iso-moid {
      font-size: 10px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      color: #94a3b8;
    }

    .iso-claim {
      font-size: 13px;
      font-weight: 500;
      color: #1e293b;
      line-height: 1.4;
      margin-bottom: 8px;
    }

    .iso-provenance {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 6px;
      margin-bottom: 8px;
      cursor: default;
    }

    .iso-prov-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }

    .iso-prov-pending { color: #64748b; background: #f1f5f9; }
    .iso-prov-pending .iso-prov-dot { animation: iso-prov-pulse 1s ease-in-out infinite; }
    .iso-prov-ok { color: #047857; background: #d1fae5; }
    .iso-prov-revoked { color: #b91c1c; background: #fee2e2; }
    .iso-prov-bad { color: #b45309; background: #fef3c7; }
    .iso-prov-unknown { color: #64748b; background: #f1f5f9; }

    @keyframes iso-prov-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }

    .iso-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .iso-meta-item {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      color: #64748b;
    }

    .iso-meta-item svg {
      flex-shrink: 0;
    }

    .iso-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
    }

    .iso-brand {
      font-size: 10px;
      color: #94a3b8;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }

    .iso-view-link {
      font-size: 11px;
      font-weight: 600;
      color: #0284c7;
      text-decoration: none;
    }

    .iso-view-link:hover {
      text-decoration: underline;
    }

    @media (prefers-color-scheme: dark) {
      .iso-card {
        background: linear-gradient(135deg, #1e293b 0%, #1a2332 100%);
        border-color: #334155;
        border-left-color: #0ea5e9;
        color: #cbd5e1;
      }
      .iso-claim { color: #f1f5f9; }
      .iso-badge { background: #1e3a5f; color: #7dd3fc; }
      .iso-badge-claim { background: #2e1065; color: #c4b5fd; }
      .iso-confidence { background: #064e3b; color: #6ee7b7; }
      .iso-meta-item { color: #94a3b8; }
      .iso-footer { border-top-color: #334155; }
      .iso-brand { color: #64748b; }
      .iso-view-link { color: #38bdf8; }
      .iso-prov-pending { color: #94a3b8; background: #1e293b; }
      .iso-prov-ok { color: #6ee7b7; background: #064e3b; }
      .iso-prov-revoked { color: #fca5a5; background: #7f1d1d; }
      .iso-prov-bad { color: #fcd34d; background: #78350f; }
      .iso-prov-unknown { color: #94a3b8; background: #1e293b; }
    }
  `;
}
