// ─────────────────────────────────────────────────────────────────────────────
// verify-mode-B v0 — page provenance panel (content script side)
//
// Triggered by the "Check provenance of links on this page" context menu. Collects
// the page's outbound links (URLs only — no page content), asks the service worker
// to resolve + cluster them, and renders a convergence panel:  "N tellings → M
// roots". v0 catches the same source reached by multiple URLs (shared DOI /
// identical canonical URL); it does NOT detect distinct articles sharing an
// upstream — that is v2. The UI says so, and never reads absence-of-convergence as
// evidence of independence.
// ─────────────────────────────────────────────────────────────────────────────

import type { VerifyResolveResponse, VerifyCluster } from "../shared/types";

const PANEL_HOST_ID = "isonomia-verify-panel-host";
const MAX_LINKS = 25;

/** Collect distinct external http(s) links on the page (skip same-site nav). */
function collectPageLinks(): string[] {
  const urls = new Set<string>();
  for (const a of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    let u: URL;
    try {
      u = new URL(a.href);
    } catch {
      continue;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    if (u.host === location.host) continue;
    urls.add(u.href);
    if (urls.size >= MAX_LINKS) break;
  }
  return Array.from(urls);
}

/** Register the trigger. Call once from the content entry point. */
export function initVerifyPanel(): void {
  chrome.runtime.onMessage.addListener((message: { type?: string }) => {
    if (message?.type === "RUN_VERIFY_PANEL") {
      void runVerification();
    }
    // Not returning true — this listener is fire-and-forget (no async response).
  });
}

async function runVerification(): Promise<void> {
  const links = collectPageLinks();
  if (links.length === 0) {
    renderPanel(panelShell(`<div class="iso-vp-empty">No external links found on this page to check.</div>`));
    return;
  }

  renderPanel(
    panelShell(
      `<div class="iso-vp-loading"><span class="iso-vp-spin"></span> Resolving ${links.length} link${links.length === 1 ? "" : "s"}…</div>`,
    ),
  );

  let resp: { success?: boolean; data?: VerifyResolveResponse; error?: string } | undefined;
  try {
    resp = await chrome.runtime.sendMessage({ type: "VERIFY_PAGE_LINKS", urls: links });
  } catch (err: any) {
    renderPanel(panelShell(`<div class="iso-vp-err">Verification failed: ${escapeHtml(err?.message || "unknown error")}</div>`));
    return;
  }

  if (!resp?.success || !resp.data?.ok || !resp.data.result) {
    const msg = resp?.data?.error || resp?.error || "could not verify this page";
    renderPanel(panelShell(`<div class="iso-vp-err">${escapeHtml(msg)}</div>`));
    return;
  }

  renderPanel(panelShell(resultBody(resp.data)));
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function resultBody(data: VerifyResolveResponse): string {
  const r = data.result!;
  const convergent = r.clusters.filter((c) => c.members.length > 1);
  const headlineClass = r.convergent ? "iso-vp-headline conv" : "iso-vp-headline";

  const convergentHtml = convergent.length
    ? `<div class="iso-vp-section-title">Same source reached by multiple links</div>` +
      convergent.map(clusterRow).join("")
    : `<div class="iso-vp-none">No convergence detected among resolvable links — but this is <b>not</b> evidence of independence (v0 only catches shared-DOI / same-URL; shared upstreams need a deeper check).</div>`;

  const unresolved = r.unresolved.length
    ? `<div class="iso-vp-foot-note">${r.unresolved.length} link${r.unresolved.length === 1 ? "" : "s"} could not be resolved to an identity.</div>`
    : "";
  const skipped = data.skippedUnsafe
    ? `<div class="iso-vp-foot-note">${data.skippedUnsafe} link${data.skippedUnsafe === 1 ? "" : "s"} skipped (not a safe public URL).</div>`
    : "";

  return `
    <div class="${headlineClass}">${escapeHtml(r.headline)}</div>
    ${convergentHtml}
    ${unresolved}
    ${skipped}
    <div class="iso-vp-caveat">${escapeHtml(data.note || "")}</div>
  `;
}

function clusterRow(c: VerifyCluster): string {
  const label = c.rootKind === "doi" ? `DOI ${c.rootLabel}` : c.rootLabel;
  const domains = Array.from(new Set(c.members.map((m) => m.domain).filter(Boolean)));
  return `
    <div class="iso-vp-cluster">
      <div class="iso-vp-cluster-count">${c.members.length}×</div>
      <div class="iso-vp-cluster-body">
        <div class="iso-vp-cluster-root">${escapeHtml(label)}</div>
        <div class="iso-vp-cluster-domains">${escapeHtml(domains.join(", "))}</div>
      </div>
    </div>
  `;
}

function panelShell(inner: string): string {
  return `
    <style>${panelStyles()}</style>
    <div class="iso-vp">
      <div class="iso-vp-header">
        <span class="iso-vp-title">Provenance · page citations</span>
        <button class="iso-vp-close" data-iso-vp-close aria-label="Close">×</button>
      </div>
      <div class="iso-vp-content">${inner}</div>
      <div class="iso-vp-brand">isonomia · verify-mode-B (v0)</div>
    </div>
  `;
}

function renderPanel(html: string): void {
  document.getElementById(PANEL_HOST_ID)?.remove();
  const host = document.createElement("div");
  host.id = PANEL_HOST_ID;
  host.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = html;
  shadow.querySelector("[data-iso-vp-close]")?.addEventListener("click", () => host.remove());
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function panelStyles(): string {
  return `
    :host { all: initial; }
    .iso-vp {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      width: 340px; max-height: 70vh; overflow-y: auto;
      background: #ffffff; color: #1e293b;
      border: 1px solid #e2e8f0; border-radius: 10px;
      box-shadow: 0 8px 28px rgba(15,23,42,0.18);
      font-size: 13px; line-height: 1.45;
    }
    .iso-vp-header { display:flex; align-items:center; justify-content:space-between;
      padding: 10px 12px; border-bottom: 1px solid #eef2f7; }
    .iso-vp-title { font-weight: 700; font-size: 12px; letter-spacing: .01em; }
    .iso-vp-close { border:0; background:transparent; font-size:18px; line-height:1;
      cursor:pointer; color:#94a3b8; padding:0 2px; }
    .iso-vp-content { padding: 12px; }
    .iso-vp-headline { font-size: 15px; font-weight: 700; padding: 6px 10px; border-radius: 6px;
      background:#f1f5f9; color:#334155; margin-bottom: 10px; display:inline-block; }
    .iso-vp-headline.conv { background:#d1fae5; color:#047857; }
    .iso-vp-section-title { font-size: 11px; text-transform: uppercase; letter-spacing:.05em;
      color:#64748b; font-weight:700; margin: 6px 0; }
    .iso-vp-cluster { display:flex; gap:10px; align-items:flex-start; padding:8px;
      background:#f8fafc; border:1px solid #eef2f7; border-radius:6px; margin-bottom:6px; }
    .iso-vp-cluster-count { font-weight:700; color:#047857; font-size:13px; }
    .iso-vp-cluster-root { font-weight:600; word-break:break-all; }
    .iso-vp-cluster-domains { font-size:11px; color:#64748b; margin-top:2px; }
    .iso-vp-none, .iso-vp-caveat, .iso-vp-foot-note { font-size:11px; color:#64748b; margin-top:8px; }
    .iso-vp-caveat { border-top:1px solid #eef2f7; padding-top:8px; }
    .iso-vp-loading, .iso-vp-empty, .iso-vp-err { font-size:13px; color:#475569; padding: 6px 0; }
    .iso-vp-err { color:#b45309; }
    .iso-vp-spin { display:inline-block; width:10px; height:10px; border:2px solid #cbd5e1;
      border-top-color:#0ea5e9; border-radius:50%; animation: iso-vp-rot .8s linear infinite; vertical-align:middle; }
    .iso-vp-brand { font-size:10px; color:#94a3b8; padding: 8px 12px; border-top:1px solid #eef2f7;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    @keyframes iso-vp-rot { to { transform: rotate(360deg); } }
    @media (prefers-color-scheme: dark) {
      .iso-vp { background:#0f172a; color:#e2e8f0; border-color:#1e293b; }
      .iso-vp-header, .iso-vp-caveat, .iso-vp-brand { border-color:#1e293b; }
      .iso-vp-headline { background:#1e293b; color:#cbd5e1; }
      .iso-vp-headline.conv { background:#064e3b; color:#6ee7b7; }
      .iso-vp-cluster { background:#111c33; border-color:#1e293b; }
      .iso-vp-cluster-count { color:#6ee7b7; }
    }
  `;
}
