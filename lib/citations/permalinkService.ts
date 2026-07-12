/**
 * Service for managing argument permalinks
 * Phase 3.2: Argument-Level Citations
 */

import { prisma } from "@/lib/prismaclient";
import crypto from "crypto";
import slugify from "slugify";
import {
  ArgumentPermalinkInfo,
  CitationFormat,
  CitationTextResult,
} from "./argumentCitationTypes";

const PERMALINK_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mesh.app";

// ============================================================
// SHORT CODE GENERATION
// ============================================================

/**
 * Generate a URL-safe short code for permalinks
 * Uses base62 encoding (alphanumeric only)
 */
function generateShortCode(length: number = 8): string {
  const bytes = crypto.randomBytes(length);
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (const byte of bytes) {
    result += chars[byte % chars.length];
  }
  return result;
}

/**
 * Generate a human-readable slug from argument text
 */
function generateSlug(text: string, deliberationTitle?: string): string {
  // Combine deliberation title and argument text for better context
  const combined = deliberationTitle 
    ? `${deliberationTitle} ${text}`.slice(0, 100)
    : text.slice(0, 100);
  
  return slugify(combined, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
}

// ============================================================
// PERMALINK CRUD
// ============================================================

/**
 * Get or create a permalink for an argument
 */
export async function getOrCreatePermalink(
  argumentId: string
): Promise<ArgumentPermalinkInfo> {
  // Check for existing permalink
  const existing = await prisma.argumentPermalink.findUnique({
    where: { argumentId },
  });

  if (existing) {
    return formatPermalinkInfo(existing);
  }

  // Fetch argument details for slug generation
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    include: {
      deliberation: {
        select: { title: true },
      },
    },
  });

  if (!argument) {
    throw new Error(`Argument not found: ${argumentId}`);
  }

  // Generate unique short code
  let shortCode = generateShortCode();
  let attempts = 0;
  while (attempts < 5) {
    const exists = await prisma.argumentPermalink.findUnique({
      where: { shortCode },
    });
    if (!exists) break;
    shortCode = generateShortCode();
    attempts++;
  }

  // Generate slug
  const slug = generateSlug(argument.text, argument.deliberation?.title ?? undefined);

  // Create permalink
  const permalink = await prisma.argumentPermalink.create({
    data: {
      argumentId,
      shortCode,
      slug,
      permalinkUrl: `${PERMALINK_BASE_URL}/a/${shortCode}`,
      version: 1,
      accessCount: 0,
    },
  });

  return formatPermalinkInfo(permalink);
}

/**
 * Get permalink info for an argument (without creating)
 */
export async function getPermalinkInfo(
  argumentId: string
): Promise<ArgumentPermalinkInfo | null> {
  const permalink = await prisma.argumentPermalink.findUnique({
    where: { argumentId },
  });

  if (!permalink) return null;
  return formatPermalinkInfo(permalink);
}

/**
 * Resolve a permalink identifier to an argument
 * Accepts short code or slug
 */
export async function resolvePermalink(
  identifier: string
): Promise<{ argumentId: string; version: number } | null> {
  // Try short code first (faster lookup)
  let permalink = await prisma.argumentPermalink.findUnique({
    where: { shortCode: identifier },
  });

  // Try slug if not found by short code
  if (!permalink) {
    permalink = await prisma.argumentPermalink.findFirst({
      where: { slug: identifier },
    });
  }

  if (!permalink) return null;

  // Increment access count (fire and forget)
  prisma.argumentPermalink.update({
    where: { id: permalink.id },
    data: {
      accessCount: { increment: 1 },
      lastAccessedAt: new Date(),
    },
  }).catch(() => {
    // Ignore errors for access tracking
  });

  return {
    argumentId: permalink.argumentId,
    version: permalink.version,
  };
}

/**
 * Bump permalink version (when argument significantly changes)
 */
export async function bumpPermalinkVersion(argumentId: string): Promise<void> {
  await prisma.argumentPermalink.update({
    where: { argumentId },
    data: {
      version: { increment: 1 },
    },
  });
}

/**
 * Increment access count for a permalink (for tracking purposes)
 * Called separately when access is tracked outside resolvePermalink
 */
export async function incrementPermalinkAccess(identifier: string): Promise<void> {
  // Try short code first
  let permalink = await prisma.argumentPermalink.findUnique({
    where: { shortCode: identifier },
  });

  // Try slug if not found
  if (!permalink) {
    permalink = await prisma.argumentPermalink.findFirst({
      where: { slug: identifier },
    });
  }

  if (permalink) {
    await prisma.argumentPermalink.update({
      where: { id: permalink.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    }).catch(() => {
      // Ignore errors for access tracking
    });
  }
}

// ============================================================
// CITATION TEXT GENERATION
// ============================================================

/**
 * Generate citation text in various academic formats
 */
export async function generateCitationText(
  argumentId: string,
  format: CitationFormat = "apa"
): Promise<CitationTextResult> {
  const argument = await prisma.argument.findUnique({
    where: { id: argumentId },
    include: {
      deliberation: {
        select: { title: true },
      },
      permalink: true,
    },
  });

  if (!argument) {
    throw new Error(`Argument not found: ${argumentId}`);
  }

  // Get author info
  const author = await prisma.user.findFirst({
    where: { auth_id: argument.authorId },
    select: { name: true, id: true },
  });

  const authorName = author?.name || "Unknown Author";
  const deliberationTitle = argument.deliberation.title;
  const year = argument.createdAt.getFullYear();
  const accessDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  
  const permalinkUrl = argument.permalink?.permalinkUrl || 
    `${PERMALINK_BASE_URL}/a/${argument.id}`;

  // Truncate argument text for citation
  const truncatedText = argument.text.length > 100
    ? `${argument.text.slice(0, 100)}...`
    : argument.text;

  let text: string;
  let key: string | undefined;

  switch (format) {
    case "apa":
      text = `${authorName}. (${year}). ${truncatedText} In ${deliberationTitle}. Mesh. Retrieved ${accessDate}, from ${permalinkUrl}`;
      break;

    case "mla":
      text = `${authorName}. "${truncatedText}" ${deliberationTitle}, Mesh, ${year}, ${permalinkUrl}. Accessed ${accessDate}.`;
      break;

    case "chicago":
      text = `${authorName}. "${truncatedText}" In ${deliberationTitle}. Mesh, ${year}. ${permalinkUrl}.`;
      break;

    case "bibtex":
      key = `mesh${argument.id.slice(0, 8)}${year}`;
      text = `@misc{${key},
  author = {${authorName}},
  title = {${truncatedText}},
  howpublished = {In ${deliberationTitle}, Mesh platform},
  year = {${year}},
  url = {${permalinkUrl}},
  note = {Accessed: ${accessDate}}
}`;
      break;

    case "mesh":
      // Mesh-native format with full metadata
      text = `[${authorName}] "${truncatedText}" — ${deliberationTitle} (${year}) ${permalinkUrl}`;
      break;

    default:
      text = `${authorName}. "${truncatedText}" ${deliberationTitle}, ${year}. ${permalinkUrl}`;
  }

  return {
    format,
    text,
    key,
  };
}

/**
 * Generate all citation formats at once
 */
export async function generateAllCitationFormats(
  argumentId: string
): Promise<CitationTextResult[]> {
  const formats: CitationFormat[] = ["apa", "mla", "chicago", "bibtex", "mesh"];
  const results: CitationTextResult[] = [];

  for (const format of formats) {
    const result = await generateCitationText(argumentId, format);
    results.push(result);
  }

  return results;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Format permalink database record for API response
 */
function formatPermalinkInfo(permalink: {
  shortCode: string;
  slug: string | null;
  permalinkUrl: string;
  version: number;
  accessCount: number;
  createdAt: Date;
}): ArgumentPermalinkInfo {
  return {
    shortCode: permalink.shortCode,
    slug: permalink.slug,
    fullUrl: permalink.permalinkUrl,
    version: permalink.version,
    accessCount: permalink.accessCount,
    createdAt: permalink.createdAt,
  };
}
