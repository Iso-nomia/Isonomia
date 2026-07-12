/**
 * Claim Permalink Service
 *
 * Claims use their `moid` field as the natural public identifier.
 * No separate permalink table is required — `moid` is already unique
 * and human-meaningful.
 *
 * URL shapes:
 *   Public page:  /c/[moid]
 *   Embed widget: /embed/claim/[moid]
 *   OG image:     /api/og/claim/[moid]
 */

const PERMALINK_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://isonomia.app";

/** Canonical public URL for a claim */
export function getClaimPermalinkUrl(moid: string): string {
  return `${PERMALINK_BASE_URL}/c/${moid}`;
}

/** URL for the embeddable claim widget */
export function getClaimEmbedUrl(moid: string): string {
  return `${PERMALINK_BASE_URL}/embed/claim/${moid}`;
}

/** URL for the OG social-preview image for a claim */
export function getClaimOgImageUrl(moid: string): string {
  return `${PERMALINK_BASE_URL}/api/og/claim/${moid}`;
}

/**
 * Build the oEmbed discover URL for a claim embed URL.
 * Follows the existing oEmbed provider pattern.
 */
export function getClaimOembedUrl(moid: string): string {
  const embedUrl = getClaimEmbedUrl(moid);
  return `${PERMALINK_BASE_URL}/api/oembed?url=${encodeURIComponent(embedUrl)}`;
}

/**
 * Generate the HTML iframe snippet for embedding a claim.
 */
export function generateClaimIframeCode(
  moid: string,
  theme: "auto" | "light" | "dark" = "auto",
  compact = false
): string {
  const params = new URLSearchParams();
  if (theme !== "auto") params.set("theme", theme);
  if (compact) params.set("compact", "true");

  const base = getClaimEmbedUrl(moid);
  const src = params.toString() ? `${base}?${params}` : base;
  const height = compact ? 160 : 280;

  return `<iframe
  src="${src}"
  width="600"
  height="${height}"
  frameborder="0"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
  title="Isonomia Claim"
  loading="lazy"
></iframe>`;
}
