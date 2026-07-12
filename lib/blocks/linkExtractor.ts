/**
 * Link Metadata Extractor
 * 
 * Phase 1.2 of Stacks Improvement Roadmap
 * 
 * Extracts Open Graph tags, meta tags, and readable content from URLs.
 */

export interface LinkMetadata {
  canonical: string;
  title: string;
  description: string;
  image: string | null;
  favicon: string | null;
  siteName: string | null;
  readableText: string | null;
  author: string | null;
  publishedDate: string | null;
}

/**
 * Extract metadata from a URL
 * Returns partial metadata for non-HTML content types (PDFs, images, etc.)
 */
export async function extractLinkMetadata(url: string): Promise<LinkMetadata> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "MeshBot/1.0 (+https://mesh.so/bot)",
      "Accept": "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10000), // 10 second timeout
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const finalUrl = response.url; // After redirects
  
  // Handle non-HTML content types gracefully
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
    // Extract basic info from URL for non-HTML content
    const parsedUrl = new URL(finalUrl);
    const filename = parsedUrl.pathname.split("/").pop() || "";
    const extension = filename.split(".").pop()?.toUpperCase() || "";
    
    let title = filename || parsedUrl.hostname;
    let description = `${extension} file from ${parsedUrl.hostname}`;
    
    if (contentType.includes("application/pdf")) {
      description = `PDF document from ${parsedUrl.hostname}`;
    } else if (contentType.includes("image/")) {
      description = `Image from ${parsedUrl.hostname}`;
    } else if (contentType.includes("video/")) {
      description = `Video from ${parsedUrl.hostname}`;
    }
    
    return {
      canonical: finalUrl,
      title,
      description,
      image: contentType.includes("image/") ? finalUrl : null,
      favicon: `${parsedUrl.origin}/favicon.ico`,
      siteName: parsedUrl.hostname,
      readableText: null,
      author: null,
      publishedDate: null,
    };
  }

  const html = await response.text();

  return parseHtmlMetadata(html, finalUrl);
}

/**
 * Parse metadata from HTML content
 */
export function parseHtmlMetadata(html: string, baseUrl: string): LinkMetadata {
  // Helper to extract meta content
  const getMeta = (nameOrProperty: string): string | null => {
    // Try property first (OG tags)
    const propMatch = html.match(
      new RegExp(`<meta[^>]+property=["']${nameOrProperty}["'][^>]+content=["']([^"']+)["']`, "i")
    );
    if (propMatch) return decodeHtmlEntities(propMatch[1]);

    // Try reversed order
    const propMatchRev = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${nameOrProperty}["']`, "i")
    );
    if (propMatchRev) return decodeHtmlEntities(propMatchRev[1]);

    // Try name attribute
    const nameMatch = html.match(
      new RegExp(`<meta[^>]+name=["']${nameOrProperty}["'][^>]+content=["']([^"']+)["']`, "i")
    );
    if (nameMatch) return decodeHtmlEntities(nameMatch[1]);

    // Try reversed order for name
    const nameMatchRev = html.match(
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${nameOrProperty}["']`, "i")
    );
    if (nameMatchRev) return decodeHtmlEntities(nameMatchRev[1]);

    return null;
  };

  // Extract title
  const ogTitle = getMeta("og:title");
  const twitterTitle = getMeta("twitter:title");
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = ogTitle || twitterTitle || (titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : new URL(baseUrl).hostname);

  // Extract description
  const description = getMeta("og:description") || getMeta("twitter:description") || getMeta("description") || "";

  // Extract image
  let image: string | null = getMeta("og:image") || getMeta("twitter:image") || getMeta("twitter:image:src") || null;
  if (image && !image.startsWith("http")) {
    try {
      image = new URL(image, baseUrl).href;
    } catch {
      image = null;
    }
  }

  // Extract canonical URL
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const canonicalMatchRev = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const canonical = canonicalMatch?.[1] || canonicalMatchRev?.[1] || baseUrl;

  // Extract favicon
  const faviconMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']+)["']/i);
  const faviconMatchRev = html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon)["']/i);
  let favicon: string | null = faviconMatch?.[1] || faviconMatchRev?.[1] || null;
  if (favicon && !favicon.startsWith("http")) {
    try {
      favicon = new URL(favicon, baseUrl).href;
    } catch {
      favicon = null;
    }
  }
  if (!favicon) {
    try {
      favicon = new URL("/favicon.ico", baseUrl).href;
    } catch {
      favicon = null;
    }
  }

  // Extract site name
  const siteName = getMeta("og:site_name") || getMeta("application-name");

  // Extract author
  const author = getMeta("author") || getMeta("article:author");

  // Extract published date
  const publishedDate = getMeta("article:published_time") || getMeta("datePublished") || getMeta("date");

  // Extract readable text (simplified - just grab body text)
  const readableText = extractReadableText(html);

  return {
    canonical,
    title,
    description,
    image,
    favicon,
    siteName,
    readableText,
    author,
    publishedDate,
  };
}

/**
 * Extract readable text content from HTML
 */
function extractReadableText(html: string): string {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Try to find main content area
  const mainMatch = text.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i);
  if (mainMatch) {
    text = mainMatch[1];
  }

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  // Clean up whitespace
  text = text
    .replace(/\s+/g, " ")
    .trim();

  // Limit length
  return text.slice(0, 10000);
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Parse video URL to extract provider and embed ID
 */
export function parseVideoUrl(url: string): {
  provider: string;
  embedId: string | null;
  thumbnail: string | null;
} {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return {
      provider: "youtube",
      embedId: ytMatch[1],
      thumbnail: `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`,
    };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return {
      provider: "vimeo",
      embedId: vimeoMatch[1],
      thumbnail: null, // Would need API call
    };
  }

  // Loom
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) {
    return {
      provider: "loom",
      embedId: loomMatch[1],
      thumbnail: `https://cdn.loom.com/sessions/thumbnails/${loomMatch[1]}-with-play.gif`,
    };
  }

  return { provider: "direct", embedId: null, thumbnail: null };
}

/**
 * Strip markdown formatting to get plain text
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s/g, "")                    // Headers
    .replace(/\*\*([^*]+)\*\*/g, "$1")           // Bold
    .replace(/__([^_]+)__/g, "$1")               // Bold
    .replace(/\*([^*]+)\*/g, "$1")               // Italic
    .replace(/_([^_]+)_/g, "$1")                 // Italic
    .replace(/~~([^~]+)~~/g, "$1")               // Strikethrough
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")     // Links
    .replace(/`{1,3}[^`]*`{1,3}/g, "")           // Code
    .replace(/^>\s+/gm, "")                      // Blockquotes
    .replace(/^[-*+]\s+/gm, "")                  // Unordered lists
    .replace(/^\d+\.\s+/gm, "")                  // Ordered lists
    .replace(/^---+$/gm, "")                     // Horizontal rules
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")    // Images
    .replace(/\n{2,}/g, "\n")                    // Multiple newlines
    .trim();
}
