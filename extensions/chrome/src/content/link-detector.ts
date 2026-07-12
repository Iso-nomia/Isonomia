// ─────────────────────────────────────────────────────────────────────────────
// Content script — Isonomia link detector
//
// Scans page content for isonomia.app/a/ and isonomia.app/c/ URLs and signals
// the inline renderer to inject rich preview cards.
//
// Runs on: reddit.com, twitter.com, x.com, news.ycombinator.com
// ─────────────────────────────────────────────────────────────────────────────

import type { DetectedLink, ExtensionSettings, DEFAULT_SETTINGS } from "../shared/types";

const ISONOMIA_DOMAINS = ["isonomia.app", "localhost:3000"];

// Patterns: /a/{identifier} for arguments, /c/{moid} for claims
const ARGUMENT_PATH_RE = /^\/a\/([A-Za-z0-9_-]+)\/?$/;
const CLAIM_PATH_RE = /^\/c\/([A-Za-z0-9_-]+)\/?$/;

/**
 * Scan the page for anchor elements linking to Isonomia argument/claim pages.
 */
export function detectIsonomiaLinks(): DetectedLink[] {
  const links: DetectedLink[] = [];
  const anchors = document.querySelectorAll<HTMLAnchorElement>("a[href]");

  for (const anchor of anchors) {
    let url: URL;
    try {
      url = new URL(anchor.href);
    } catch {
      continue;
    }

    const host = url.host;
    if (!ISONOMIA_DOMAINS.some((d) => host === d || host === `www.${d}`)) {
      continue;
    }

    const argMatch = url.pathname.match(ARGUMENT_PATH_RE);
    if (argMatch) {
      links.push({
        url: anchor.href,
        type: "argument",
        identifier: argMatch[1],
        element: anchor,
      });
      continue;
    }

    const claimMatch = url.pathname.match(CLAIM_PATH_RE);
    if (claimMatch) {
      links.push({
        url: anchor.href,
        type: "claim",
        identifier: claimMatch[1],
        element: anchor,
      });
    }
  }

  return links;
}

/**
 * Check extension settings to determine if previews are enabled for the
 * current site.
 */
export async function arePreviewsEnabledForSite(): Promise<boolean> {
  const result = await chrome.storage.local.get("isonomia_settings");
  const settings: ExtensionSettings = result.isonomia_settings || {
    previewsEnabled: false,
    siteOverrides: {},
    previewTheme: "auto",
  };

  if (!settings.previewsEnabled) return false;

  const hostname = window.location.hostname;
  // Check per-site override
  if (hostname in settings.siteOverrides) {
    return settings.siteOverrides[hostname];
  }

  // Default: enabled if global toggle is on
  return true;
}

/** Attribute we set to avoid re-processing the same link */
const PROCESSED_ATTR = "data-isonomia-processed";

/**
 * Get all unprocessed Isonomia links on the page.
 * Marks them as processed to avoid duplicate injections.
 */
export function getUnprocessedLinks(): DetectedLink[] {
  const all = detectIsonomiaLinks();
  const unprocessed = all.filter(
    (link) => !link.element.hasAttribute(PROCESSED_ATTR)
  );
  for (const link of unprocessed) {
    link.element.setAttribute(PROCESSED_ATTR, "true");
  }
  return unprocessed;
}
