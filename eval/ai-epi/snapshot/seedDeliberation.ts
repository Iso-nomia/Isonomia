/**
 * Materializes a `DeliberationSpec` as a real Prisma graph and returns
 * id mappings + a cleanup function. Used by the snapshot capture
 * pipeline (`captureFixture.ts`) to produce corpus-v2 fixtures.
 *
 * Design notes:
 *
 *   - Schemes are upserted by `key` (idempotent). Spec authors should
 *     reuse standard scheme keys where reasonable.
 *   - CriticalQuestion rows are upserted by (schemeId, cqKey).
 *   - Claims use a per-run nonce in `moid` to avoid the unique
 *     constraint colliding across concurrent or repeated runs.
 *   - The Deliberation's cascade deletes Arguments, ArgumentEdges, and
 *     ArgumentPremise rows automatically. CQStatus rows are NOT
 *     cascade-linked (targetId is an opaque string), so cleanup deletes
 *     them explicitly. The Claim row's deliberationId FK is cascade,
 *     so claims with `deliberationId` set are removed automatically;
 *     any claims without `deliberationId` are left in place.
 *   - The DeliberationFingerprintCache row is deleted explicitly (no
 *     cascade FK to Deliberation by design — caches are write-through
 *     and tolerate orphans, but cleanup keeps the test DB tidy).
 *
 * This module touches the real Prisma client. Callers must have
 * `DATABASE_URL` set.
 */

import { prisma } from "@/lib/prismaclient";
import type {
  DeliberationSpec,
  SeededDeliberation,
  SpecScheme,
} from "./types";

/**
 * Stable test-run author id so we can identify and clean up rows that
 * leak from a crashed capture. Captures should run against an isolated
 * dev DB anyway; this is just defense-in-depth.
 */
const TEST_AUTHOR_ID = "ai-epi-snapshot-author";

/**
 * Stable hostId namespace. The snapshot pipeline never lists or queries
 * deliberations by hostId, so this is purely cosmetic / for grep.
 */
const TEST_HOST_NAMESPACE = "ai-epi-snapshot";

export async function seedDeliberation(
  spec: DeliberationSpec,
): Promise<SeededDeliberation> {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // 1. Upsert schemes referenced by any argument (and any standalone
  //    scheme references on cqStatuses, just in case the author put a
  //    cqStatus against a scheme not declared on an argument).
  const schemeMap = new Map<string, SpecScheme>();
  for (const arg of spec.arguments) {
    if (arg.scheme) schemeMap.set(arg.scheme.key, arg.scheme);
  }
  const schemeIds: Record<string, string> = {};
  for (const scheme of schemeMap.values()) {
    const upserted = await prisma.argumentScheme.upsert({
      where: { key: scheme.key },
      update: { name: scheme.name, summary: scheme.summary },
      create: {
        key: scheme.key,
        name: scheme.name,
        summary: scheme.summary,
      },
      select: { id: true },
    });
    schemeIds[scheme.key] = upserted.id;

    // Upsert each CQ belonging to this scheme (unique on schemeId+cqKey).
    for (const cq of scheme.cqs) {
      const existing = await prisma.criticalQuestion.findFirst({
        where: { schemeId: upserted.id, cqKey: cq.cqKey },
        select: { id: true },
      });
      if (existing) {
        await prisma.criticalQuestion.update({
          where: { id: existing.id },
          data: { text: cq.text },
        });
      } else {
        await prisma.criticalQuestion.create({
          data: {
            schemeId: upserted.id,
            cqKey: cq.cqKey,
            text: cq.text,
            attackKind: "UNDERCUTS",
            status: "open",
          },
        });
      }
    }
  }

  // 2. Create the deliberation.
  const deliberation = await prisma.deliberation.create({
    data: {
      hostType: "free",
      hostId: `${TEST_HOST_NAMESPACE}-${nonce}`,
      createdById: TEST_AUTHOR_ID,
      title: `[snapshot] ${spec.slug}`,
    },
    select: { id: true },
  });
  const deliberationId = deliberation.id;

  // 3. Create claims (deliberationId set so cascade-delete works).
  const claimIds: Record<string, string> = {};
  for (const claim of spec.claims) {
    const created = await prisma.claim.create({
      data: {
        text: claim.text,
        createdById: TEST_AUTHOR_ID,
        moid: `${claim.id}-${nonce}`,
        deliberationId,
      },
      select: { id: true },
    });
    claimIds[claim.id] = created.id;
  }

  // 4. Create arguments + premises + scheme-instances.
  const argumentIds: Record<string, string> = {};
  for (const arg of spec.arguments) {
    const conclusionDbId = arg.conclusionClaimId
      ? claimIds[arg.conclusionClaimId]
      : undefined;
    if (arg.conclusionClaimId && !conclusionDbId) {
      throw new Error(
        `Spec ${spec.slug}: argument ${arg.id} references unknown conclusion claim ${arg.conclusionClaimId}`,
      );
    }
    const createdArg = await prisma.argument.create({
      data: {
        deliberationId,
        authorId: TEST_AUTHOR_ID,
        text: arg.text,
        conclusionClaimId: conclusionDbId ?? null,
      },
      select: { id: true },
    });
    argumentIds[arg.id] = createdArg.id;

    for (const premiseLocalId of arg.premiseClaimIds) {
      const premiseDbId = claimIds[premiseLocalId];
      if (!premiseDbId) {
        throw new Error(
          `Spec ${spec.slug}: argument ${arg.id} references unknown premise claim ${premiseLocalId}`,
        );
      }
      await prisma.argumentPremise.create({
        data: {
          argumentId: createdArg.id,
          claimId: premiseDbId,
        },
      });
    }

    if (arg.scheme) {
      const schemeDbId = schemeIds[arg.scheme.key];
      if (!schemeDbId) {
        throw new Error(
          `Spec ${spec.slug}: argument ${arg.id} references unseeded scheme ${arg.scheme.key}`,
        );
      }
      await prisma.argumentSchemeInstance.create({
        data: {
          argumentId: createdArg.id,
          schemeId: schemeDbId,
          isPrimary: true,
          confidence: 1.0,
        },
      });
    }
  }

  // 5. Create edges.
  for (const edge of spec.edges) {
    const fromDbId = argumentIds[edge.from];
    const toDbId = argumentIds[edge.to];
    if (!fromDbId || !toDbId) {
      throw new Error(
        `Spec ${spec.slug}: edge ${edge.from}→${edge.to} references unknown argument`,
      );
    }
    const targetPremiseDbId = edge.targetPremiseClaimId
      ? claimIds[edge.targetPremiseClaimId]
      : null;
    await prisma.argumentEdge.create({
      data: {
        deliberationId,
        fromArgumentId: fromDbId,
        toArgumentId: toDbId,
        type: edge.type,
        cqKey: edge.cqKey ?? null,
        targetPremiseId: targetPremiseDbId,
        createdById: TEST_AUTHOR_ID,
      },
    });
  }

  // 6. Seed CQStatus rows.
  for (const cq of spec.cqStatuses) {
    const targetDbId = argumentIds[cq.targetArgumentId];
    if (!targetDbId) {
      throw new Error(
        `Spec ${spec.slug}: cqStatus targets unknown argument ${cq.targetArgumentId}`,
      );
    }
    await prisma.cQStatus.create({
      data: {
        targetType: "argument",
        targetId: targetDbId,
        argumentId: targetDbId,
        schemeKey: cq.schemeKey,
        cqKey: cq.cqKey,
        statusEnum: cq.status,
        createdById: TEST_AUTHOR_ID,
      },
    });
  }

  // 7. Build cleanup closure.
  const cleanup = async (): Promise<void> => {
    const argIdValues = Object.values(argumentIds);

    // CQStatus has no FK to Argument (targetId is opaque); delete explicitly.
    if (argIdValues.length > 0) {
      await prisma.cQStatus.deleteMany({
        where: {
          targetType: "argument",
          targetId: { in: argIdValues },
        },
      });
    }

    // FingerprintCache: delete by deliberationId (no cascade).
    await prisma.deliberationFingerprintCache
      .deleteMany({ where: { deliberationId } })
      .catch(() => {
        /* table may not exist in some test DBs; non-fatal */
      });

    // Deliberation cascade handles: arguments, edges, premises,
    // schemeInstances, claims (deliberationId-scoped).
    await prisma.deliberation.delete({ where: { id: deliberationId } });

    // Schemes + CQs are intentionally left in place — they're shared
    // by-key across runs and inserting them was idempotent.
  };

  return {
    deliberationId,
    argumentIds,
    claimIds,
    schemeIds,
    cleanup,
  };
}
