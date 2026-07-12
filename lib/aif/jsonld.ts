// lib/aif/jsonld.ts
import ctx from "@/lib/aif/context.json";
import { prisma } from "@/lib/prismaclient";
import { TargetType } from "@prisma/client";
import { AIF_VERSION_STAMP } from "@/lib/aif/version";
import { loadFingerprintsForSchemes } from "@/lib/aif/behaviourFingerprint";

export async function buildAifGraphJSONLD(opts: {
  deliberationId?: string;
  argumentIds?: string[];
  includeLocutions?: boolean;
  includeCQs?: boolean;
}) {
  const { deliberationId, argumentIds = [], includeLocutions = false, includeCQs = false } = opts;

  // 1) Arguments
  const args = await prisma.argument.findMany({
    where: {
      ...(deliberationId ? { deliberationId } : {}),
      ...(argumentIds.length ? { id: { in: argumentIds } } : {}),
    },
    include: {
      scheme: { select: { key: true, name: true } },
      premises: true,
    },
  });
  const argIds = (argumentIds.length ? argumentIds : args.map(a => a.id));

  // 2) Claims used by those arguments
  const claimIds = Array.from(new Set([
    ...args.map(a => a.conclusionClaimId).filter(Boolean) as string[],
    ...args.flatMap(a => a.premises.map(p => p.claimId)),
  ]));
  const claims = claimIds.length
    ? await prisma.claim.findMany({ where: { id: { in: claimIds } }, select: { id:true, text:true } })
    : [];
  const textByClaimId = new Map(claims.map(c => [c.id, c.text || ""]));

  // 3) Conflicts
  const caRows = await prisma.conflictApplication.findMany({
    where: {
      OR: [
        { conflictedArgumentId: { in: argIds } },
        { conflictingArgumentId: { in: argIds } },
        { conflictedClaimId: { in: claimIds } },
        { conflictingClaimId: { in: claimIds } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  // 4) Preferences
  const paRows = await prisma.preferenceApplication.findMany({
    where: {
      OR: [
        { preferredArgumentId: { in: argIds } },
        { dispreferredArgumentId: { in: argIds } },
        { preferredClaimId: { in: claimIds } },
        { dispreferredClaimId: { in: claimIds } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  // 5) Optional locutions (L-nodes)
  const locs = includeLocutions && deliberationId
    ? await prisma.dialogueMove.findMany({
        where: { deliberationId },
        select: { id:true, kind:true, authorId:true, payload:true, targetType:true, targetId:true, replyToMoveId:true, argumentId:true, createdAt:true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // 6) Optional assumptions (presumptions/exceptions)
  const uses = args.length
    ? await prisma.assumptionUse.findMany({
        where: { argumentId: { in: argIds } },
        select: { id:true, argumentId:true, role:true, assumptionClaimId:true, assumptionText:true },
      })
    : [];

  // ---------- Assembly ----------
  const N: any[] = [];
  const seen = new Set<string>();
  const pushOnce = (o:any) => { const id=o['@id']; if (id && seen.has(id)) return; if (id) seen.add(id); N.push(o); };

  // Phase 4c (folksonomy step 17): preload behaviour fingerprints for every
  // scheme referenced by an exported RA so the importer can use them as a
  // candidate-set hint. The map is keyed by ArgumentScheme.id.
  const referencedSchemeIds = Array.from(
    new Set(args.map((a) => a.schemeId).filter((id): id is string => Boolean(id))),
  );
  const fingerprintBySchemeId = await loadFingerprintsForSchemes(referencedSchemeIds);

  // I-nodes
  for (const c of claims) {
    pushOnce({ "@id": `I:${c.id}`, "@type": "aif:InformationNode", "aif:text": textByClaimId.get(c.id) ?? "" });
  }

  // RA-nodes + edges
  for (const a of args) {
    const sId = `S:${a.id}`;
    const fp = a.schemeId ? fingerprintBySchemeId.get(a.schemeId) ?? null : null;
    pushOnce({
      "@id": sId,
      "@type": ["aif:RA"].concat(a.scheme?.key ? [`as:${a.scheme.key}`] : []),
      "aif:usesScheme": a.scheme?.key ?? null,
      "aif:name": a.scheme?.name ?? null,
      "as:appliesSchemeKey": a.scheme?.key ?? null,
      ...(fp ? { "mesh:behaviourFingerprint": fp } : {}),
    });

    // Premises: I → RA
    for (const p of a.premises) {
      const from = `I:${p.claimId}`, to = sId;
      N.push({ "@type": "aif:Premise", "aif:from": from, "aif:to": to });
      pushOnce({ "@id": from, "@type": "aif:InformationNode", "aif:text": textByClaimId.get(p.claimId) ?? "" });
    }
    // Conclusion: RA → I
    if (a.conclusionClaimId) {
      const to = `I:${a.conclusionClaimId}`;
      N.push({ "@type": "aif:Conclusion", "aif:from": sId, "aif:to": to });
      pushOnce({ "@id": to, "@type": "aif:InformationNode", "aif:text": textByClaimId.get(a.conclusionClaimId) ?? "" });
    }
  }

  // Presumptions / Exceptions (AssumptionUse → edges from RA to I)
  for (const u of uses) {
    const sId = `S:${u.argumentId}`;
    const iId = u.assumptionClaimId ? `I:${u.assumptionClaimId}` : `I:ASSM:${u.id}`;
    if (!seen.has(sId)) continue; // skip if RA not in export scope
    pushOnce({ "@id": iId, "@type": "aif:InformationNode", "aif:text": u.assumptionText ?? "" });
    N.push({
      "@type": u.role === 'exception' ? "as:HasException" : "as:HasPresumption",
      "aif:from": sId, "aif:to": iId
    });
  }

  // CA-nodes (conflict): conflicting → CA → conflicted
  for (const c of caRows) {
    const caId = `CA:${c.id}`;
    pushOnce({ "@id": caId, "@type": "aif:CA", "aif:usesScheme": c.schemeId ?? null });

    if (c.conflictingArgumentId) {
      N.push({ "@type":"aif:ConflictingElement", "aif:from": `S:${c.conflictingArgumentId}`, "aif:to": caId });
    } else if (c.conflictingClaimId) {
      N.push({ "@type":"aif:ConflictingElement", "aif:from": `I:${c.conflictingClaimId}`, "aif:to": caId });
    }
    if (c.conflictedArgumentId) {
      N.push({ "@type":"aif:ConflictedElement", "aif:from": caId, "aif:to": `S:${c.conflictedArgumentId}` });
    } else if (c.conflictedClaimId) {
      N.push({ "@type":"aif:ConflictedElement", "aif:from": caId, "aif:to": `I:${c.conflictedClaimId}` });
    }
  }

  // PA-nodes (preference): preferred → PA → dispreferred
  for (const p of paRows) {
    const paId = `PA:${p.id}`;
    pushOnce({ "@id": paId, "@type": "aif:PA", "aif:usesScheme": p.schemeId ?? null });

    if (p.preferredArgumentId) {
      N.push({ "@type":"aif:PreferredElement", "aif:from": `S:${p.preferredArgumentId}`, "aif:to": paId });
    } else if (p.preferredClaimId) {
      N.push({ "@type":"aif:PreferredElement", "aif:from": `I:${p.preferredClaimId}`, "aif:to": paId });
    }
    if (p.dispreferredArgumentId) {
      N.push({ "@type":"aif:DispreferredElement", "aif:from": paId, "aif:to": `S:${p.dispreferredArgumentId}` });
    } else if (p.dispreferredClaimId) {
      N.push({ "@type":"aif:DispreferredElement", "aif:from": paId, "aif:to": `I:${p.dispreferredClaimId}` });
    }
  }

  // Optional L-nodes (locutions) & "reply" transitions
  if (includeLocutions) {
    for (const m of locs) {
      const lId = `L:${m.id}`;
      pushOnce({
        "@id": lId,
        "@type": "aif:L",
        "aif:text": typeof m?.payload === "object" && m?.payload !== null
          ? String((m.payload as any).expression ?? (m.payload as any).note ?? "")
          : String(m?.payload ?? ""),
        "aif:illocution": m.kind ?? null,
        "aif:author": m.authorId ?? null
      });
      if (m.argumentId || (m.targetType === "argument" && m.targetId)) {
        N.push({ "@type":"aif:illocutes", "aif:from": lId, "aif:to": `S:${m.argumentId ?? m.targetId}` });
      } else if (m.targetType === "claim" && m.targetId) {
        N.push({ "@type":"aif:illocutes", "aif:from": lId, "aif:to": `I:${m.targetId}` });
      }
      if (m.replyToMoveId) {
        N.push({ "@type":"aif:replies", "aif:from": `L:${m.replyToMoveId}`, "aif:to": lId });
      }
    }
  }

  // Optional CQ glue
  if (includeCQs && args.length) {
    const cqStatuses = await prisma.cQStatus.findMany({
      where: {
        OR: [
          { argumentId: { in: args.map(a => a.id) } },
          { targetType: 'argument' as TargetType, targetId: { in: args.map(a => a.id) } },
        ],
      },
      select: { argumentId: true, targetId: true, targetType: true, schemeKey: true, cqKey: true, status: true }
    });

    const statusByArg = new Map<string, Array<{schemeKey:string, cqKey:string, status:string}>>();
    for (const s of cqStatuses) {
      const k = s.argumentId || (s.targetType === 'argument' as TargetType ? s.targetId : null);
      if (!k) continue;
      const arr = statusByArg.get(k) || [];
      arr.push({ schemeKey: s.schemeKey, cqKey: s.cqKey, status: s.status || 'open' });
      statusByArg.set(k, arr);
    }

    for (const a of args) {
      const sId = `S:${a.id}`;
      const items = statusByArg.get(a.id) || [];
      for (const it of items) {
        const qId = `CQ:${a.id}:${it.cqKey}`;
        pushOnce({ "@id": qId, "@type": "cq:CriticalQuestion", "cq:key": it.cqKey, "cq:status": it.status });
        N.push({ "@type": "as:hasCriticalQuestion", "aif:from": sId, "aif:to": qId });
      }
    }
  }

  return {
    "@context": ctx["@context"],
    aifVersion: AIF_VERSION_STAMP.aifVersion,
    meshAifProfile: AIF_VERSION_STAMP.meshAifProfile,
    exportedAt: new Date().toISOString(),
    "@graph": N,
  };
}
