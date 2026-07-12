/**
 * Typology — Axis registry helpers
 *
 * Read-side accessors for the `DisagreementAxis` table. The seeder lives at
 * `prisma/seed/typologyAxes.ts`; this module is what services / routes call
 * to validate axis keys and pin `axisVersion` at proposal time.
 *
 * Status: B1 scaffold.
 */

import { prisma } from "@/lib/prismaclient";
import {
  DisagreementAxisKey,
  type DisagreementAxis,
} from "./types";

function rowToDomain(row: {
  id: string;
  key: string;
  displayName: string;
  description: string;
  colorToken: string;
  interventionHint: string;
  version: number;
  isActive: boolean;
  seededAt: Date;
}): DisagreementAxis {
  return {
    id: row.id,
    key: row.key as DisagreementAxisKey,
    displayName: row.displayName,
    description: row.description,
    colorToken: row.colorToken,
    interventionHint: row.interventionHint,
    version: row.version,
    isActive: row.isActive,
    seededAt: row.seededAt,
  };
}

export async function listAxes(opts: { activeOnly?: boolean } = {}): Promise<DisagreementAxis[]> {
  const rows = await prisma.disagreementAxis.findMany({
    where: opts.activeOnly ? { isActive: true } : undefined,
    orderBy: { key: "asc" },
  });
  return rows.map(rowToDomain);
}

export async function getAxisByKey(key: DisagreementAxisKey): Promise<DisagreementAxis | null> {
  const row = await prisma.disagreementAxis.findUnique({ where: { key } });
  return row ? rowToDomain(row) : null;
}

export async function getAxisById(id: string): Promise<DisagreementAxis | null> {
  const row = await prisma.disagreementAxis.findUnique({ where: { id } });
  return row ? rowToDomain(row) : null;
}

/**
 * Resolve an axis from `key`, returning `{ axisId, axisVersion }` ready to
 * pin onto a `DisagreementTag` or `TypologyCandidate`. Throws when the axis
 * is missing or `isActive = false` so route handlers can map to the
 * `CONFLICT_AXIS_INACTIVE` error code.
 */
export async function resolveActiveAxis(
  key: DisagreementAxisKey,
): Promise<{ axisId: string; axisVersion: number }> {
  const axis = await getAxisByKey(key);
  if (!axis) {
    throw new AxisRegistryError("AXIS_NOT_FOUND", `axis not found: ${key}`);
  }
  if (!axis.isActive) {
    throw new AxisRegistryError("CONFLICT_AXIS_INACTIVE", `axis inactive: ${key}`);
  }
  return { axisId: axis.id, axisVersion: axis.version };
}

export class AxisRegistryError extends Error {
  constructor(
    public readonly code: "AXIS_NOT_FOUND" | "CONFLICT_AXIS_INACTIVE",
    message: string,
  ) {
    super(message);
    this.name = "AxisRegistryError";
  }
}
