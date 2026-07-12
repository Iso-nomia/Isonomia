/**
 * Q-018 — OntoClean meta-property matrix (skeleton).
 *
 * Spec: ../Development and Ideation Documents/ARCHITECTURE/SCHEMES_IMPL_AUDIT_PROTOCOLS.md §3 (Q-018)
 * Output: audits/q018-ontoclean-<YYYYMMDD>.json
 *
 * The four meta-property assignments (rigidity, identity, unity,
 * dependence) are analyst judgements per Guarino & Welty 2009
 * ch. 8 and cannot be derived from SQL. This script lays down the
 * row skeleton with default "non-rigid" / "no-identity" /
 * "no-unity" / "independent" + flags off; the analyst then edits
 * the JSON and re-runs a formatter (TODO: add formatter once the
 * analyst pass produces classification conventions).
 */

import { prisma } from "@/lib/prismaclient";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

type Rigidity = "rigid" | "non-rigid" | "anti-rigid";
type Identity = "carries-identity" | "no-identity";
type Unity = "carries-unity" | "no-unity";
type Dependence = "dependent" | "independent";

type OntoCleanRow = {
  id: string;
  key: string;
  name: string | null;
  clusterTag: string | null;
  parentSchemeId: string | null;
  parentKey: string | null;
  parentClusterTag: string | null;
  rigidity: Rigidity;
  identity: Identity;
  unity: Unity;
  dependence: Dependence;
  isAntiRigid: boolean;
  ontoCleanViolation: boolean;
  violationDescription: string;
  classifierNotes: string;
};

type Q018Output = {
  generatedAtIso: string;
  totalCount: number;
  rows: OntoCleanRow[];
  byRigidity: Record<Rigidity, number>;
  violationsCount: number;
  violatingClusterTags: string[];
};

function todayStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function main(): Promise<void> {
  const rows = await prisma.argumentScheme.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      clusterTag: true,
      parentSchemeId: true,
      parentScheme: {
        select: { key: true, clusterTag: true },
      },
    } as any,
    orderBy: [{ clusterTag: "asc" }, { key: "asc" }] as any,
  }) as any[];

  const out: OntoCleanRow[] = rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name ?? null,
    clusterTag: r.clusterTag ?? null,
    parentSchemeId: r.parentSchemeId ?? null,
    parentKey: r.parentScheme?.key ?? null,
    parentClusterTag: r.parentScheme?.clusterTag ?? null,
    rigidity: "non-rigid",
    identity: "no-identity",
    unity: "no-unity",
    dependence: "independent",
    isAntiRigid: false,
    ontoCleanViolation: false,
    violationDescription: "",
    classifierNotes: "",
  }));

  const output: Q018Output = {
    generatedAtIso: new Date().toISOString(),
    totalCount: out.length,
    rows: out,
    byRigidity: {
      rigid: 0,
      "non-rigid": out.length,
      "anti-rigid": 0,
    },
    violationsCount: 0,
    violatingClusterTags: [],
  };

  const outPath = join(
    process.cwd(),
    "audits",
    `q018-ontoclean-${todayStamp()}.json`,
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

  console.log(`[q018] wrote skeleton ${outPath} — ${out.length} schemes`);
  console.log(
    `[q018] all four meta-properties default to the 'absent' value. Fill in by editing the JSON per Guarino & Welty 2009 ch. 8.`,
  );
}

main()
  .catch((err) => {
    console.error("[q018] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
