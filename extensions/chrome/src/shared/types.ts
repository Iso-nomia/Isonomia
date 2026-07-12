// ─────────────────────────────────────────────────────────────────────────────
// Shared type definitions for the Isonomia Chrome extension
// ─────────────────────────────────────────────────────────────────────────────

/** Argument metadata returned by the API */
export interface ArgumentMeta {
  id: string;
  text: string;
  confidence: number | null;
  scheme: string | null;
  author: { name: string; username: string } | null;
  conclusion: { text: string; moid: string } | null;
  evidenceCount: number;
  supportCount: number;
  challengeCount: number;
  deliberation: { title: string } | null;
  permalink: PermalinkInfo | null;
}

/** Claim metadata returned by the API */
export interface ClaimMeta {
  id: string;
  text: string;
  moid: string;
  author: { name: string; username: string } | null;
  evidenceCount: number;
  supportCount: number;
  attackCount: number;
}

/** Permalink info */
export interface PermalinkInfo {
  shortCode: string;
  slug: string | null;
  fullUrl: string;
  version: number;
  accessCount: number;
}

/** Quick argument creation request */
export interface QuickArgumentRequest {
  claim: string;
  evidence: { url: string; title?: string; quote?: string }[];
  reasoning?: string;
  deliberationId?: string;
  isPublic?: boolean;
}

/** Quick argument creation response */
export interface QuickArgumentResponse {
  ok: boolean;
  argument: { id: string; text: string; confidence: number | null };
  claim: { id: string; text: string; moid: string };
  permalink: { shortCode: string; slug: string; url: string };
  embedCodes: {
    link: string;
    iframe: string;
    markdown: string;
    plainText: string;
  };
}

/** verify-mode-B v0 — convergence result shapes (mirror lib/verify/convergence.ts). */
export interface VerifyRef {
  inputUrl: string;
  canonicalUrl: string;
  doi?: string | null;
  domain?: string | null;
  title?: string | null;
  confidence?: string;
}
export interface VerifyCluster {
  rootKey: string;
  rootKind: "doi" | "url";
  rootLabel: string;
  domain: string | null;
  members: VerifyRef[];
}
export interface VerifyResolveResponse {
  ok: boolean;
  error?: string;
  result?: {
    tellings: number;
    roots: number;
    convergent: boolean;
    clusters: VerifyCluster[];
    unresolved: VerifyRef[];
    headline: string;
  };
  skippedUnsafe?: number;
  note?: string;
}

/** verify-mode-B v1b — backing check (C4) response shapes. */
export interface BackingVerdictDTO {
  status: "backs" | "contradicts" | "unrelated" | "unverifiable";
  confidence: number;
  sourceKind: "body" | "abstract" | "none";
  note?: string;
  rationale?: string;
}
export interface BackingResult {
  claim: string;
  citedUrl: string;
  sourceTitle: string | null;
  verdict: BackingVerdictDTO;
}
export interface VerifyBackingResponse {
  ok: boolean;
  error?: string;
  results?: BackingResult[];
  note?: string;
}

/** URL unfurl response */
export interface UnfurlResponse {
  ok: boolean;
  data: {
    title: string | null;
    description: string | null;
    image: string | null;
    siteName: string | null;
    url: string;
    favicon: string | null;
  };
}

/** Message types between extension components */
export type ExtensionMessage =
  | {
      type: "PREFILL_ARGUMENT";
      payload: {
        claim: string;
        evidenceUrl: string;
        pageTitle: string;
      };
    }
  | {
      type: "FETCH_ARGUMENT_META";
      identifier: string;
    }
  | {
      type: "FETCH_CLAIM_META";
      moid: string;
    }
  | {
      // content script → service worker: resolve + cluster the page's outbound links
      type: "VERIFY_PAGE_LINKS";
      urls: string[];
    }
  | {
      // context menu → content script: collect links, verify, render the panel
      type: "RUN_VERIFY_PANEL";
    }
  | {
      // context menu → content script: on-device claim-span extraction preview (v1a)
      type: "RUN_CLAIM_PREVIEW";
    }
  | {
      // content script → service worker: check backing for extracted claim-spans (v1b)
      type: "VERIFY_BACKING";
      pairs: { claim: string; citedUrl: string }[];
    }
  | {
      type: "AUTH_STATE_CHANGED";
      isLoggedIn: boolean;
    }
  | {
      type: "OPEN_POPUP_WITH_PREFILL";
      payload: {
        claim: string;
        evidenceUrl: string;
        pageTitle: string;
      };
    };

/** Stored auth state */
export interface StoredAuth {
  idToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
  };
}

/** Extension settings */
export interface ExtensionSettings {
  /** Enable inline previews on supported platforms */
  previewsEnabled: boolean;
  /** Per-site overrides (domain → enabled) */
  siteOverrides: Record<string, boolean>;
  /** Default theme for injected cards */
  previewTheme: "light" | "dark" | "auto";
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  previewsEnabled: false,
  siteOverrides: {},
  previewTheme: "auto",
};

/** Detected Isonomia link on a page */
export interface DetectedLink {
  url: string;
  type: "argument" | "claim";
  identifier: string;
  element: HTMLAnchorElement;
}
