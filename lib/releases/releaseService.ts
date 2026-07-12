/**
 * Release Service - Main CRUD Operations
 *
 * Phase 2.1: Debate Releases & Versioned Memory
 *
 * Orchestrates release creation, retrieval, and comparison.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  parseVersion,
  formatVersion,
  incrementVersion,
  SemanticVersion,
  Changelog,
  ClaimSnapshot,
  ArgumentSnapshot,
  StatsSnapshot,
} from "./types";
import { generateClaimSnapshot, generateArgumentSnapshot, generateStatsSnapshot } from "./snapshotService";
import { generateChangelog, formatChangelogText, generateChangelogOneLiner } from "./changelogService";

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

export interface CreateReleaseInput {
  deliberationId: string;
  title?: string;
  description?: string;
  versionType?: "major" | "minor" | "patch";
  createdById: string;
}

export interface ReleaseOutput {
  id: string;
  deliberationId: string;
  versionMajor: number;
  versionMinor: number;
  versionPatch: number;
  version: string;
  title: string | null;
  description: string | null;
  citationUri: string;
  bibtex: string | null;
  claimSnapshot: ClaimSnapshot;
  argumentSnapshot: ArgumentSnapshot;
  statsSnapshot: StatsSnapshot | null;
  changelog: Changelog | null;
  changelogText: string | null;
  createdById: string;
  createdAt: Date;
}

export interface ReleaseListItem {
  id: string;
  version: string;
  title: string | null;
  description: string | null;
  claimsCount: number;
  argumentsCount: number;
  defendedCount: number;
  citationUri: string;
  createdAt: Date;
  createdByName: string;
}

export interface CompareReleasesOutput {
  fromRelease: ReleaseListItem;
  toRelease: ReleaseListItem;
  changelog: Changelog;
  changelogText: string;
}

// Build a "x.y.z" version string from numeric components without needing a full SemanticVersion.
function verStr(major: number, minor: number, patch: number): string {
  return formatVersion({ major, minor, patch, raw: `${major}.${minor}.${patch}` });
}

// ─────────────────────────────────────────────────────────
// Create Release
// ─────────────────────────────────────────────────────────

/**
 * Create a new release for a deliberation
 *
 * Takes a point-in-time snapshot of all claims and arguments,
 * calculates statuses, and generates changelog from previous version.
 */
export async function createRelease(input: CreateReleaseInput): Promise<ReleaseOutput> {
  const { deliberationId, title, description, versionType = "patch", createdById } = input;

  // 1. Verify deliberation exists
  const deliberation = await prisma.deliberation.findUnique({
    where: { id: deliberationId },
    select: { id: true, title: true },
  });

  if (!deliberation) {
    throw new Error(`Deliberation not found: ${deliberationId}`);
  }

  // 2. Get latest release to determine next version
  const latestRelease = await prisma.debateRelease.findFirst({
    where: { deliberationId },
    orderBy: [
      { major: "desc" },
      { minor: "desc" },
      { patch: "desc" },
    ],
    select: {
      id: true,
      major: true,
      minor: true,
      patch: true,
      claimSnapshot: true,
      argumentSnapshot: true,
    },
  });

  // 3. Calculate next version
  let newVersion: SemanticVersion;
  if (latestRelease) {
    const currentVersion: SemanticVersion = {
      major: latestRelease.major,
      minor: latestRelease.minor,
      patch: latestRelease.patch,
      raw: verStr(latestRelease.major, latestRelease.minor, latestRelease.patch),
    };
    newVersion = incrementVersion(currentVersion, versionType);
  } else {
    // First release starts at 1.0.0
    newVersion = { major: 1, minor: 0, patch: 0, raw: "1.0.0" };
  }

  const versionString = formatVersion(newVersion);

  // 4. Generate snapshots
  const claimSnapshot = await generateClaimSnapshot(deliberationId);
  const argumentSnapshot = await generateArgumentSnapshot(deliberationId);
  const statsSnapshot = await generateStatsSnapshot(deliberationId, claimSnapshot, argumentSnapshot);

  // 5. Generate changelog (if not first release)
  let changelog: Changelog | null = null;
  let changelogText: string | null = null;

  if (latestRelease) {
    const previousClaims = latestRelease.claimSnapshot as unknown as ClaimSnapshot;
    const previousArgs = latestRelease.argumentSnapshot as unknown as ArgumentSnapshot;

    changelog = generateChangelog(
      verStr(latestRelease.major, latestRelease.minor, latestRelease.patch),
      versionString,
      previousClaims,
      claimSnapshot,
      previousArgs,
      argumentSnapshot
    );
    changelogText = formatChangelogText(changelog);
  }

  // 6. Generate citation URI
  const citationUri = generateCitationUri(deliberationId, versionString);

  // 7. Generate BibTeX
  const bibtex = generateBibtex(deliberation.title ?? "Untitled", versionString, citationUri, new Date());

  // 8. Create release record
  const release = await prisma.debateRelease.create({
    data: {
      deliberationId,
      version: versionString,
      major: newVersion.major,
      minor: newVersion.minor,
      patch: newVersion.patch,
      title: title || `Release ${versionString}`,
      summary: description,
      claimSnapshot: claimSnapshot as unknown as Prisma.JsonObject,
      argumentSnapshot: argumentSnapshot as unknown as Prisma.JsonObject,
      statsSnapshot: statsSnapshot as unknown as Prisma.JsonObject,
      changelogFromPrevious: changelog as unknown as Prisma.JsonObject,
      changelogText,
      citationUri,
      bibtex,
      releasedById: createdById,
    },
  });

  return {
    id: release.id,
    deliberationId: release.deliberationId,
    versionMajor: release.major,
    versionMinor: release.minor,
    versionPatch: release.patch,
    version: versionString,
    title: release.title,
    description: release.summary,
    citationUri: release.citationUri ?? citationUri,
    bibtex: release.bibtex,
    claimSnapshot,
    argumentSnapshot,
    statsSnapshot,
    changelog,
    changelogText,
    createdById: release.releasedById,
    createdAt: release.releasedAt,
  };
}

// ─────────────────────────────────────────────────────────
// List Releases
// ─────────────────────────────────────────────────────────

/**
 * List all releases for a deliberation
 */
export async function listReleases(deliberationId: string): Promise<ReleaseListItem[]> {
  const releases = await prisma.debateRelease.findMany({
    where: { deliberationId },
    orderBy: [
      { major: "desc" },
      { minor: "desc" },
      { patch: "desc" },
    ],
    select: {
      id: true,
      major: true,
      minor: true,
      patch: true,
      title: true,
      summary: true,
      claimSnapshot: true,
      citationUri: true,
      releasedAt: true,
    },
  });

  return releases.map((r) => {
    const snapshot = r.claimSnapshot as unknown as ClaimSnapshot;
    return {
      id: r.id,
      version: verStr(r.major, r.minor, r.patch),
      title: r.title,
      description: r.summary,
      claimsCount: snapshot?.stats?.total || 0,
      argumentsCount: 0, // Would need to join with argumentSnapshot
      defendedCount: snapshot?.stats?.defended || 0,
      citationUri: r.citationUri ?? "",
      createdAt: r.releasedAt,
      createdByName: "Unknown",
    };
  });
}

// ─────────────────────────────────────────────────────────
// Get Release
// ─────────────────────────────────────────────────────────

/**
 * Get a specific release by ID or version
 */
export async function getRelease(
  deliberationId: string,
  releaseIdOrVersion: string
): Promise<ReleaseOutput | null> {
  // Try to parse as version first
  let release;
  try {
    const version = parseVersion(releaseIdOrVersion);
    release = await prisma.debateRelease.findFirst({
      where: {
        deliberationId,
        major: version.major,
        minor: version.minor,
        patch: version.patch,
      },
    });
  } catch {
    // Not a valid version string, try as ID
    release = await prisma.debateRelease.findFirst({
      where: {
        id: releaseIdOrVersion,
        deliberationId,
      },
    });
  }

  if (!release) return null;

  const versionString = verStr(release.major, release.minor, release.patch);

  return {
    id: release.id,
    deliberationId: release.deliberationId,
    versionMajor: release.major,
    versionMinor: release.minor,
    versionPatch: release.patch,
    version: versionString,
    title: release.title,
    description: release.summary,
    citationUri: release.citationUri ?? "",
    bibtex: release.bibtex,
    claimSnapshot: release.claimSnapshot as unknown as ClaimSnapshot,
    argumentSnapshot: release.argumentSnapshot as unknown as ArgumentSnapshot,
    statsSnapshot: release.statsSnapshot as unknown as StatsSnapshot,
    changelog: release.changelogFromPrevious as unknown as Changelog,
    changelogText: release.changelogText,
    createdById: release.releasedById,
    createdAt: release.releasedAt,
  };
}

/**
 * Get the latest release for a deliberation
 */
export async function getLatestRelease(deliberationId: string): Promise<ReleaseOutput | null> {
  const release = await prisma.debateRelease.findFirst({
    where: { deliberationId },
    orderBy: [
      { major: "desc" },
      { minor: "desc" },
      { patch: "desc" },
    ],
  });

  if (!release) return null;

  const versionString = verStr(release.major, release.minor, release.patch);

  return {
    id: release.id,
    deliberationId: release.deliberationId,
    versionMajor: release.major,
    versionMinor: release.minor,
    versionPatch: release.patch,
    version: versionString,
    title: release.title,
    description: release.summary,
    citationUri: release.citationUri ?? "",
    bibtex: release.bibtex,
    claimSnapshot: release.claimSnapshot as unknown as ClaimSnapshot,
    argumentSnapshot: release.argumentSnapshot as unknown as ArgumentSnapshot,
    statsSnapshot: release.statsSnapshot as unknown as StatsSnapshot,
    changelog: release.changelogFromPrevious as unknown as Changelog,
    changelogText: release.changelogText,
    createdById: release.releasedById,
    createdAt: release.releasedAt,
  };
}

// ─────────────────────────────────────────────────────────
// Compare Releases
// ─────────────────────────────────────────────────────────

/**
 * Compare two releases and generate a changelog
 */
export async function compareReleases(
  deliberationId: string,
  fromVersionOrId: string,
  toVersionOrId: string
): Promise<CompareReleasesOutput> {
  const fromRelease = await getRelease(deliberationId, fromVersionOrId);
  const toRelease = await getRelease(deliberationId, toVersionOrId);

  if (!fromRelease) {
    throw new Error(`From release not found: ${fromVersionOrId}`);
  }
  if (!toRelease) {
    throw new Error(`To release not found: ${toVersionOrId}`);
  }

  const changelog = generateChangelog(
    fromRelease.version,
    toRelease.version,
    fromRelease.claimSnapshot,
    toRelease.claimSnapshot,
    fromRelease.argumentSnapshot,
    toRelease.argumentSnapshot
  );

  const changelogText = formatChangelogText(changelog);

  return {
    fromRelease: {
      id: fromRelease.id,
      version: fromRelease.version,
      title: fromRelease.title,
      description: fromRelease.description,
      claimsCount: fromRelease.claimSnapshot.stats.total,
      argumentsCount: fromRelease.argumentSnapshot.stats.total,
      defendedCount: fromRelease.claimSnapshot.stats.defended,
      citationUri: fromRelease.citationUri,
      createdAt: fromRelease.createdAt,
      createdByName: "", // Would need join
    },
    toRelease: {
      id: toRelease.id,
      version: toRelease.version,
      title: toRelease.title,
      description: toRelease.description,
      claimsCount: toRelease.claimSnapshot.stats.total,
      argumentsCount: toRelease.argumentSnapshot.stats.total,
      defendedCount: toRelease.claimSnapshot.stats.defended,
      citationUri: toRelease.citationUri,
      createdAt: toRelease.createdAt,
      createdByName: "", // Would need join
    },
    changelog,
    changelogText,
  };
}

// ─────────────────────────────────────────────────────────
// Citation & BibTeX Generation
// ─────────────────────────────────────────────────────────

/**
 * Generate a unique citation URI for a release
 */
function generateCitationUri(deliberationId: string, version: string): string {
  // Format: mesh://deliberation/{id}/release/{version}
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mesh.app";
  return `${baseUrl}/deliberation/${deliberationId}/release/${version}`;
}

/**
 * Generate BibTeX citation entry
 */
function generateBibtex(
  title: string,
  version: string,
  uri: string,
  date: Date
): string {
  const year = date.getFullYear();
  const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase();

  // Generate a citation key from title
  const key = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 30)
    .replace(/_+$/, "");

  return `@misc{${key}_v${version.replace(/\./g, "_")},
  title = {${escapeLatex(title)} (Version ${version})},
  year = {${year}},
  month = {${month}},
  url = {${uri}},
  note = {Mesh Deliberation Release v${version}},
  howpublished = {\\url{${uri}}}
}`;
}

/**
 * Escape special LaTeX characters
 */
function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[%#_&${}]/g, (match) => `\\${match}`)
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

// ─────────────────────────────────────────────────────────
// Barrel Export
// ─────────────────────────────────────────────────────────

export { generateChangelogOneLiner } from "./changelogService";
