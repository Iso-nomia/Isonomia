// ─────────────────────────────────────────────────────────────────────────────
// Content script entry point
//
// Orchestrates link detection and inline preview rendering.
// Runs at document_idle on supported platforms.
// ─────────────────────────────────────────────────────────────────────────────

import {
  getUnprocessedLinks,
  arePreviewsEnabledForSite,
} from "./link-detector";
import { renderArgumentCard, renderClaimCard } from "./inline-renderer";
import { initVerifyPanel } from "./verify-panel";
import { initClaimPreview } from "./claim-extract";
import type { ArgumentMeta, ClaimMeta } from "../shared/types";

// verify-mode-B v0: register the "Check provenance of links on this page" trigger.
initVerifyPanel();
// verify-mode-B v1a: register the on-device "Preview checkable claims" trigger.
initClaimPreview();

/** In-memory cache for fetched metadata to avoid duplicate requests */
const metaCache = new Map<string, ArgumentMeta | ClaimMeta>();

/**
 * Process all unprocessed Isonomia links on the page.
 * Fetches metadata from the background service worker and renders cards.
 */
async function processLinks(): Promise<void> {
  const enabled = await arePreviewsEnabledForSite();
  if (!enabled) return;

  const links = getUnprocessedLinks();
  if (links.length === 0) return;

  for (const link of links) {
    const cacheKey = `${link.type}:${link.identifier}`;

    // Check cache first
    if (metaCache.has(cacheKey)) {
      const cached = metaCache.get(cacheKey)!;
      if (link.type === "argument") {
        renderArgumentCard(link, cached as ArgumentMeta);
      } else {
        renderClaimCard(link, cached as ClaimMeta);
      }
      continue;
    }

    // Fetch metadata via background service worker
    try {
      const messageType =
        link.type === "argument" ? "FETCH_ARGUMENT_META" : "FETCH_CLAIM_META";
      const messagePayload =
        link.type === "argument"
          ? { type: messageType, identifier: link.identifier }
          : { type: messageType, moid: link.identifier };

      const response = await chrome.runtime.sendMessage(messagePayload);

      if (response?.success && response.data) {
        metaCache.set(cacheKey, response.data);
        if (link.type === "argument") {
          renderArgumentCard(link, response.data as ArgumentMeta);
        } else {
          renderClaimCard(link, response.data as ClaimMeta);
        }
      }
    } catch {
      // Failed to fetch — silently skip this link.
      // The user still has the plain URL.
    }
  }
}

// ─── Initial scan + MutationObserver for dynamically loaded content ──────────

// Process links already on the page
processLinks();

// Watch for new content (Reddit infinite scroll, Twitter timeline updates, etc.)
const observer = new MutationObserver((mutations) => {
  // Only re-scan if actual nodes were added (not just attribute changes)
  const hasNewNodes = mutations.some(
    (m) => m.type === "childList" && m.addedNodes.length > 0
  );
  if (hasNewNodes) {
    // Debounce: wait a tick for the DOM to settle
    requestIdleCallback(() => processLinks(), { timeout: 1000 });
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Listen for settings changes to enable/disable previews live
chrome.storage.onChanged.addListener((changes) => {
  if (changes.isonomia_settings) {
    // Re-process if previews were just enabled
    // (we can't un-render already-injected cards easily, but new ones won't appear)
    processLinks();
  }
});
