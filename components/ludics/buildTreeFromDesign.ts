// components/ludics/buildTreeFromDesign.ts
import type { LociNode } from '@/packages/ludics-react/LociTree';

type SemanticAnnotation = 
  | { type: 'claim'; claimId: string; text: string; moid?: string | null }
  | { 
      type: 'argument'; 
      argumentId: string;
      scheme?: { key?: string; name?: string; purpose?: string; materialRelation?: string } | null;
      premises: Array<{ claimId?: string; text?: string }>;
      conclusion?: { claimId?: string; text?: string } | null;
    }
  | null;

type Act = {
  id: string;
  kind: string;
  polarity?: string | null;
  expression?: string;
  locus?: { path?: string | null };
  locusPath?: string;
  ramification?: string[];
  isAdditive?: boolean;
  additive?: boolean;
  semantic?: SemanticAnnotation;
};

type Design = {
  id: string;
  participantId: string;
  acts: Act[];
};

/**
 * Build tree from SINGLE design (not merged)
 * Each design is an independent strategy in ludics
 * 
 * @param design - A single LudicDesign with its acts
 * @returns LociNode tree representing this design's structure
 */
export function buildTreeFromDesign(design: Design): LociNode {
  const byPath = new Map<string, LociNode>();
  
  const ensure = (path: string): LociNode => {
    if (!byPath.has(path)) {
      byPath.set(path, { id: path, path, acts: [], children: [] });
    }
    return byPath.get(path)!;
  };
  
  // Add each act to its locus
  for (const act of design.acts || []) {
    const path = act.locusPath ?? act.locus?.path ?? '0';
    const node = ensure(path);
    
    const isDaimon = (act.kind ?? '').toUpperCase() === 'DAIMON';
    
    // Determine polarity for this design
    // All acts in a design have the same polarity (P for Proponent, O for Opponent)
    // Exception: Daimon (†) has null polarity
    const polarity = isDaimon 
      ? null 
      : (design.participantId === 'Proponent' ? 'P' : 'O') as 'P' | 'O';
    
    node.acts.push({
      id: act.id,
      polarity,
      expression: act.expression,
      isAdditive: !!(act.isAdditive || act.additive),
      semantic: act.semantic, // Include semantic annotation
    });
    
    // Ensure all ancestor loci exist (for proper tree structure)
    const parts = path.split('.');
    for (let i = 1; i < parts.length; i++) {
      ensure(parts.slice(0, i).join('.'));
    }
  }
  
  // Stitch parent-child relationships
  const dict = Object.fromEntries(Array.from(byPath.entries()));
  
  for (const node of byPath.values()) {
    if (node.path === '0') continue; // Root has no parent
    
    const parentPath = node.path.includes('.') 
      ? node.path.split('.').slice(0, -1).join('.')
      : null;
      
    if (parentPath && dict[parentPath]) {
      dict[parentPath].children.push(node);
    }
  }
  
  // Sort children by path suffix for consistent display
  for (const node of byPath.values()) {
    node.children.sort((a, b) => {
      const aSuffix = parseInt(a.path.split('.').slice(-1)[0], 10);
      const bSuffix = parseInt(b.path.split('.').slice(-1)[0], 10);
      return aSuffix - bSuffix;
    });
  }
  
  return dict['0'] || { id: '0', path: '0', acts: [], children: [] };
}
