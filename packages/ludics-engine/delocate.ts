// packages/ludics-engine/delocate.ts
import { prisma } from '@/lib/prismaclient';

type Id = string;

export type Design = { id?: string; base: string; actions: any[]; meta?: any };

export function delocate(design: Design, toLocus: string): Design {
  return {
    ...design,
    base: toLocus,
    meta: { ...(design.meta ?? {}), delocatedFrom: design.base, delocated: true }
  };
}

/**
 * Fax operation: Import acts from a referenced scope into current scope
 * This creates a "delocation" - acts from source scope appear at a specific locus in target scope
 * 
 * @param sourceDesignId - Design ID from the referenced scope
 * @param targetDesignId - Design ID in the current scope
 * @param targetLocus - Where to place the faxed acts in target design (e.g., "0.2.1")
 * @param filter - Optional filter for which acts to import
 * @returns Array of created act IDs in target design
 */
export async function faxFromScope(
  sourceDesignId: string,
  targetDesignId: string,
  targetLocus: string,
  filter?: { kind?: string; polarity?: string; maxDepth?: number }
): Promise<{ actIds: string[]; faxedCount: number }> {
  // 1. Fetch source design and its acts
  const sourceDesign = await prisma.ludicDesign.findUnique({
    where: { id: sourceDesignId },
    select: {
      id: true,
      scope: true,
      acts: {
        include: { locus: true },
        orderBy: { orderInDesign: 'asc' }
      }
    }
  });
  
  if (!sourceDesign) {
    throw new Error(`Source design ${sourceDesignId} not found`);
  }
  
  const targetDesign = await prisma.ludicDesign.findUnique({
    where: { id: targetDesignId },
    select: { 
      id: true, 
      deliberationId: true, 
      scope: true,
      referencedScopes: true,
      crossScopeActIds: true
    }
  });
  
  if (!targetDesign) {
    throw new Error(`Target design ${targetDesignId} not found`);
  }
  
  // 2. Filter acts to import
  let actsToFax = sourceDesign.acts;
  
  if (filter?.kind) {
    actsToFax = actsToFax.filter(a => a.kind === filter.kind);
  }
  
  if (filter?.polarity) {
    actsToFax = actsToFax.filter(a => a.polarity === filter.polarity);
  }
  
  if (filter?.maxDepth !== undefined) {
    actsToFax = actsToFax.filter(a => {
      if (!a.locus?.path) return true;
      const depth = a.locus.path.split('.').length - 1;
      return depth <= filter.maxDepth!;
    });
  }
  
  // 3. Create locus mapping: source locus paths -> target locus paths
  const pathMap = new Map<string, string>();
  const sourcePaths = new Set<string>();
  
  for (const act of actsToFax) {
    if (act.locus?.path) {
      sourcePaths.add(act.locus.path);
    }
  }
  
  // Map source paths to target paths under targetLocus
  for (const sourcePath of sourcePaths) {
    // e.g., source "0.1" -> target "0.2.1.1" if targetLocus is "0.2.1"
    const relPath = sourcePath === '0' ? '' : sourcePath.slice(2); // "0.1" -> "1"
    const targetPath = relPath ? `${targetLocus}.${relPath}` : targetLocus;
    pathMap.set(sourcePath, targetPath);
  }
  
  // 4. Ensure all target loci exist
  const locusIdMap = new Map<string, string>();
  const existingLoci = await prisma.ludicLocus.findMany({
    where: {
      dialogueId: targetDesign.deliberationId,
      path: { in: Array.from(pathMap.values()) }
    }
  });
  
  for (const locus of existingLoci) {
    locusIdMap.set(locus.path, locus.id);
  }
  
  // Create missing loci
  for (const targetPath of pathMap.values()) {
    if (!locusIdMap.has(targetPath)) {
      const created = await prisma.ludicLocus.create({
        data: {
          dialogueId: targetDesign.deliberationId,
          path: targetPath
        }
      });
      locusIdMap.set(targetPath, created.id);
    }
  }
  
  // 5. Get current max orderInDesign for target
  const maxOrder = await prisma.ludicAct.findFirst({
    where: { designId: targetDesignId },
    orderBy: { orderInDesign: 'desc' },
    select: { orderInDesign: true }
  });
  
  let order = (maxOrder?.orderInDesign ?? -1) + 1;
  
  // 6. Create faxed acts in target design
  const createdActIds: string[] = [];
  
  for (const sourceAct of actsToFax) {
    const sourcePath = sourceAct.locus?.path ?? '0';
    const targetPath = pathMap.get(sourcePath) ?? targetLocus;
    const targetLocusId = locusIdMap.get(targetPath);
    
    if (!targetLocusId) {
      console.warn(`[fax] No locus ID for path ${targetPath}, skipping act ${sourceAct.id}`);
      continue;
    }
    
    const createdAct = await prisma.ludicAct.create({
      data: {
        designId: targetDesignId,
        kind: sourceAct.kind,
        polarity: sourceAct.polarity,
        expression: sourceAct.expression,
        locusId: targetLocusId,
        ramification: sourceAct.ramification || [],
        isAdditive: sourceAct.isAdditive ?? false,
        orderInDesign: order++,
        metaJson: {
          ...(sourceAct.metaJson as any),
          faxed: true,
          faxedFrom: {
            designId: sourceDesignId,
            scope: sourceDesign.scope,
            actId: sourceAct.id,
            originalLocus: sourcePath
          }
        }
      }
    });
    
    createdActIds.push(createdAct.id);
  }
  
  // 7. Update target design to track cross-scope reference
  await prisma.ludicDesign.update({
    where: { id: targetDesignId },
    data: {
      crossScopeActIds: {
        push: createdActIds
      },
      referencedScopes: {
        push: sourceDesign.scope ? [sourceDesign.scope] : []
      }
    }
  });
  
  return {
    actIds: createdActIds,
    faxedCount: createdActIds.length
  };
}



/** Clone a compiled design, renaming every locus under base "0" to "0.<tag>..." */
export async function cloneDesignWithShift(designId: Id, tag: string) {
  if (!tag || /[^A-Za-z0-9_-]/.test(tag)) throw new Error('Bad tag');
  const src = await prisma.ludicDesign.findUnique({
    where: { id: designId },
    include: { acts: { include: { locus: true }, orderBy: { orderInDesign: 'asc' } } },
  });
  if (!src) throw new Error('NO_SUCH_DESIGN');

  const dialogueId = src.deliberationId;

  // Build path mapping 0 -> 0.tag ; 0.1.2 -> 0.tag.1.2
  const paths = new Set<string>();
  for (const a of src.acts) if (a.locus?.path) paths.add(a.locus.path);
  paths.add('0');
  const mapPath = (p: string) =>
    p === '0' ? `0.${tag}` : p.startsWith('0.') ? `0.${tag}${p.slice(1)}` : p;

  // Ensure loci exist for all remapped paths
  const pathsArr = Array.from(paths).sort((a, b) => a.length - b.length);
  const idByPath = new Map<string, string>();
  const existing = await prisma.ludicLocus.findMany({ where: { dialogueId } });
  for (const l of existing) idByPath.set(l.path, l.id);

  for (const old of pathsArr) {
    const np = mapPath(old);
    if (!idByPath.has(np)) {
      const row = await prisma.ludicLocus.create({ data: { dialogueId, path: np } });
      idByPath.set(np, row.id);
    }
  }

  // Create the new design
  const dst = await prisma.ludicDesign.create({
    data: {
      deliberationId: dialogueId,
      participantId: src.participantId,
      rootLocusId: idByPath.get(mapPath('0'))!,
      extJson: { shiftedFrom: src.id, tag },
    },
  });

  // Copy acts with locus remapped
  let order = 0;
  for (const a of src.acts) {
    await prisma.ludicAct.create({
      data: {
        designId: dst.id,
        kind: a.kind,
        polarity: a.polarity,
        expression: a.expression,
        isAdditive: a.isAdditive ?? undefined,
        ramification: Array.isArray(a.ramification) ? a.ramification : [],   // ← add this

        orderInDesign: order++,
        locusId: a.locusId ? idByPath.get(mapPath(a.locus!.path))! : null,
        metaJson: a.metaJson ?? undefined,
      },
    });
  }

  return { id: dst.id, tag, base: mapPath('0') };
}
