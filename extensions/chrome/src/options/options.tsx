// ─────────────────────────────────────────────────────────────────────────────
// Extension options page
//
// Account connection, inline preview toggles, per-site overrides, API base.
// ─────────────────────────────────────────────────────────────────────────────

import { h, render } from "preact";
import { useState, useEffect } from "preact/hooks";
import { isLoggedIn, getUser, initiateLogin, clearAuth } from "../shared/auth";
import { getApiBase, setApiBase } from "../shared/api-client";
import type { ExtensionSettings, DEFAULT_SETTINGS } from "../shared/types";

import "./options.css";

const SETTINGS_KEY = "isonomia_settings";

const SUPPORTED_SITES = [
  { hostname: "www.reddit.com", label: "Reddit" },
  { hostname: "old.reddit.com", label: "Reddit (old)" },
  { hostname: "twitter.com", label: "Twitter" },
  { hostname: "x.com", label: "X" },
  { hostname: "news.ycombinator.com", label: "Hacker News" },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return h("button", {
    class: `toggle ${on ? "on" : ""}`,
    onClick: onToggle,
    type: "button",
  },
    h("span", { class: "toggle-knob" }),
  );
}

function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [userInfo, setUserInfo] = useState<{ displayName: string | null; email: string | null } | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings>({
    previewsEnabled: false,
    siteOverrides: {},
    previewTheme: "auto",
  });
  const [apiBase, setApiBaseState] = useState("");
  const [saved, setSaved] = useState(false);

  // Load state
  useEffect(() => {
    Promise.all([isLoggedIn(), getUser(), getApiBase()]).then(
      ([li, user, base]) => {
        setLoggedIn(li);
        setUserInfo(user ? { displayName: user.displayName, email: user.email } : null);
        setApiBaseState(base);
      }
    );

    chrome.storage.local.get(SETTINGS_KEY).then((result) => {
      if (result[SETTINGS_KEY]) {
        setSettings(result[SETTINGS_KEY] as ExtensionSettings);
      }
    });

    // Listen for auth changes
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.isonomia_auth) {
        isLoggedIn().then(setLoggedIn);
        getUser().then((user) =>
          setUserInfo(user ? { displayName: user.displayName, email: user.email } : null)
        );
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  // Save settings whenever they change
  const updateSettings = (patch: Partial<ExtensionSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    chrome.storage.local.set({ [SETTINGS_KEY]: next });
  };

  const toggleSiteOverride = (hostname: string) => {
    const current = settings.siteOverrides[hostname] ?? settings.previewsEnabled;
    updateSettings({
      siteOverrides: { ...settings.siteOverrides, [hostname]: !current },
    });
  };

  const handleApiBaseSave = async () => {
    const trimmed = apiBase.trim().replace(/\/$/, "");
    await setApiBase(trimmed);
    setApiBaseState(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    await clearAuth();
    setLoggedIn(false);
    setUserInfo(null);
  };

  if (loggedIn === null) {
    return h("div", { class: "options-container" },
      h("div", { class: "options-header" },
        h("div", { class: "options-logo" }, "I"),
        h("div", { class: "options-title" }, "Isonomia Extension"),
      ),
      h("p", null, "Loading..."),
    );
  }

  return h("div", { class: "options-container" },
    // Header
    h("div", { class: "options-header" },
      h("div", { class: "options-logo" }, "I"),
      h("div", { class: "options-title" }, "Isonomia Extension"),
      h("span", { class: "options-version" }, "v1.0.0"),
    ),

    // Account section
    h("div", { class: "section" },
      h("div", { class: "section-title" }, "Account"),
      loggedIn && userInfo
        ? h("div", null,
            h("div", { class: "account-info" },
              h("div", { class: "account-avatar" },
                (userInfo.displayName || userInfo.email || "?")[0].toUpperCase(),
              ),
              h("div", null,
                h("div", { class: "account-name" }, userInfo.displayName || "User"),
                userInfo.email && h("div", { class: "account-email" }, userInfo.email),
              ),
            ),
            h("button", { class: "btn-danger", onClick: handleSignOut }, "Sign out"),
          )
        : h("div", null,
            h("p", { class: "section-desc" },
              "Sign in to create arguments and access your Isonomia account from the extension.",
            ),
            h("button", {
              class: "btn-primary",
              onClick: () => initiateLogin(),
            }, "Sign in with Isonomia"),
          ),
    ),

    // Inline previews section
    h("div", { class: "section" },
      h("div", { class: "section-title" }, "Inline Previews"),
      h("p", { class: "section-desc" },
        "When enabled, the extension detects Isonomia argument and claim links on supported sites and shows a rich preview card inline.",
      ),

      h("div", { class: "toggle-row" },
        h("div", null,
          h("div", { class: "toggle-label" }, "Enable inline previews"),
          h("div", { class: "toggle-desc" }, "Global toggle — affects all supported sites"),
        ),
        h(Toggle, {
          on: settings.previewsEnabled,
          onToggle: () => updateSettings({ previewsEnabled: !settings.previewsEnabled }),
        }),
      ),

      settings.previewsEnabled &&
        h("div", { style: { marginTop: "8px" } },
          h("div", { class: "section-desc", style: { fontWeight: 600, color: "#334155" } }, "Per-site overrides"),
          ...SUPPORTED_SITES.map((site) =>
            h("div", { class: "toggle-row" },
              h("div", null,
                h("div", { class: "toggle-label" }, site.label),
                h("div", { class: "toggle-desc" }, site.hostname),
              ),
              h(Toggle, {
                on: settings.siteOverrides[site.hostname] ?? true,
                onToggle: () => toggleSiteOverride(site.hostname),
              }),
            ),
          ),
        ),
    ),

    // Preview theme
    h("div", { class: "section" },
      h("div", { class: "section-title" }, "Preview Theme"),
      h("p", { class: "section-desc" },
        "Choose the color scheme for injected preview cards.",
      ),
      h("div", { style: { display: "flex", gap: "8px" } },
        ...["auto", "light", "dark"].map((theme) =>
          h("button", {
            class: `btn-secondary`,
            style: {
              flex: 1,
              padding: "8px",
              fontSize: "12px",
              fontWeight: 500,
              border: `1px solid ${settings.previewTheme === theme ? "#0ea5e9" : "#e2e8f0"}`,
              background: settings.previewTheme === theme ? "#f0f9ff" : "#fff",
              color: settings.previewTheme === theme ? "#0369a1" : "#475569",
              borderRadius: "6px",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            },
            onClick: () => updateSettings({ previewTheme: theme as "auto" | "light" | "dark" }),
          }, theme.charAt(0).toUpperCase() + theme.slice(1)),
        ),
      ),
    ),

    // Advanced: API base
    h("div", { class: "section" },
      h("div", { class: "section-title" }, "Advanced"),
      h("p", { class: "section-desc" },
        "API base URL. Change this if you are running a local development server.",
      ),
      h("div", { class: "api-base-row" },
        h("input", {
          type: "url",
          value: apiBase,
          onInput: (e: Event) => setApiBaseState((e.target as HTMLInputElement).value),
          onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter") handleApiBaseSave(); },
        }),
        h("button", {
          class: "btn-primary",
          style: { padding: "7px 12px", fontSize: "12px" },
          onClick: handleApiBaseSave,
        }, "Save"),
        saved && h("span", { class: "saved-indicator" }, "✓ Saved"),
      ),
    ),
  );
}

// Mount
const root = document.getElementById("app");
if (root) {
  render(h(App, null), root);
}
