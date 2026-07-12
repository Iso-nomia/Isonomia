// Shared favicon + site-title config so every root layout stays in sync.
// Swap ACTIVE_FAVICON to try a different set without renaming files.

export const SITE_TITLE = "Isonomia";
export const SITE_DESCRIPTION =
  "Isonomia turns an argument into structured, verifiable data instead of prose. Today the reasoning behind a decision lives buried inside documents: a web page mixes the claim, the evidence, the rhetoric, and a great deal of unstated assumption into one blob, and if you want to cite it, you cite the whole page. Isonomia breaks that apart. A claim or an argument becomes its own object with a permanent address, carrying what supports it, the sources behind it that are fetched, timestamped, and verifiable, so the record holds even if the original link later rots, the strongest objection on file against it, and whether it has survived challenge. The result is something a person or an AI system can cite precisely, trace to its origin, and check, rather than re-reading and re-judging a document every time.";

export type FaviconSet = "alt" | "default";
export const ACTIVE_FAVICON: FaviconSet = "alt";

export const FAVICON_SETS = {
  alt: {
    icon: [
      // Light/dark-aware: browser picks based on its own theme (tab bg color).
      // SVG line is a graceful fallback for browsers that ignore `media`.
      {
        url: "/favicons/favicon-alt-light.ico",
        sizes: "any",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicons/favicon-alt-dark.ico",
        sizes: "any",
        media: "(prefers-color-scheme: dark)",
      },
      { url: "/favicons/favicon-alt.svg", type: "image/svg+xml" },
      { url: "/favicons/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    shortcut: "/favicons/favicon-alt-light.ico",
    apple: "/favicons/web-app-manifest-192x192-alt.png",
  },
  default: {
    icon: [{ url: "/favicons/favicon-default.ico", sizes: "any" }],
    shortcut: "/favicons/favicon-default.ico",
  },
} as const;

export const siteIcons = FAVICON_SETS[ACTIVE_FAVICON];
