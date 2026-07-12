// ─────────────────────────────────────────────────────────────────────────────
// Background service worker for the Isonomia Chrome extension (Manifest V3)
//
// Responsibilities:
// - Register "Create Isonomia Argument" context menu on text selection
// - Route messages between content scripts and popup
// - Handle auth token exchange from the login page
// - Manage extension lifecycle events
// ─────────────────────────────────────────────────────────────────────────────

import { IsonomiaAPI } from "../shared/api-client";
import { storeAuth, isLoggedIn } from "../shared/auth";
import type { StoredAuth, ExtensionMessage } from "../shared/types";

// ─── Context Menu ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "create-isonomia-argument",
    title: "Create Isonomia Argument",
    contexts: ["selection"],
  });
  chrome.contextMenus.create({
    id: "check-link-provenance",
    title: "Check provenance of links on this page",
    contexts: ["page"],
  });
  chrome.contextMenus.create({
    id: "preview-checkable-claims",
    title: "Preview checkable claims (on-device)",
    contexts: ["page"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // verify-mode-B v0: tell the page's content script to run the panel.
  if (info.menuItemId === "check-link-provenance") {
    if (tab?.id != null) {
      chrome.tabs.sendMessage(tab.id, { type: "RUN_VERIFY_PANEL" }).catch(() => {
        // Content script not injected on this site (only runs on the configured
        // matches). Broadening to arbitrary pages is a v0.1 follow-up.
      });
    }
    return;
  }

  // verify-mode-B v1a: on-device claim-span extraction preview (nothing leaves the page).
  if (info.menuItemId === "preview-checkable-claims") {
    if (tab?.id != null) {
      chrome.tabs.sendMessage(tab.id, { type: "RUN_CLAIM_PREVIEW" }).catch(() => {});
    }
    return;
  }

  if (info.menuItemId !== "create-isonomia-argument") return;

  const selectedText = info.selectionText?.trim() || "";
  if (!selectedText) return;

  const pageUrl = tab?.url || "";
  const pageTitle = tab?.title || "";

  // Store the prefill data so the popup can read it when it opens
  await chrome.storage.session.set({
    prefill: {
      claim: selectedText,
      evidenceUrl: pageUrl,
      pageTitle,
      timestamp: Date.now(),
    },
  });

  // Open the popup — in MV3 we can't programmatically openPopup() from
  // a context menu handler in all browsers, so we open a small window instead
  const popupUrl = chrome.runtime.getURL("popup.html?source=contextmenu");
  chrome.windows.create({
    url: popupUrl,
    type: "popup",
    width: 420,
    height: 540,
    focused: true,
  });
});

// ─── Message Routing ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    handleMessage(message, sendResponse);
    return true; // Keep the message channel open for async responses
  }
);

async function handleMessage(
  message: ExtensionMessage,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    switch (message.type) {
      case "FETCH_ARGUMENT_META": {
        const meta = await IsonomiaAPI.getArgumentMeta(message.identifier);
        sendResponse({ success: true, data: meta });
        break;
      }
      case "FETCH_CLAIM_META": {
        const meta = await IsonomiaAPI.getClaimMeta(message.moid);
        sendResponse({ success: true, data: meta });
        break;
      }
      case "VERIFY_PAGE_LINKS": {
        // Auth'd fetch happens here (service worker holds the token).
        const res = await IsonomiaAPI.verifyLinks(message.urls);
        sendResponse({ success: true, data: res });
        break;
      }
      case "VERIFY_BACKING": {
        const res = await IsonomiaAPI.checkBacking(message.pairs);
        sendResponse({ success: true, data: res });
        break;
      }
      default:
        sendResponse({ success: false, error: "Unknown message type" });
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error";
    sendResponse({ success: false, error: errorMessage });
  }
}

// ─── Auth Token Exchange ─────────────────────────────────────────────────────
// The Isonomia login page, after successful Firebase auth, redirects to:
//   /auth/extension-callback?ext={extensionId}
// That page sends a message to this service worker with the Firebase token.

chrome.runtime.onMessageExternal.addListener(
  async (
    message: { type: string; auth: StoredAuth },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    // Only accept messages from the Isonomia domain
    const senderOrigin = sender.url ? new URL(sender.url).origin : "";
    const allowedOrigins = [
      "https://isonomia.app",
      "http://localhost:3000",
    ];

    if (!allowedOrigins.includes(senderOrigin)) {
      sendResponse({ success: false, error: "Unauthorized origin" });
      return;
    }

    if (message.type === "EXTENSION_AUTH_TOKEN" && message.auth) {
      await storeAuth(message.auth);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "Unknown message type" });
    }
  }
);

// ─── Badge Update ────────────────────────────────────────────────────────────

async function updateBadge(): Promise<void> {
  const loggedIn = await isLoggedIn();
  if (loggedIn) {
    chrome.action.setBadgeText({ text: "" });
  } else {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#EF4444" });
  }
}

// Update badge on startup and auth changes
updateBadge();
chrome.storage.onChanged.addListener((changes) => {
  if (changes.isonomia_auth) {
    updateBadge();
  }
});
