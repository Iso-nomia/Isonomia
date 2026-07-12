/**
 * Q-019 — `inheritCQs: false` audit.
 *
 * Spec: ../Development and Ideation Documents/ARCHITECTURE/SCHEMES_IMPL_AUDIT_PROTOCOLS.md §3 (Q-019)
 * Output: audits/q019-inherit-cqs-false-<YYYYMMDD>.json
 *
 * Read-only. Counts ArgumentScheme rows with `inheritCQs = false`,
 * joins parent metadata, computes CQ-key overlap/suppressed/added
 * vs parent. The intent classification (sibling-misuse / workaround
 * / genuine-child-different-cqs / unknown) is left as "unknown" by
 * the script and filled in by hand in a follow-on classification
 * pass against the same dated file.
 */

import { prisma } from "@/lib/prismaclient";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

type Intent =
  | "sibling-misuse"
  | "workaround"
  | "genuine-child-different-cqs"
  | "unknown";

type InheritFalseRow = {
  id: string;
  key: string;
  name: string | null;
  parentSchemeId: string | null;
  parentKey: string | null;
  clusterTag: string | null;
  parentClusterTag: string | null;
  ownCqCount: number;
  parentCqCount: number;
  cqKeyOverlap: string[];
  cqKeysSuppressed: string[];
  cqKeysAdded: string[];
  usageCount: number;
  intent: Intent;
  classifierNotes: string;
};

type Q019Output = {
  generatedAtIso: string;
  totalCount: number;
  totalCatalogueSize: number;
  fraction: number;
  rows: InheritFalseRow[];
  byIntent: Record<Intent, number>;
};

function todayStamp(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

async function main(): Promise<void> {
  const totalCatalogueSize = await prisma.argumentScheme.count();

  // Pull all inheritCQs=false rows with parent join + CQ keys for both sides.
  const rows = await prisma.argumentScheme.findMany({
    where: { inheritCQs: false } as any,
    select: {
      id: true,
      key: true,
      name: true,
      parentSchemeId: true,
      clusterTag: true,
      usageCount: true,
      cqs: { select: { cqKey: true } },
      parentScheme: {
        select: {
          key: true,
          clusterTag: true,
          cqs: { select: { cqKey: true } },
        },
      },
    } as any,
    orderBy: { key: "asc" } as any,
  }) as any[];

  const out: InheritFalseRow[] = rows.map((r) => {
    const ownKeys: string[] = (r.cqs ?? [])
      .map((c: any) => c.cqKey)
      .filter((k: string | null): k is string => Boolean(k));
    const parentKeys: string[] = (r.parentScheme?.cqs ?? [])
      .map((c: any) => c.cqKey)
      .filter((k: string | null): k is string => Boolean(k));

    const ownSet = new Set(ownKeys);
    const parentSet = new Set(parentKeys);

    const cqKeyOverlap = ownKeys.filter((k) => parentSet.has(k));
    const cqKeysSuppressed = parentKeys.filter((k) => !ownSet.has(k));
    const cqKeysAdded = ownKeys.filter((k) => !parentSet.has(k));

    return {
      id: r.id,
      key: r.key,
      name: r.name ?? null,
      parentSchemeId: r.parentSchemeId ?? null,
      parentKey: r.parentScheme?.key ?? null,
      clusterTag: r.clusterTag ?? null,
      parentClusterTag: r.parentScheme?.clusterTag ?? null,
      ownCqCount: ownKeys.length,
      parentCqCount: parentKeys.length,
      cqKeyOverlap,
      cqKeysSuppressed,
      cqKeysAdded,
      usageCount: r.usageCount ?? 0,
      intent: "unknown",
      classifierNotes: "",
    };
  });

  const byIntent: Record<Intent, number> = {
    "sibling-misuse": 0,
    workaround: 0,
    "genuine-child-different-cqs": 0,
    unknown: out.length,
  };

  const totalCount = out.length;
  const output: Q019Output = {
    generatedAtIso: new Date().toISOString(),
    totalCount,
    totalCatalogueSize,
    fraction:
      totalCatalogueSize > 0 ? totalCount / totalCatalogueSize : 0,
    rows: out,
    byIntent,
  };

  const stamp = todayStamp();
  const outPath = join(
    process.cwd(),
    "audits",
    `q019-inherit-cqs-false-${stamp}.json`,
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log(
    `[q019] wrote ${outPath} — ${totalCount} rows / ${totalCatalogueSize} catalogue (${(
      output.fraction * 100
    ).toFixed(2)}%)`,
  );
  console.log(
    `[q019] all rows currently classified as 'unknown'. Classify them by editing the JSON and re-running the formatter.`,
  );
}

main()
  .catch((err) => {
    console.error("[q019] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
