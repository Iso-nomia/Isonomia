/**
 * Shared in-memory arena storage for the DDS arena routes.
 *
 * Extracted into its own module so other route handlers can import these
 * maps without violating Next.js' rule that route files should only export
 * HTTP method handlers (and a small set of config exports).
 */

import type { UniversalArena } from "@/packages/ludics-core/dds/arena/client";

export type ArenaRecord = {
  id: string;
  name: string;
  deliberationId: string;
  arena: UniversalArena;
  createdAt: Date;
  metadata?: {
    sourceDesignIds?: string[];
    scope?: string;
    maxDepth?: number;
    maxRamification?: number;
  };
};

// Maps deliberationId -> arenas[]
export const arenaStore: Map<string, ArenaRecord[]> = new Map();

// Global arena lookup by ID
export const arenaById: Map<
  string,
  UniversalArena & { name?: string; deliberationId?: string; createdAt?: Date }
> = new Map();
