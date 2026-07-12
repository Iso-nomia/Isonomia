//lib/aif/types.ts
import type { AifNode, AifNodeKind } from '@/lib/arguments/diagram';


export type NodeType = 'I' | 'L' | 'RA' | 'CA' | 'PA' | 'TA';
export type EdgeType = 'premise' | 'conclusion' | 'presumption' | 'conflicting' | 'conflicted' | 'preferred' | 'dispreferred' | 'start' | 'end';
export type IlocutionType = 'assert' | 'question' | 'challenge' | 'concede' | 'retract' | 'disagree';
export type SchemeType = 'deductive' | 'defeasible' | 'presumptive' | 'inductive';
export type InferenceType = 'modus_ponens' | 'modus_tollens' | 'expert_opinion' | 'cause_effect' | 'analogy' | 'sign' | 'example' | 'consequences' | 'generic';
export type ConflictType = 'rebut' | 'undercut' | 'undermine' | 'logical_conflict' | 'expert_unreliability' | 'exception';
export type PreferenceType = 'argument' | 'rule' | 'premise' | 'source';

export interface BaseNode {
  id: string;
  nodeType: NodeType;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  creatorId?: string;
  debateId: string;
}

export interface INode extends BaseNode {
  nodeType: 'I';
  claimText: string;
}

export interface LNode extends BaseNode {
  nodeType: 'L';
  claimText: string;
  speakerId: string;
  ilocutionType: IlocutionType;
  propositionalContent?: string;
  targetMoveId?: string;
}

export interface RANode extends BaseNode {
  nodeType: 'RA';
  schemeId?: string;
  schemeType?: SchemeType;
  inferenceType: InferenceType;
}

export interface CANode extends BaseNode {
  nodeType: 'CA';
  schemeId?: string;
  conflictType: ConflictType;
}

export interface PANode extends BaseNode {
  nodeType: 'PA';
  schemeId?: string;
  preferenceType: PreferenceType;
  justification?: string;
}

export interface TANode extends BaseNode {
  nodeType: 'TA';
  schemeId?: string;
  schemeType?: SchemeType;
  inferenceType: InferenceType;
  protocolRuleId?: string;
}

export type AnyNode = INode | LNode | RANode | CANode | PANode | TANode;

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  debateId: string;
}

export interface AIFGraph {
  nodes: AnyNode[];
  edges: Edge[];
  metadata?: {
    title?: string;
    description?: string;
    created?: string;
    modified?: string;
    protocol?: string;
    debateId?: string;
  };
}

